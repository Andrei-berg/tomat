import Link from 'next/link'
import { verifySession, getOrdersByDate } from '@/lib/dal'
import type { OrderRow } from '@/lib/dal'
import NavBar from '@/components/ui/nav-bar'

function formatRub(amount: number): string {
  return amount.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  })
}

function getEffective(o: OrderRow): number {
  if (o.manual_total != null) return o.manual_total
  const base = o.calculated_total ?? 0
  if (o.discount_percent) {
    return Math.round(base * (1 - o.discount_percent / 100) * 100) / 100
  }
  return base
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Нал',
  card: 'Карта',
  debt: 'Долг',
}

const PAYMENT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  cash: {
    bg: 'rgba(55, 175, 90, 0.12)',
    color: '#57b875',
    border: 'rgba(55, 175, 90, 0.2)',
  },
  card: {
    bg: 'rgba(60, 120, 220, 0.12)',
    color: '#6090e0',
    border: 'rgba(60, 120, 220, 0.2)',
  },
  debt: {
    bg: 'rgba(200, 170, 0, 0.12)',
    color: '#c8a200',
    border: 'rgba(200, 170, 0, 0.2)',
  },
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  await verifySession()

  const { date: dateParam } = await searchParams

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const targetDate = dateParam ?? today

  const isToday = targetDate === today
  const isYesterday = targetDate === yesterday

  const orders = await getOrdersByDate(targetDate)

  const dayTotals = { cash: 0, card: 0, debt: 0 }
  for (const o of orders) {
    const pt = o.payment_type as keyof typeof dayTotals
    if (pt in dayTotals) {
      dayTotals[pt] += getEffective(o)
    }
  }
  const grandTotal = dayTotals.cash + dayTotals.card + dayTotals.debt

  const displayDate = new Date(targetDate + 'T12:00:00').toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

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

        {/* ── Header ─────────────────────────────────── */}
        <header style={{ paddingBottom: '24px' }}>
          <p style={{
            margin: '0 0 10px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--mk-text-3)',
          }}>
            Журнал
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}>
            <h1 style={{
              margin: 0,
              fontSize: '34px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: 'var(--mk-text)',
            }}>
              Заказы
            </h1>
            <Link
              href="/orders/new"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: 'var(--mk-accent)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                letterSpacing: '-0.01em',
              }}
            >
              + Новый заказ
            </Link>
          </div>

          <div style={{
            height: '1px',
            background: 'var(--mk-border)',
            marginTop: '22px',
          }} />
        </header>

        {/* ── Day switcher ───────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}>
          <Link
            href="/orders"
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              background: isToday ? 'var(--mk-accent)' : 'var(--mk-card)',
              color: isToday ? '#fff' : 'var(--mk-text-2)',
              border: `1px solid ${isToday ? 'var(--mk-accent)' : 'var(--mk-border)'}`,
            }}
          >
            Сегодня
          </Link>
          <Link
            href={`/orders?date=${yesterday}`}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              background: isYesterday ? 'var(--mk-accent)' : 'var(--mk-card)',
              color: isYesterday ? '#fff' : 'var(--mk-text-2)',
              border: `1px solid ${isYesterday ? 'var(--mk-accent)' : 'var(--mk-border)'}`,
            }}
          >
            Вчера
          </Link>
          <form method="GET" action="/orders" style={{ display: 'flex', gap: '6px' }}>
            <input
              type="date"
              name="date"
              defaultValue={!isToday && !isYesterday ? targetDate : ''}
              onChange={undefined}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                background: (!isToday && !isYesterday) ? 'var(--mk-card-fill)' : 'var(--mk-card)',
                color: (!isToday && !isYesterday) ? 'var(--mk-text)' : 'var(--mk-text-2)',
                border: `1px solid ${(!isToday && !isYesterday) ? 'var(--mk-accent)' : 'var(--mk-border)'}`,
                outline: 'none',
                colorScheme: 'dark',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                background: 'var(--mk-card)',
                color: 'var(--mk-text-2)',
                border: '1px solid var(--mk-border)',
                cursor: 'pointer',
              }}
            >
              →
            </button>
          </form>
        </div>

        {/* ── Date label (if not today) ──────────────── */}
        {!isToday && (
          <p style={{
            margin: '0 0 16px',
            fontSize: '13px',
            color: 'var(--mk-text-2)',
            fontWeight: 500,
          }}>
            {displayDate}
          </p>
        )}

        {/* ── Orders list ────────────────────────────── */}
        {orders.length === 0 ? (
          <div style={{
            padding: '40px 0',
            textAlign: 'center',
            color: 'var(--mk-text-3)',
            fontSize: '15px',
          }}>
            Заказов за этот день нет
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {orders.map((o) => {
              const pt = o.payment_type
              const ptColors = PAYMENT_COLORS[pt] ?? PAYMENT_COLORS.cash
              const timeStr = new Date(o.created_at).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })
              const clientName = o.client_name_raw ?? '—'
              const amount = getEffective(o)

              return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--mk-card)',
                    border: '1px solid var(--mk-border)',
                    textDecoration: 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={undefined}
                >
                  {/* Left */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--mk-text)',
                      letterSpacing: '-0.01em',
                    }}>
                      {clientName}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--mk-text-2)',
                    }}>
                      {timeStr}
                    </span>
                  </div>

                  {/* Right */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '4px',
                  }}>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--mk-text)',
                      letterSpacing: '-0.02em',
                    }}>
                      {formatRub(amount)}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: ptColors.bg,
                      color: ptColors.color,
                      border: `1px solid ${ptColors.border}`,
                    }}>
                      {PAYMENT_LABELS[pt] ?? pt}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* ── Day totals ─────────────────────────────── */}
        {orders.length > 0 && (
          <div style={{
            marginTop: '24px',
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'var(--mk-surface)',
            border: '1px solid var(--mk-border)',
          }}>
            <p style={{
              margin: '0 0 12px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--mk-text-3)',
            }}>
              Итог дня
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--mk-text-2)' }}>Нал</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#57b875' }}>
                  {formatRub(dayTotals.cash)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--mk-text-2)' }}>Карта</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#6090e0' }}>
                  {formatRub(dayTotals.card)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--mk-text-2)' }}>Долг</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#c8a200' }}>
                  {formatRub(dayTotals.debt)}
                </span>
              </div>
              <div style={{
                height: '1px',
                background: 'var(--mk-border)',
                margin: '4px 0',
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--mk-text)' }}>
                  Итого
                </span>
                <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--mk-text)', letterSpacing: '-0.02em' }}>
                  {formatRub(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
