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

// ── Client helpers ─────────────────────────────────────────────────────────

export function calcEffective(o: {
  calculated_total: number | null
  discount_percent: number | null
  manual_total: number | null
}): number {
  if (o.manual_total != null) return o.manual_total
  const base = o.calculated_total ?? 0
  if (o.discount_percent) return Math.round(base * (1 - o.discount_percent / 100) * 100) / 100
  return base
}

export type ClientWithStats = ClientRow & {
  orderCount: number
  totalSpent: number
  lastOrderAt: string | null
  debtAmount: number
}

export async function getClientsWithStats(): Promise<ClientWithStats[]> {
  const supabase = createClient()
  const [{ data: clients }, { data: orders }, { data: payments }] = await Promise.all([
    supabase.from('clients').select('*').order('name'),
    supabase
      .from('orders')
      .select('id, client_id, created_at, calculated_total, discount_percent, manual_total, status')
      .not('client_id', 'is', null),
    supabase.from('debt_payments').select('order_id, amount'),
  ])

  const paidByOrder = new Map<string, number>()
  for (const p of payments ?? []) {
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + p.amount)
  }

  return (clients ?? []).map(client => {
    const co = (orders ?? []).filter(o => o.client_id === client.id)
    const sorted = [...co].sort((a, b) => b.created_at.localeCompare(a.created_at))
    const totalSpent = co.reduce((s, o) => s + calcEffective(o), 0)
    const debtAmount = co
      .filter(o => o.status === 'debt' || o.status === 'partial')
      .reduce((s, o) => s + Math.max(0, calcEffective(o) - (paidByOrder.get(o.id) ?? 0)), 0)
    return { ...client, orderCount: co.length, totalSpent, lastOrderAt: sorted[0]?.created_at ?? null, debtAmount }
  })
}

export async function getClientWithStats(id: string): Promise<ClientWithStats | null> {
  const supabase = createClient()
  const [{ data: client }, { data: orders }, { data: payments }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('orders').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('debt_payments').select('order_id, amount'),
  ])
  if (!client) return null

  const paidByOrder = new Map<string, number>()
  for (const p of payments ?? []) {
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + p.amount)
  }

  const co = orders ?? []
  const totalSpent = co.reduce((s, o) => s + calcEffective(o), 0)
  const debtAmount = co
    .filter(o => o.status === 'debt' || o.status === 'partial')
    .reduce((s, o) => s + Math.max(0, calcEffective(o) - (paidByOrder.get(o.id) ?? 0)), 0)

  return { ...client, orderCount: co.length, totalSpent, lastOrderAt: co[0]?.created_at ?? null, debtAmount }
}

export async function getClientOrders(clientId: string): Promise<OrderRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export type DebtorEntry = {
  clientId: string | null
  clientName: string
  totalDebt: number
  lastOrderAt: string
  orderCount: number
}

export async function getDebtors(): Promise<DebtorEntry[]> {
  const supabase = createClient()
  const [{ data: orders }, { data: payments }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, client_id, client_name_raw, created_at, calculated_total, discount_percent, manual_total, status')
      .in('status', ['debt', 'partial'])
      .order('created_at', { ascending: false }),
    supabase.from('debt_payments').select('order_id, amount'),
  ])

  const paidByOrder = new Map<string, number>()
  for (const p of payments ?? []) {
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + p.amount)
  }

  const byClient = new Map<string, { clientId: string | null; name: string; debt: number; lastAt: string; count: number }>()
  for (const o of orders ?? []) {
    const key = o.client_id ?? `raw:${o.client_name_raw ?? 'unknown'}`
    const name = o.client_name_raw ?? 'Неизвестный'
    const remaining = Math.max(0, calcEffective(o) - (paidByOrder.get(o.id) ?? 0))
    if (remaining <= 0) continue
    const e = byClient.get(key)
    if (e) { e.debt += remaining; e.count++; if (o.created_at > e.lastAt) e.lastAt = o.created_at }
    else byClient.set(key, { clientId: o.client_id, name, debt: remaining, lastAt: o.created_at, count: 1 })
  }

  return Array.from(byClient.values())
    .sort((a, b) => b.debt - a.debt)
    .map(e => ({ clientId: e.clientId, clientName: e.name, totalDebt: e.debt, lastOrderAt: e.lastAt, orderCount: e.count }))
}

export type DebtOrderEntry = {
  orderId: string
  createdAt: string
  effectiveTotal: number
  paidTotal: number
  remaining: number
  status: 'debt' | 'partial'
}

export async function getClientDebtOrders(clientId: string): Promise<DebtOrderEntry[]> {
  const supabase = createClient()
  const { data: orders } = await supabase
    .from('orders')
    .select('id, created_at, calculated_total, discount_percent, manual_total, status')
    .eq('client_id', clientId)
    .in('status', ['debt', 'partial'])
    .order('created_at', { ascending: false })

  if (!orders || orders.length === 0) return []

  const orderIds = orders.map(o => o.id)
  const { data: payments } = await supabase
    .from('debt_payments')
    .select('order_id, amount')
    .in('order_id', orderIds)

  const paidByOrder = new Map<string, number>()
  for (const p of payments ?? []) {
    paidByOrder.set(p.order_id, (paidByOrder.get(p.order_id) ?? 0) + p.amount)
  }

  return orders.map(o => {
    const eff = calcEffective(o)
    const paid = paidByOrder.get(o.id) ?? 0
    return {
      orderId: o.id,
      createdAt: o.created_at,
      effectiveTotal: eff,
      paidTotal: paid,
      remaining: Math.max(0, eff - paid),
      status: o.status as 'debt' | 'partial',
    }
  })
}

export type DebtPaymentRow = {
  id: string
  amount: number
  paid_at: string
  payment_type: 'cash' | 'card'
  notes: string | null
}

export async function getDebtPayments(orderId: string): Promise<DebtPaymentRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('debt_payments')
    .select('id, amount, paid_at, payment_type, notes')
    .eq('order_id', orderId)
    .order('paid_at', { ascending: true })
  return (data ?? []) as DebtPaymentRow[]
}
