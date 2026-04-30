import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export const verifySession = cache(async () => {
  const session = await getSession()
  if (!session.isAuthenticated) {
    redirect('/login')
  }
  return { isAuth: true }
})

export type TodayPrice = { product_id: string; price_per_kg: number }

export async function getTodayPrices(): Promise<TodayPrice[]> {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('prices')
    .select('product_id, price_per_kg')
    .eq('date', today)
  return data ?? []
}

export async function hasTodayPrices(): Promise<boolean> {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const { count } = await supabase
    .from('prices')
    .select('*', { count: 'exact', head: true })
    .eq('date', today)
  return (count ?? 0) > 0
}

// Order types
export type OrderRow = Database['public']['Tables']['orders']['Row']
export type OrderItemRow = Database['public']['Tables']['order_items']['Row']
export type ClientRow = Database['public']['Tables']['clients']['Row']

export type OrderWithItems = OrderRow & {
  order_items: (OrderItemRow & { product_name: string })[]
}

export async function getOrdersByDate(date: string): Promise<OrderRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', `${date}T00:00:00+00:00`)
    .lte('created_at', `${date}T23:59:59+00:00`)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getOrderById(id: string): Promise<OrderRow | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()
  return data ?? null
}

export async function getOrderWithItems(id: string): Promise<OrderWithItems | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*, products(name))')
    .eq('id', id)
    .single()
  if (!data) return null

  type RawRow = OrderRow & {
    order_items: (OrderItemRow & { products: { name: string } | null })[]
  }
  const raw = data as unknown as RawRow

  const items = (raw.order_items ?? []).map(({ products, ...rest }) => ({
    ...rest,
    product_name: products?.name ?? '',
  }))

  return { ...raw, order_items: items }
}
