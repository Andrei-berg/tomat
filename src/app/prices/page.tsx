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

  const now = new Date()
  const weekday = now.toLocaleDateString('ru-RU', { weekday: 'long' })
  const dateStr = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  const heading = weekday.charAt(0).toUpperCase() + weekday.slice(1)

  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'var(--mk-bg)',
        fontFamily: 'var(--font-geist-sans)',
      }}
    >
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px 52px' }}>

        {/* ── Page header ──────────────────────────────── */}
        <header style={{ paddingTop: '48px', paddingBottom: '24px' }}>
          <p style={{
            margin: '0 0 10px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--mk-text-3)',
          }}>
            Прайс-лист
          </p>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <h1 style={{
              margin: 0,
              fontSize: '34px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: 'var(--mk-text)',
            }}>
              {heading}
            </h1>
            <span style={{ fontSize: '18px', color: 'var(--mk-text-2)', fontWeight: 400 }}>
              {dateStr}
            </span>
          </div>

          <div style={{
            height: '1px',
            background: 'var(--mk-border)',
            marginTop: '22px',
          }} />
        </header>

        {/* ── Form ─────────────────────────────────────── */}
        <main>
          <PricesForm products={products ?? []} priceMap={priceMap} />
        </main>
      </div>
    </div>
  )
}
