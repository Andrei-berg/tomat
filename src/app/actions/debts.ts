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
