import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

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
