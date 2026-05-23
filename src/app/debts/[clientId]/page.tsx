import { notFound } from 'next/navigation'
import Link from 'next/link'
import { verifySession, getClientDebtOrders, getDebtPayments, getClientWithStats } from '@/lib/dal'
import type { DebtOrderEntry, DebtPaymentRow } from '@/lib/dal'
import DebtPayButton from '@/components/ui/debt-pay-button'
import BottomNav from '@/components/ui/bottom-nav'

function rub(n: number) {
  return n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type TimelineEvent =
  | { kind: 'order'; date: string; orderId: string; effectiveTotal: number; remaining: number; status: 'debt' | 'partial' }
  | { kind: 'payment'; date: string; orderId: string; amount: number; paymentType: 'cash' | 'card' }

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
  const totalOriginal = orders.reduce((s: number, o: DebtOrderEntry) => s + o.effectiveTotal, 0)
  const totalPaid = totalOriginal - totalRemaining
  const progressPct = totalOriginal > 0 ? Math.max(0, (totalPaid / totalOriginal) * 100) : 0

  // Build flat timeline (newest first)
  const events: TimelineEvent[] = []
  orders.forEach((order: DebtOrderEntry, i: number) => {
    events.push({
      kind: 'order',
      date: order.createdAt,
      orderId: order.orderId,
      effectiveTotal: order.effectiveTotal,
      remaining: order.remaining,
      status: order.status,
    })
    paymentHistories[i].forEach((p: DebtPaymentRow) => {
      events.push({
        kind: 'payment',
        date: p.paid_at,
        orderId: order.orderId,
        amount: p.amount,
        paymentType: p.payment_type,
      })
    })
  })
  events.sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px', paddingBottom: 'calc(var(--mk-nav-h) + 40px)' }}>

        {/* Back */}
        <div style={{ paddingTop: '20px' }}>
          <Link href="/debtors" style={{ fontSize: '13px', color: 'var(--mk-text-3)', textDecoration: 'none' }}>
            ← Расчёты
          </Link>
        </div>

        {/* Client name */}
        <div style={{ paddingTop: '12px', paddingBottom: '4px' }}>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
            Расчёты клиента
          </p>
          <h1 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--mk-text)' }}>
            {client.name}
          </h1>
        </div>

        {/* Balance card */}
        {totalRemaining > 0 ? (
          <div style={{
            marginTop: '20px', padding: '20px 20px 18px', borderRadius: '18px',
            background: 'var(--mk-amber-bg)', border: '1px solid var(--mk-amber-border)',
          }}>
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mk-amber)', opacity: 0.7 }}>
              Остаток долга
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '36px', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--mk-amber)', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>
              {rub(totalRemaining)}
            </p>

            {/* Progress bar */}
            <div style={{ marginTop: '14px', height: '6px', borderRadius: '3px', background: 'rgba(212,120,14,0.2)', overflow: 'hidden' }}>
              {totalPaid > 0.5 && (
                <div style={{
                  height: '100%', borderRadius: '3px',
                  width: `${progressPct}%`,
                  background: 'var(--mk-ok-text)',
                }} />
              )}
            </div>

            {totalPaid > 0.5 && (
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--mk-text-2)' }}>
                Получено {rub(totalPaid)} из {rub(totalOriginal)}
              </p>
            )}
            <p style={{ margin: totalPaid > 0.5 ? '2px 0 0' : '8px 0 0', fontSize: '12px', color: 'var(--mk-text-2)' }}>
              {orders.length} {orders.length === 1 ? 'операция' : orders.length < 5 ? 'операции' : 'операций'} в кредит
            </p>

            <div style={{ marginTop: '16px' }}>
              <DebtPayButton clientId={clientId} clientName={client.name} totalDebt={totalRemaining} />
            </div>
          </div>
        ) : (
          <div style={{
            marginTop: '20px', padding: '20px', borderRadius: '18px',
            background: 'var(--mk-ok-bg)', border: '1px solid var(--mk-ok-border)',
            textAlign: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--mk-ok-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 10px', display: 'block' }}>
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--mk-ok-text)' }}>Расчёт закрыт</p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--mk-text-3)' }}>Все расчёты закрыты</p>
          </div>
        )}

        {/* Timeline */}
        {events.length > 0 && (
          <div style={{ marginTop: '28px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
              История
            </p>

            <div style={{ position: 'relative' }}>
              {/* Vertical line */}
              <div style={{
                position: 'absolute', left: '19px', top: '8px', bottom: '8px', width: '2px',
                background: 'var(--mk-border)',
              }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {events.map((ev, i) => (
                  <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    {/* Timeline dot */}
                    <div style={{ flexShrink: 0, marginTop: '14px', position: 'relative', zIndex: 1 }}>
                      <div style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: ev.kind === 'payment' ? 'var(--mk-ok-text)' : 'var(--mk-amber)',
                        border: `2px solid var(--mk-bg)`,
                        marginLeft: '5px',
                      }} />
                    </div>

                    {/* Event card */}
                    <div style={{
                      flex: 1, padding: '12px 14px', borderRadius: '14px',
                      background: 'var(--mk-card)', border: '1px solid var(--mk-border)',
                      marginBottom: '6px',
                    }}>
                      {ev.kind === 'order' ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--mk-text)' }}>
                              Отпущено в кредит
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--mk-text-3)' }}>
                              {formatDate(ev.date)}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--mk-amber)', fontFamily: 'var(--font-geist-mono)' }}>
                              {rub(ev.effectiveTotal)}
                            </p>
                            {ev.remaining < ev.effectiveTotal && (
                              <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--mk-text-3)' }}>
                                остаток {rub(ev.remaining)}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--mk-ok-text)' }}>
                              Оплата получена
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--mk-text-3)' }}>
                              {formatDateTime(ev.date)} · {ev.paymentType === 'cash' ? 'Наличные' : 'Карта'}
                            </p>
                          </div>
                          <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--mk-ok-text)', fontFamily: 'var(--font-geist-mono)' }}>
                            +{rub(ev.amount)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
