import Link from 'next/link'
import { notFound } from 'next/navigation'
import { verifySession, getClientWithStats, getClientOrders } from '@/lib/dal'
import { setClientRegular } from '@/app/actions/clients'
import BottomNav from '@/components/ui/bottom-nav'

function rub(n: number) {
  return n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = ['#c8431a', '#d4780e', '#57b875', '#6090e0', '#9060d0', '#d04080']
function avatarColor(name: string): string {
  const code = (name.charCodeAt(0) ?? 0) + (name.charCodeAt(1) ?? 0)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

const PT_LABEL: Record<string, string> = { cash: 'Нал', card: 'Карта', debt: 'Кредит' }
const PT_BAR: Record<string, string> = { cash: '#57b875', card: '#6090e0', debt: '#d4780e' }

function effective(o: { manual_total: number | null; calculated_total: number | null; discount_percent: number | null }): number {
  if (o.manual_total != null) return o.manual_total
  const base = o.calculated_total ?? 0
  if (o.discount_percent) return Math.round(base * (1 - o.discount_percent / 100) * 100) / 100
  return base
}

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await verifySession()
  const { id } = await params

  const [client, orders] = await Promise.all([
    getClientWithStats(id),
    getClientOrders(id),
  ])

  if (!client) notFound()

  const color = avatarColor(client.name)
  const avgOrder = client.orderCount > 0 ? client.totalSpent / client.orderCount : 0

  // Group orders by month
  const byMonth = new Map<string, typeof orders>()
  for (const o of orders) {
    const key = new Date(o.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    const arr = byMonth.get(key) ?? []
    arr.push(o)
    byMonth.set(key, arr)
  }

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px', paddingBottom: 'calc(var(--mk-nav-h) + 32px)' }}>

        {/* ── Back ── */}
        <div style={{ paddingTop: '20px', paddingBottom: '16px' }}>
          <Link href="/clients" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '13px', color: 'var(--mk-text-2)', textDecoration: 'none', fontWeight: 500,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Клиенты
          </Link>
        </div>

        {/* ── Profile header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '18px', flexShrink: 0,
            background: `${color}22`, border: `1.5px solid ${color}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: 800, color, letterSpacing: '-0.02em',
          }}>
            {initials(client.name)}
          </div>
          <div style={{ flex: 1, paddingTop: '2px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--mk-text)', lineHeight: 1.1 }}>
              {client.name}
            </h1>
            {!client.is_regular && (
              <span style={{
                display: 'inline-block', marginTop: '6px',
                fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                background: 'var(--mk-surface)', color: 'var(--mk-text-3)',
                border: '1px solid var(--mk-border)', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                Разовый клиент
              </span>
            )}
            {client.phone && (
              <a href={`tel:${client.phone}`} style={{ display: 'block', marginTop: '6px', fontSize: '14px', color: 'var(--mk-text-2)', textDecoration: 'none', fontWeight: 500 }}>
                {client.phone}
              </a>
            )}
            {client.notes && (
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--mk-text-2)', lineHeight: 1.4 }}>
                {client.notes}
              </p>
            )}
          </div>
          <Link
            href={`/clients/${id}/edit`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              border: '1px solid var(--mk-border)', background: 'var(--mk-card)',
              color: 'var(--mk-text-2)', textDecoration: 'none',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M10.5 2.5a2.121 2.121 0 0 1 3 3L5 14H2v-3L10.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* ── Promote occasional → regular ── */}
        {!client.is_regular && (
          <form
            action={async () => {
              'use server'
              await setClientRegular(id, true)
            }}
            style={{ marginBottom: '24px' }}
          >
            <button
              type="submit"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', padding: '12px', borderRadius: '12px',
                background: 'var(--mk-card)', border: '1px solid var(--mk-border)',
                color: 'var(--mk-text)', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-geist-sans)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M7.5 1.5l1.6 3.9 4.2.3-3.2 2.7 1 4.1-3.6-2.3-3.6 2.3 1-4.1L1.7 5.7l4.2-.3 1.6-3.9z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              Сделать постоянным
            </button>
          </form>
        )}

        {/* ── Stats grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
          {[
            { label: 'Заказов', value: String(client.orderCount), mono: false },
            { label: 'Потрачено', value: rub(client.totalSpent), mono: true },
            { label: 'Средний чек', value: rub(avgOrder), mono: true },
            { label: 'К получению', value: client.debtAmount > 0 ? rub(client.debtAmount) : '—', mono: true, highlight: client.debtAmount > 0 },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                padding: '16px 18px',
                borderRadius: '14px',
                background: stat.highlight ? 'var(--mk-amber-bg)' : 'var(--mk-surface)',
                border: `1px solid ${stat.highlight ? 'var(--mk-amber-border)' : 'var(--mk-border)'}`,
              }}
            >
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: stat.highlight ? 'var(--mk-amber)' : 'var(--mk-text-3)' }}>
                {stat.label}
              </p>
              <p style={{
                margin: '6px 0 0', fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1,
                color: stat.highlight ? 'var(--mk-amber)' : 'var(--mk-text)',
                fontFamily: stat.mono ? 'var(--font-geist-mono)' : 'var(--font-geist-sans)',
              }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── CTA: New order ── */}
        <Link
          href={`/orders/new?clientId=${id}&clientName=${encodeURIComponent(client.name)}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '14px', borderRadius: '14px',
            background: 'var(--mk-accent)', color: '#fff',
            fontSize: '15px', fontWeight: 700, textDecoration: 'none',
            letterSpacing: '-0.01em', marginBottom: '28px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Новый заказ для {client.name.split(' ')[0]}
        </Link>

        {/* ── Order history ── */}
        {orders.length === 0 ? (
          <div style={{
            padding: '40px 24px', textAlign: 'center',
            borderRadius: '16px', background: 'var(--mk-surface)', border: '1px solid var(--mk-border)',
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--mk-text-2)' }}>Заказов пока нет</p>
          </div>
        ) : (
          <>
            <p style={{ margin: '0 0 12px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
              История заказов
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {Array.from(byMonth.entries()).map(([month, monthOrders]) => (
                <div key={month}>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
                    {month}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {monthOrders.map(o => {
                      const pt = o.payment_type
                      const bar = PT_BAR[pt] ?? PT_BAR.cash
                      const amt = effective(o)
                      return (
                        <Link
                          key={o.id}
                          href={`/orders/${o.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 14px', borderRadius: '12px',
                            background: 'var(--mk-card)', border: '1px solid var(--mk-border)',
                            borderLeft: `3px solid ${bar}`, textDecoration: 'none',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mk-text)' }}>
                              {fmtDate(o.created_at)}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--mk-text-3)' }}>
                              {fmtTime(o.created_at)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: bar }}>
                              {PT_LABEL[pt] ?? pt}
                            </span>
                            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--mk-text)', fontFamily: 'var(--font-geist-mono)', letterSpacing: '-0.03em' }}>
                              {rub(amt)}
                            </span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
