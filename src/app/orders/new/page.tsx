import { verifySession, hasTodayPrices, getTodayPrices } from '@/lib/dal'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import OrderForm from '@/components/ui/order-form'

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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '24px 0 20px',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--mk-text)',
              letterSpacing: '-0.02em',
            }}
          >
            Новый заказ
          </h1>
          <Link
            href="/orders"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--mk-text-2)',
              textDecoration: 'none',
              padding: '6px 0',
            }}
          >
            ← Заказы
          </Link>
        </div>
        <OrderForm products={products ?? []} priceMap={priceMap} />
      </div>
    </div>
  )
}
