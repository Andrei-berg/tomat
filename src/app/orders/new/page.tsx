import { verifySession, hasTodayPrices, getTodayPrices } from '@/lib/dal'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrderForm from '@/components/ui/order-form'
import NavBar from '@/components/ui/nav-bar'

export default async function NewOrderPage() {
  await verifySession()

  const hasPrices = await hasTodayPrices()
  if (!hasPrices) redirect('/prices')

  const supabase = createSupabaseClient()
  const [{ data: products }, todayPrices] = await Promise.all([
    supabase.from('products').select('id, name, sort_order').order('sort_order'),
    getTodayPrices(),
  ])

  const priceMap: Record<string, number> = Object.fromEntries(
    (todayPrices ?? []).map(p => [p.product_id, p.price_per_kg])
  )

  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'var(--mk-bg)',
        fontFamily: 'var(--font-geist-sans)',
      }}
    >
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px 52px' }}>
        <NavBar />
        <h1
          style={{
            margin: '4px 0 20px',
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--mk-text)',
            letterSpacing: '-0.02em',
          }}
        >
          Новый заказ
        </h1>
        <OrderForm products={products ?? []} priceMap={priceMap} />
      </div>
    </div>
  )
}
