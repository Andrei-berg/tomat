'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { verifySession, calcEffective } from '@/lib/dal'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'

export type CreateOrderState = { error?: string; success?: boolean; orderId?: string } | undefined
export type UpdateOrderState = { error?: string } | undefined
export type ClientResult = { id: string; name: string }

export async function searchClients(query: string): Promise<ClientResult[]> {
  await verifySession()
  if (query.length < 2) return []
  const supabase = createSupabaseClient()
  const { data } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(8)
  return data ?? []
}

export async function createClient(
  name: string,
): Promise<ClientResult | { error: string }> {
  await verifySession()
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Имя не может быть пустым' }
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('clients')
    .insert({ name: trimmed })
    .select('id, name')
    .single()
  if (error) return { error: error.message }
  return data as ClientResult
}

export async function createOrder(
  _prevState: CreateOrderState,
  formData: FormData,
): Promise<CreateOrderState> {
  await verifySession()

  const payment_type = formData.get('payment_type') as 'cash' | 'card' | 'debt'
  const client_id = (formData.get('client_id') as string | null) || null
  const client_name_raw = (formData.get('client_name_raw') as string | null) || null
  const discount_raw = parseFloat(formData.get('discount_percent') as string)
  const discount_percent = isNaN(discount_raw) ? null : discount_raw
  const manual_raw = parseFloat(formData.get('manual_total') as string)
  const manual_total = isNaN(manual_raw) ? null : manual_raw

  type OrderItem = {
    product_id: string
    boxes_count: number
    weight_kg: number
    price_per_kg: number
  }
  const items: OrderItem[] = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('weight_')) continue
    const pid = key.slice('weight_'.length)
    const weight = parseFloat(value as string)
    if (!weight || weight <= 0) continue
    const price = parseFloat((formData.get(`price_${pid}`) as string) || '0')
    const boxes = parseInt((formData.get(`boxes_${pid}`) as string) || '0') || 0
    items.push({ product_id: pid, boxes_count: boxes, weight_kg: weight, price_per_kg: price })
  }

  if (items.length === 0) {
    return { error: 'Добавьте хотя бы одну позицию' }
  }

  const calculated_total = Math.round(
    items.reduce((sum, item) => sum + item.weight_kg * item.price_per_kg, 0) * 100,
  ) / 100

  const supabase = createSupabaseClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      payment_type,
      client_id,
      client_name_raw,
      calculated_total,
      discount_percent,
      manual_total,
      status: payment_type === 'debt' ? 'debt' : 'paid',
    })
    .select('id')
    .single()

  if (orderError || !order) {
    return { error: orderError?.message ?? 'Ошибка создания заказа' }
  }

  const orderItems = items.map((item) => ({ ...item, order_id: order.id }))
  const { error: itemsError } = await supabase.from('order_items').insert(orderItems)

  if (itemsError) {
    // Compensating delete — Supabase free tier has no transactions via JS client
    await supabase.from('orders').delete().eq('id', order.id)
    return { error: itemsError.message }
  }

  // Optional prepayment for debt orders
  const prepaymentRaw = parseFloat(formData.get('prepayment_amount') as string)
  const prepaymentType = formData.get('prepayment_type') as string

  if (payment_type === 'debt' && !isNaN(prepaymentRaw) && prepaymentRaw > 0) {
    const effectiveAmt = calcEffective({ calculated_total, discount_percent, manual_total })
    const safeAmount = Math.min(prepaymentRaw, effectiveAmt)

    const { error: prepayErr } = await supabase.from('debt_payments').insert({
      order_id: order.id,
      amount: safeAmount,
      payment_type: (prepaymentType === 'card' ? 'card' : 'cash') as 'cash' | 'card',
    })

    if (!prepayErr) {
      const newStatus = safeAmount >= effectiveAmt ? 'paid' : 'partial'
      await supabase.from('orders').update({ status: newStatus }).eq('id', order.id)
      // Revalidate debts regardless of partial or paid — debtor balance changes in both cases
      revalidatePath('/debts')
      revalidatePath('/debtors')
    }
    // If prepayErr: order was created successfully — prepayment is best-effort.
    // Seller can record it later via /debts/[clientId].
  }

  revalidatePath('/orders')
  return { success: true, orderId: order.id }
}

export async function updateOrder(
  _prevState: UpdateOrderState,
  formData: FormData,
): Promise<UpdateOrderState> {
  await verifySession()

  const orderId = formData.get('order_id') as string
  if (!orderId) return { error: 'ID заказа не указан' }

  const payment_type = formData.get('payment_type') as 'cash' | 'card' | 'debt'
  const client_id = (formData.get('client_id') as string | null) || null
  const client_name_raw = (formData.get('client_name_raw') as string | null) || null
  const discount_raw = parseFloat(formData.get('discount_percent') as string)
  const discount_percent = isNaN(discount_raw) ? null : discount_raw
  const manual_raw = parseFloat(formData.get('manual_total') as string)
  const manual_total = isNaN(manual_raw) ? null : manual_raw

  type OrderItem = {
    product_id: string
    boxes_count: number
    weight_kg: number
    price_per_kg: number
  }
  const items: OrderItem[] = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('weight_')) continue
    const pid = key.slice('weight_'.length)
    const weight = parseFloat(value as string)
    if (!weight || weight <= 0) continue
    const price = parseFloat((formData.get(`price_${pid}`) as string) || '0')
    const boxes = parseInt((formData.get(`boxes_${pid}`) as string) || '0') || 0
    items.push({ product_id: pid, boxes_count: boxes, weight_kg: weight, price_per_kg: price })
  }

  if (items.length === 0) {
    return { error: 'Добавьте хотя бы одну позицию' }
  }

  const calculated_total =
    Math.round(items.reduce((sum, item) => sum + item.weight_kg * item.price_per_kg, 0) * 100) / 100

  const supabase = createSupabaseClient()

  // Replace order_items (delete + re-insert)
  const { error: deleteItemsError } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)
  if (deleteItemsError) return { error: deleteItemsError.message }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(items.map(item => ({ ...item, order_id: orderId })))
  if (itemsError) return { error: itemsError.message }

  // Recompute status for debt orders
  let status: 'paid' | 'debt' | 'partial'
  if (payment_type !== 'debt') {
    status = 'paid'
  } else {
    const { data: payments } = await supabase
      .from('debt_payments')
      .select('amount')
      .eq('order_id', orderId)
    const paidTotal = (payments ?? []).reduce((s, p) => s + p.amount, 0)
    const effective = calcEffective({ calculated_total, discount_percent, manual_total })
    if (paidTotal >= effective) status = 'paid'
    else if (paidTotal > 0) status = 'partial'
    else status = 'debt'
  }

  const { error: orderError } = await supabase
    .from('orders')
    .update({ payment_type, client_id, client_name_raw, calculated_total, discount_percent, manual_total, status })
    .eq('id', orderId)
  if (orderError) return { error: orderError.message }

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/debts')
  revalidatePath('/debtors')
  redirect(`/orders/${orderId}`)
}

export async function deleteOrder(orderId: string): Promise<void> {
  await verifySession()
  const supabase = createSupabaseClient()

  await supabase.from('debt_payments').delete().eq('order_id', orderId)
  await supabase.from('order_items').delete().eq('order_id', orderId)
  await supabase.from('orders').delete().eq('id', orderId)

  revalidatePath('/orders')
  revalidatePath('/debts')
  revalidatePath('/debtors')
  redirect('/orders')
}
