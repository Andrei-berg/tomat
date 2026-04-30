import { verifySession, getTodayPrices } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import PricesForm from '@/components/ui/prices-form'

export default async function PricesPage() {
  await verifySession()

  const supabase = createClient()

  const [{ data: products }, todayPrices] = await Promise.all([
    supabase.from('products').select('id, name, sort_order').order('sort_order'),
    getTodayPrices(),
  ])

  const priceMap: Record<string, number | null> = Object.fromEntries(
    todayPrices.map(p => [p.product_id, p.price_per_kg])
  )

  return (
    <main className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">Цены на сегодня</h1>
      <PricesForm products={products ?? []} priceMap={priceMap} />
    </main>
  )
}
