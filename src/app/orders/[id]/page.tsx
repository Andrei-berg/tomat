import { notFound } from 'next/navigation'
import { verifySession, getOrderWithItems } from '@/lib/dal'
import type { OrderWithItems } from '@/lib/dal'
import BottomNav from '@/components/ui/bottom-nav'

function formatRub(amount: number): string {
  return amount.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  })
}

function getEffective(order: OrderWithItems): number {
  if (order.manual_total != null) return order.manual_total
  const base = order.calculated_total ?? 0
  if (order.discount_percent) {
    return Math.round(base * (1 - order.discount_percent / 100) * 100) / 100
  }
  return base
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Наличные',
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

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await verifySession()

  const { id } = await params
  const order = await getOrderWithItems(id)

  if (!order) {
    notFound()
  }

  const pt = order.payment_type
  const ptColors = PAYMENT_COLORS[pt] ?? PAYMENT_COLORS.cash
  const effective = getEffective(order)
  const calculated = order.calculated_total ?? 0

  const createdAt = new Date(order.created_at)
  const dateStr = createdAt.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = createdAt.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const shortId = order.id.slice(0, 8)

  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'var(--mk-bg)',
        fontFamily: 'var(--font-geist-sans)',
      }}
    >
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px', paddingBottom: 'calc(var(--mk-nav-h) + 32px)' }}>

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
            Заказ
          </p>

          <h1 style={{
            margin: 0,
            fontSize: '34px',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            color: 'var(--mk-text)',
          }}>
            #{shortId}
          </h1>

          <div style={{
            height: '1px',
            background: 'var(--mk-border)',
            marginTop: '22px',
          }} />
        </header>

        {/* ── Meta block ─────────────────────────────── */}
        <div style={{
          padding: '18px 20px',
          borderRadius: '14px',
          background: 'var(--mk-card)',
          border: '1px solid var(--mk-border)',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {/* Date & time */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--mk-text-2)' }}>Дата</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mk-text)' }}>
              {dateStr}, {timeStr}
            </span>
          </div>

          {/* Client */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--mk-text-2)' }}>Клиент</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mk-text)' }}>
              {order.client_name_raw ?? '—'}
            </span>
          </div>

          {/* Payment type */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--mk-text-2)' }}>Оплата</span>
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '6px',
              background: ptColors.bg,
              color: ptColors.color,
              border: `1px solid ${ptColors.border}`,
            }}>
              {PAYMENT_LABELS[pt] ?? pt}
            </span>
          </div>

          {/* Notes if any */}
          {order.notes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '13px', color: 'var(--mk-text-2)' }}>Примечание</span>
              <span style={{ fontSize: '14px', color: 'var(--mk-text)', lineHeight: 1.4 }}>
                {order.notes}
              </span>
            </div>
          )}
        </div>

        {/* ── Order items ────────────────────────────── */}
        <p style={{
          margin: '0 0 10px',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--mk-text-3)',
        }}>
          Позиции
        </p>

        {order.order_items.length === 0 ? (
          <div style={{
            padding: '24px',
            textAlign: 'center',
            color: 'var(--mk-text-3)',
            fontSize: '14px',
            background: 'var(--mk-card)',
            borderRadius: '12px',
            border: '1px solid var(--mk-border)',
            marginBottom: '16px',
          }}>
            Нет позиций
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '16px',
          }}>
            {order.order_items.map((item) => {
              const lineTotal = item.line_total ?? 0

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: 'var(--mk-card)',
                    border: '1px solid var(--mk-border)',
                  }}
                >
                  {/* Product name */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
                  }}>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--mk-text)',
                      letterSpacing: '-0.01em',
                    }}>
                      {item.product_name}
                    </span>
                    <span style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--mk-text)',
                      letterSpacing: '-0.02em',
                    }}>
                      {formatRub(lineTotal)}
                    </span>
                  </div>

                  {/* Details row */}
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: '12px', color: 'var(--mk-text-2)' }}>
                      Ящики: <strong style={{ color: 'var(--mk-text)' }}>{item.boxes_count}</strong>
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--mk-text-2)' }}>
                      Вес: <strong style={{ color: 'var(--mk-text)' }}>{item.weight_kg} кг</strong>
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--mk-text-2)' }}>
                      Цена: <strong style={{ color: 'var(--mk-text)' }}>{formatRub(item.price_per_kg)} /кг</strong>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Totals ─────────────────────────────────── */}
        <div style={{
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
            Итог
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: 'var(--mk-text-2)' }}>Расчётный итог</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mk-text)' }}>
                {formatRub(calculated)}
              </span>
            </div>

            {order.discount_percent != null && order.discount_percent > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--mk-text-2)' }}>Скидка</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#c8a200' }}>
                  {order.discount_percent}%
                </span>
              </div>
            )}

            {order.manual_total != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--mk-text-2)' }}>Ручной итог</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mk-text)' }}>
                  {formatRub(order.manual_total)}
                </span>
              </div>
            )}

            <div style={{
              height: '1px',
              background: 'var(--mk-border)',
              margin: '4px 0',
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--mk-text)' }}>
                Итого
              </span>
              <span style={{
                fontSize: '20px',
                fontWeight: 800,
                color: 'var(--mk-text)',
                letterSpacing: '-0.03em',
              }}>
                {formatRub(effective)}
              </span>
            </div>
          </div>
        </div>

      </div>
      <BottomNav />
    </div>
  )
}
