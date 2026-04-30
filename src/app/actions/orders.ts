'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'

export type CreateOrderState = { error?: string; success?: boolean; orderId?: string } | undefined
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

  revalidatePath('/orders')
  return { success: true, orderId: order.id }
}
