'use server'

import { revalidatePath } from 'next/cache'
import { verifySession, calcEffective } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export type RecordPaymentState = { error?: string; success?: boolean } | undefined

export async function recordPayment(
  _prev: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  await verifySession()

  const orderId = formData.get('order_id') as string
  const clientId = formData.get('client_id') as string
  const amountRaw = parseFloat(formData.get('amount') as string)
  const paymentType = formData.get('payment_type') as 'cash' | 'card'

  if (!orderId || isNaN(amountRaw) || amountRaw <= 0) {
    return { error: 'Некорректная сумма' }
  }
  if (paymentType !== 'cash' && paymentType !== 'card') {
    return { error: 'Выберите тип оплаты' }
  }

  const supabase = createClient()

  // Fetch current order and existing payments to validate amount
  const [{ data: order }, { data: existingPayments }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, calculated_total, discount_percent, manual_total')
      .eq('id', orderId)
      .single(),
    supabase.from('debt_payments').select('amount').eq('order_id', orderId),
  ])

  if (!order) return { error: 'Заказ не найден' }

  const effectiveTotal = calcEffective(order)
  const alreadyPaid = (existingPayments ?? []).reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, effectiveTotal - alreadyPaid)

  if (amountRaw > remaining) {
    return { error: `Сумма превышает остаток долга (${remaining.toLocaleString('ru-RU')} ₽)` }
  }

  // Insert payment
  const { error: payErr } = await supabase.from('debt_payments').insert({
    order_id: orderId,
    amount: amountRaw,
    payment_type: paymentType,
  })
  if (payErr) return { error: payErr.message }

  // Update order status — recompute with new payment included
  const totalPaid = alreadyPaid + amountRaw
  const newStatus = totalPaid >= effectiveTotal ? 'paid' : 'partial'
  await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)

  revalidatePath('/debtors')
  if (clientId) revalidatePath(`/debts/${clientId}`)

  return { success: true }
}

export async function recordClientPayment(
  _prev: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  await verifySession()

  const clientId = formData.get('client_id') as string
  const amountRaw = parseFloat(formData.get('amount') as string)
  const paymentType = formData.get('payment_type') as 'cash' | 'card'

  if (!clientId || isNaN(amountRaw) || amountRaw <= 0) {
    return { error: 'Некорректная сумма' }
  }
  if (paymentType !== 'cash' && paymentType !== 'card') {
    return { error: 'Выберите тип оплаты' }
  }

  const supabase = createClient()

  // Fetch debt/partial orders oldest-first for sequential allocation
  const { data: orders } = await supabase
    .from('orders')
    .select('id, calculated_total, discount_percent, manual_total, status')
    .eq('client_id', clientId)
    .in('status', ['debt', 'partial'])
    .order('created_at', { ascending: true })

  if (!orders || orders.length === 0) return { error: 'Долги не найдены' }

  const orderIds = orders.map(o => o.id)
  const { data: existingPayments } = await supabase
    .from('debt_payments')
    .select('order_id, amount')
    .in('order_id', orderIds)

  const paidByOrder = new Map<string, number>()
  for (const p of existingPayments ?? []) {
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + p.amount)
  }

  const enriched = orders.map(o => {
    const eff = calcEffective(o)
    const paid = paidByOrder.get(o.id) ?? 0
    return { id: o.id, effectiveTotal: eff, paid, remaining: Math.max(0, eff - paid) }
  })

  const totalRemaining = enriched.reduce((s, o) => s + o.remaining, 0)
  if (amountRaw > totalRemaining + 0.005) {
    return { error: `Сумма превышает долг (${Math.round(totalRemaining).toLocaleString('ru-RU')} ₽)` }
  }

  // Distribute oldest-first
  let toDistribute = amountRaw
  const inserts: { order_id: string; amount: number; payment_type: 'cash' | 'card' }[] = []
  const updates: { id: string; status: 'paid' | 'partial' }[] = []

  for (const o of enriched) {
    if (toDistribute <= 0.005) break
    if (o.remaining <= 0) continue
    const toPay = Math.min(toDistribute, o.remaining)
    inserts.push({ order_id: o.id, amount: toPay, payment_type: paymentType as 'cash' | 'card' })
    const newPaid = o.paid + toPay
    updates.push({ id: o.id, status: (newPaid >= o.effectiveTotal - 0.005 ? 'paid' : 'partial') as 'paid' | 'partial' })
    toDistribute -= toPay
  }

  const { error: insertErr } = await supabase.from('debt_payments').insert(inserts)
  if (insertErr) return { error: insertErr.message }

  for (const { id, status } of updates) {
    await supabase.from('orders').update({ status }).eq('id', id)
  }

  revalidatePath('/debtors')
  revalidatePath(`/debts/${clientId}`)

  return { success: true }
}
