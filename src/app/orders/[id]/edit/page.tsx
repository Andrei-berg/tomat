import { notFound } from 'next/navigation'
import { verifySession, getOrderWithItems, getTodayPrices } from '@/lib/dal'
import { createClient as createSupabaseClient } from '@/lib/supabase/server'
import OrderEditForm from '@/components/ui/order-edit-form'
import BottomNav from '@/components/ui/bottom-nav'

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await verifySession()

  const { id } = await params
  const order = await getOrderWithItems(id)
  if (!order) notFound()

  const supabase = createSupabaseClient()
  const [{ data: products }, todayPrices] = await Promise.all([
    supabase.from('products').select('id, name, sort_order').order('sort_order'),
    getTodayPrices(),
  ])

  // Build priceMap: snapshotted order prices take priority, today's prices as fallback for new products
  const priceMap: Record<string, number> = Object.fromEntries(
    (todayPrices ?? []).map(p => [p.product_id, p.price_per_kg]),
  )
  for (const item of order.order_items) {
    priceMap[item.product_id] = item.price_per_kg
  }

  const shortId = order.id.slice(0, 8)

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px 120px' }}>
        <div style={{ paddingTop: '24px', paddingBottom: '20px' }}>
          <p style={{
            margin: '0 0 2px', fontSize: '10px', fontWeight: 700,
            letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mk-text-3)',
          }}>
            Заказ #{shortId}
          </p>
          <h1 style={{
            margin: '4px 0 0', fontSize: '32px', fontWeight: 800,
            letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--mk-text)',
          }}>
            Редактирование
          </h1>
        </div>

        <OrderEditForm
          orderId={order.id}
          products={products ?? []}
          priceMap={priceMap}
          initialItems={order.order_items.map(item => ({
            product_id: item.product_id,
            boxes_count: item.boxes_count,
            weight_kg: item.weight_kg,
            price_per_kg: item.price_per_kg,
          }))}
          initialPaymentType={order.payment_type}
          initialClientId={order.client_id}
          initialClientName={order.client_name_raw}
          initialDiscountPct={order.discount_percent}
          initialManualTotal={order.manual_total}
        />
      </div>
      <BottomNav />
    </div>
  )
}
