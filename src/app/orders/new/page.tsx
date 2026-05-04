import { verifySession, hasTodayPrices, getTodayPrices } from '@/lib/dal'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrderForm from '@/components/ui/order-form'
import BottomNav from '@/components/ui/bottom-nav'

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; clientName?: string }>
}) {
  await verifySession()

  const hasPrices = await hasTodayPrices()
  if (!hasPrices) redirect('/prices')

  const { clientId, clientName } = await searchParams

  const supabase = createSupabaseClient()
  const [{ data: products }, todayPrices] = await Promise.all([
    supabase.from('products').select('id, name, sort_order').order('sort_order'),
    getTodayPrices(),
  ])

  const priceMap: Record<string, number> = Object.fromEntries(
    (todayPrices ?? []).map(p => [p.product_id, p.price_per_kg])
  )

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px 120px' }}>
        <div style={{ paddingTop: '24px', paddingBottom: '20px' }}>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
            Заказы
          </p>
          <h1 style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--mk-text)' }}>
            Новый заказ
          </h1>
        </div>
        <OrderForm
          products={products ?? []}
          priceMap={priceMap}
          initialClientId={clientId}
          initialClientName={clientName}
        />
      </div>
      <BottomNav />
    </div>
  )
}
