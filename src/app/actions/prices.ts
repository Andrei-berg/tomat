'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

export type SavePricesState = { error?: string; success?: boolean } | undefined
export type CopyPricesState = { prices?: Record<string, number>; error?: string } | undefined

type PriceInsert = Database['public']['Tables']['prices']['Insert']

export async function savePrices(
  _prevState: SavePricesState,
  formData: FormData,
): Promise<SavePricesState> {
  await verifySession()
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const entries: PriceInsert[] = []
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('$')) continue
    const price = Number(value)
    if (!price || price <= 0) continue
    entries.push({ product_id: key, date: today, price_per_kg: price })
  }

  if (entries.length === 0) {
    return { error: 'Введите хотя бы одну цену' }
  }

  const { error } = await supabase
    .from('prices')
    .upsert(entries, { onConflict: 'product_id,date' })

  if (error) return { error: error.message }

  revalidatePath('/prices')
  return { success: true }
}

export async function copyYesterdayPrices(
  _prevState: CopyPricesState,
): Promise<CopyPricesState> {
  await verifySession()
  const supabase = createClient()
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('prices')
    .select('product_id, price_per_kg')
    .eq('date', yesterday)

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Цены вчера не найдены' }

  return {
    prices: Object.fromEntries(data.map(p => [p.product_id, p.price_per_kg])),
  }
}
