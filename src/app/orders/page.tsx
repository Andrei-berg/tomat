import Link from 'next/link'
import { verifySession, getOrdersByDate } from '@/lib/dal'
import type { OrderRow } from '@/lib/dal'
import BottomNav from '@/components/ui/bottom-nav'

function rub(n: number) {
  return n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

function effective(o: OrderRow): number {
  if (o.manual_total != null) return o.manual_total
  const base = o.calculated_total ?? 0
  if (o.discount_percent) return Math.round(base * (1 - o.discount_percent / 100) * 100) / 100
  return base
}

const PT_LABEL: Record<string, string> = { cash: 'Нал', card: 'Карта', debt: 'Долг' }
const PT_COLOR: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  cash: { text: '#57b875', bg: 'rgba(55,175,90,0.12)', border: 'rgba(55,175,90,0.2)', bar: '#57b875' },
  card: { text: '#6090e0', bg: 'rgba(60,120,220,0.12)', border: 'rgba(60,120,220,0.2)', bar: '#6090e0' },
  debt: { text: '#d4780e', bg: 'rgba(212,120,14,0.10)', border: 'rgba(212,120,14,0.22)', bar: '#d4780e' },
}

function tStr(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function dLabel(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>
}) {
  await verifySession()

  const { date: dateParam, view } = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const dayBefore = new Date(Date.now() - 172800000).toISOString().split('T')[0]

  const isHistory = view === 'history'
  const targetDate = isHistory ? (dateParam ?? yesterday) : today
  const isYesterday = targetDate === yesterday

  const orders = await getOrdersByDate(targetDate)

  const totals = { cash: 0, card: 0, debt: 0 }
  for (const o of orders) {
    const pt = o.payment_type as keyof typeof totals
    if (pt in totals) totals[pt] += effective(o)
  }
  const grand = totals.cash + totals.card + totals.debt

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px', paddingBottom: 'calc(var(--mk-nav-h) + 32px)' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: '24px', paddingBottom: '4px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
              Журнал
            </p>
            <h1 style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--mk-text)' }}>
              Заказы
            </h1>
          </div>
          <div style={{ paddingTop: '4px' }}>
            <Link
              href="/orders/new"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '9px 16px', borderRadius: '10px',
                background: 'var(--mk-accent)', color: '#fff',
                fontSize: '14px', fontWeight: 700, textDecoration: 'none',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Новый
            </Link>
          </div>
        </div>

        {/* ── View switcher ── */}
        <div style={{
          display: 'flex', gap: '2px', marginTop: '20px',
          background: 'var(--mk-surface)', borderRadius: '10px',
          padding: '3px', border: '1px solid var(--mk-border)',
        }}>
          {[
            { label: 'Сегодня', href: '/orders', active: !isHistory },
            { label: 'История', href: '/orders?view=history', active: isHistory },
          ].map(tab => (
            <Link
              key={tab.label}
              href={tab.href}
              style={{
                flex: 1, textAlign: 'center', padding: '8px 0',
                borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                textDecoration: 'none',
                background: tab.active ? 'var(--mk-card-fill)' : 'transparent',
                color: tab.active ? 'var(--mk-text)' : 'var(--mk-text-2)',
                border: tab.active ? '1px solid var(--mk-border)' : '1px solid transparent',
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* ── History date picker ── */}
        {isHistory && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <Link href="/orders?view=history" style={{
              padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              textDecoration: 'none',
              background: isYesterday ? 'var(--mk-accent)' : 'var(--mk-card)',
              color: isYesterday ? '#fff' : 'var(--mk-text-2)',
              border: `1px solid ${isYesterday ? 'var(--mk-accent)' : 'var(--mk-border)'}`,
            }}>Вчера</Link>
            <Link href={`/orders?view=history&date=${dayBefore}`} style={{
              padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              textDecoration: 'none',
              background: targetDate === dayBefore ? 'var(--mk-accent)' : 'var(--mk-card)',
              color: targetDate === dayBefore ? '#fff' : 'var(--mk-text-2)',
              border: `1px solid ${targetDate === dayBefore ? 'var(--mk-accent)' : 'var(--mk-border)'}`,
            }}>Позавчера</Link>
            <form method="GET" action="/orders" style={{ display: 'flex', gap: '6px', flex: 1, minWidth: '160px' }}>
              <input type="hidden" name="view" value="history" />
              <input type="date" name="date"
                defaultValue={!isYesterday && targetDate !== dayBefore ? targetDate : ''}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: '8px', fontSize: '13px',
                  background: 'var(--mk-card)', color: 'var(--mk-text)',
                  border: '1px solid var(--mk-border)', outline: 'none', colorScheme: 'dark',
                }}
              />
              <button type="submit" style={{
                padding: '7px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                background: 'var(--mk-card)', color: 'var(--mk-text-2)',
                border: '1px solid var(--mk-border)', cursor: 'pointer',
              }}>→</button>
            </form>
          </div>
        )}

        {/* ── Summary dashboard card ── */}
        {orders.length > 0 && (
          <div style={{
            marginTop: '16px', padding: '20px',
            borderRadius: '16px', background: 'var(--mk-surface)',
            border: '1px solid var(--mk-border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
                  {isHistory ? dLabel(targetDate) : 'Итог дня'}
                </p>
                <p style={{ margin: '5px 0 0', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--mk-text)', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>
                  {rub(grand)}
                </p>
              </div>
              <span style={{
                fontSize: '12px', fontWeight: 600, color: 'var(--mk-text-3)',
                background: 'var(--mk-card)', border: '1px solid var(--mk-border)',
                padding: '4px 10px', borderRadius: '20px', marginTop: '2px',
              }}>
                {orders.length} заказ{orders.length === 1 ? '' : orders.length < 5 ? 'а' : 'ов'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(['cash', 'card', 'debt'] as const).map(pt => {
                if (!totals[pt]) return null
                const pct = (totals[pt] / grand) * 100
                const c = PT_COLOR[pt]
                return (
                  <div key={pt}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--mk-text-2)', fontWeight: 500 }}>{PT_LABEL[pt]}</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: c.text, fontFamily: 'var(--font-geist-mono)' }}>{rub(totals[pt])}</span>
                    </div>
                    <div style={{ height: '3px', borderRadius: '2px', background: 'var(--mk-border)' }}>
                      <div style={{ height: '3px', borderRadius: '2px', width: `${pct}%`, background: c.bar }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Orders list ── */}
        <div style={{ marginTop: '16px' }}>
          {orders.length === 0 ? (
            <div style={{
              padding: '52px 24px', textAlign: 'center',
              borderRadius: '16px', background: 'var(--mk-surface)',
              border: '1px solid var(--mk-border)',
            }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin: '0 auto 14px', display: 'block', opacity: 0.25 }}>
                <rect x="7" y="9" width="26" height="24" rx="4" stroke="var(--mk-text)" strokeWidth="2" />
                <path d="M14 9V7a6 6 0 0 1 12 0v2M14 21h12M14 27h8" stroke="var(--mk-text)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--mk-text-2)' }}>
                {isHistory ? `За ${dLabel(targetDate)} заказов нет` : 'Заказов сегодня нет'}
              </p>
              {!isHistory && (
                <Link href="/orders/new" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  marginTop: '16px', padding: '9px 18px', borderRadius: '10px',
                  background: 'var(--mk-accent)', color: '#fff',
                  fontSize: '13px', fontWeight: 700, textDecoration: 'none',
                }}>
                  Создать первый заказ
                </Link>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {orders.map((o, i) => {
                const pt = o.payment_type
                const c = PT_COLOR[pt] ?? PT_COLOR.cash
                const amt = effective(o)
                return (
                  <Link
                    key={o.id}
                    href={`/orders/${o.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', borderRadius: '12px',
                      background: 'var(--mk-card)', border: '1px solid var(--mk-border)',
                      borderLeft: `3px solid ${c.bar}`,
                      textDecoration: 'none',
                      animation: 'mkUp 0.22s both',
                      animationDelay: `${i * 0.03}s`,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--mk-text)', letterSpacing: '-0.01em' }}>
                        {o.client_name_raw ?? '—'}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--mk-text-2)' }}>
                        {tStr(o.created_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--mk-text)', letterSpacing: '-0.03em', fontFamily: 'var(--font-geist-mono)' }}>
                        {rub(amt)}
                      </span>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px',
                        background: c.bg, color: c.text, border: `1px solid ${c.border}`, letterSpacing: '0.04em',
                      }}>
                        {PT_LABEL[pt] ?? pt}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

      </div>
      <BottomNav />
    </div>
  )
}
