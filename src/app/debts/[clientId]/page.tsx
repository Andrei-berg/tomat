import { notFound } from 'next/navigation'
import Link from 'next/link'
import { verifySession, getClientDebtOrders, getDebtPayments, getClientWithStats } from '@/lib/dal'
import type { DebtOrderEntry, DebtPaymentRow } from '@/lib/dal'
import PaymentForm from '@/components/ui/payment-form'
import BottomNav from '@/components/ui/bottom-nav'

function rub(n: number) {
  return n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function DebtDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  await verifySession()

  const [client, orders] = await Promise.all([
    getClientWithStats(clientId),
    getClientDebtOrders(clientId),
  ])

  if (!client) notFound()

  const paymentHistories = await Promise.all(orders.map((o: DebtOrderEntry) => getDebtPayments(o.orderId)))

  const totalRemaining = orders.reduce((s: number, o: DebtOrderEntry) => s + o.remaining, 0)

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px', paddingBottom: 'calc(var(--mk-nav-h) + 32px)' }}>

        {/* Back link */}
        <div style={{ paddingTop: '20px' }}>
          <Link href="/debtors" style={{ fontSize: '13px', color: 'var(--mk-text-3)', textDecoration: 'none' }}>
            ← Должники
          </Link>
        </div>

        {/* Header */}
        <div style={{ paddingTop: '12px', paddingBottom: '4px' }}>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
            Долги клиента
          </p>
          <h1 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--mk-text)' }}>
            {client.name}
          </h1>
        </div>

        {/* Total remaining banner */}
        {totalRemaining > 0 && (
          <div style={{
            marginTop: '16px', padding: '16px 20px', borderRadius: '14px',
            background: 'var(--mk-amber-bg)', border: '1px solid var(--mk-amber-border)',
          }}>
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mk-amber)', opacity: 0.7 }}>
              Остаток долга
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '30px', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--mk-amber)', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>
              {rub(totalRemaining)}
            </p>
          </div>
        )}

        {/* Orders list */}
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {orders.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', borderRadius: '14px', background: 'var(--mk-surface)', border: '1px solid var(--mk-border)' }}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--mk-text-2)' }}>Все долги погашены</p>
            </div>
          ) : (
            orders.map((order: DebtOrderEntry, i: number) => {
              const history: DebtPaymentRow[] = paymentHistories[i]
              return (
                <div key={order.orderId} style={{
                  padding: '16px 18px', borderRadius: '14px',
                  background: 'var(--mk-card)', border: '1px solid var(--mk-border)',
                  borderLeft: '3px solid var(--mk-amber)',
                }}>
                  {/* Order meta */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--mk-text-3)' }}>
                        {formatDate(order.createdAt)}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--mk-text-3)' }}>
                        Итог: {rub(order.effectiveTotal)}
                        {order.paidTotal > 0 && ` · Уплачено: ${rub(order.paidTotal)}`}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--mk-amber)', fontFamily: 'var(--font-geist-mono)', letterSpacing: '-0.03em' }}>
                        {rub(order.remaining)}
                      </p>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px',
                        background: order.status === 'partial' ? 'var(--mk-amber-bg)' : 'rgba(239,68,68,0.1)',
                        color: order.status === 'partial' ? 'var(--mk-amber)' : '#ef4444',
                      }}>
                        {order.status === 'partial' ? 'Частично' : 'Долг'}
                      </span>
                    </div>
                  </div>

                  {/* Payment history */}
                  {history.length > 0 && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--mk-border)' }}>
                      <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
                        История погашений
                      </p>
                      {history.map((p: DebtPaymentRow) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}>
                          <span style={{ color: 'var(--mk-text-2)' }}>
                            {new Date(p.paid_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · {p.payment_type === 'cash' ? 'Наличные' : 'Карта'}
                          </span>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 600, color: 'var(--mk-text)' }}>
                            {rub(p.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline payment form */}
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--mk-border)' }}>
                    <PaymentForm orderId={order.orderId} clientId={clientId} maxAmount={order.remaining} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
