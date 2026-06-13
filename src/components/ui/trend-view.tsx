'use client'

import { useState } from 'react'
import type { SegmentTrend, SegmentMetrics, ClientSegment } from '@/lib/dal'
import PeriodControls from '@/components/ui/period-controls'

function rub(n: number): string {
  return n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

// Compact currency for dense table cells: 12 500 → «12,5к», 1 200 000 → «1,2М».
function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + 'М'
  if (n >= 10_000) return Math.round(n / 1000) + 'к'
  if (n >= 1_000) return (n / 1000).toFixed(1).replace('.', ',') + 'к'
  return String(Math.round(n))
}

type Metric = 'revenue' | 'orders' | 'debt'

const SEGMENTS: { key: ClientSegment; label: string; color: string }[] = [
  { key: 'anonymous', label: 'Аноним', color: 'var(--mk-text-3)' },
  { key: 'occasional', label: 'Разовые', color: '#d4780e' },
  { key: 'regular', label: 'Постоянные', color: '#57b875' },
]

const METRICS: { key: Metric; label: string }[] = [
  { key: 'revenue', label: 'Выручка' },
  { key: 'orders', label: 'Заказы' },
  { key: 'debt', label: 'Долг' },
]

function metricValue(m: SegmentMetrics, metric: Metric): number {
  return metric === 'orders' ? m.orders : metric === 'debt' ? m.debt : m.revenue
}

function fmtCell(v: number, metric: Metric): string {
  if (v === 0) return '—'
  return metric === 'orders' ? String(v) : compact(v)
}

export default function TrendView({ data, from, to }: { data: SegmentTrend; from: string; to: string }) {
  const [metric, setMetric] = useState<Metric>('revenue')
  const { totals, buckets, granularity } = data

  const grandRevenue = SEGMENTS.reduce((s, seg) => s + totals[seg.key].revenue, 0)

  const sectionTitle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 600, color: 'var(--mk-text-2)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: '8px', marginTop: '24px',
  }

  return (
    <div>
      <p style={sectionTitle}>Период</p>
      <PeriodControls from={from} to={to} basePath="/report/trend" />

      {/* ── Segment summary ── */}
      <p style={sectionTitle}>По типу клиента</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {SEGMENTS.map(seg => {
          const m = totals[seg.key]
          return (
            <div
              key={seg.key}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px', borderRadius: '12px',
                background: 'var(--mk-surface)', border: '1px solid var(--mk-border)',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--mk-text)' }}>{seg.label}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--mk-text-3)' }}>
                  {m.orders} заказ{m.orders === 1 ? '' : m.orders > 1 && m.orders < 5 ? 'а' : 'ов'}
                  {m.debt > 0 && <> · долг {rub(m.debt)}</>}
                </p>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--mk-text)', fontFamily: 'var(--font-geist-mono)', letterSpacing: '-0.02em' }}>
                {rub(m.revenue)}
              </span>
            </div>
          )
        })}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px', borderRadius: '12px',
          background: 'rgba(200,67,26,0.05)', border: '1px solid var(--mk-border)',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--mk-text)' }}>Итого получено</span>
          <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--mk-accent)', fontFamily: 'var(--font-geist-mono)', letterSpacing: '-0.02em' }}>
            {rub(grandRevenue)}
          </span>
        </div>
      </div>

      {/* ── Trend over time ── */}
      <p style={sectionTitle}>Динамика {granularity === 'day' ? 'по дням' : 'по месяцам'}</p>

      {/* Metric toggle */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '10px', background: 'var(--mk-surface)', border: '1px solid var(--mk-border)', marginBottom: '10px' }}>
        {METRICS.map(mt => {
          const active = mt.key === metric
          return (
            <button
              key={mt.key}
              type="button"
              onClick={() => setMetric(mt.key)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: '7px', border: 'none',
                fontSize: '13px', fontWeight: active ? 700 : 500, cursor: 'pointer',
                color: active ? '#fff' : 'var(--mk-text-2)',
                background: active ? 'var(--mk-accent)' : 'transparent',
                fontFamily: 'var(--font-geist-sans)',
              }}
            >
              {mt.label}
            </button>
          )
        })}
      </div>

      {buckets.length === 0 ? (
        <p style={{ color: 'var(--mk-text-3)', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
          Нет заказов за выбранный период
        </p>
      ) : (
        <div style={{ background: 'var(--mk-surface)', border: '1px solid var(--mk-border)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', padding: '10px 14px', fontSize: '11px', color: 'var(--mk-text-3)', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--mk-border)' }}>
            <span style={{ flex: 1.4 }}>{granularity === 'day' ? 'День' : 'Месяц'}</span>
            {SEGMENTS.map(s => (
              <span key={s.key} style={{ flex: 1, textAlign: 'right', color: s.color, fontWeight: 600 }}>{s.label}</span>
            ))}
            <span style={{ flex: 1, textAlign: 'right', fontWeight: 700 }}>Итого</span>
          </div>
          {/* Rows */}
          {buckets.map((b, i) => {
            const rowTotal = SEGMENTS.reduce((s, seg) => s + metricValue(b[seg.key], metric), 0)
            return (
              <div
                key={b.key}
                style={{
                  display: 'flex', padding: '10px 14px', fontSize: '13px', alignItems: 'center',
                  borderBottom: i === buckets.length - 1 ? 'none' : '1px solid var(--mk-border)',
                }}
              >
                <span style={{ flex: 1.4, color: 'var(--mk-text)', fontWeight: 500 }}>{b.label}</span>
                {SEGMENTS.map(seg => {
                  const v = metricValue(b[seg.key], metric)
                  return (
                    <span key={seg.key} style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v === 0 ? 'var(--mk-text-3)' : 'var(--mk-text)' }}>
                      {fmtCell(v, metric)}
                    </span>
                  )
                })}
                <span style={{ flex: 1, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--mk-text)' }}>
                  {fmtCell(rowTotal, metric)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <p style={{ fontSize: '11px', color: 'var(--mk-text-3)', marginTop: '10px', lineHeight: 1.4 }}>
        {metric === 'debt'
          ? 'Долг — непогашенный остаток по заказам за период.'
          : metric === 'orders'
            ? 'Количество заказов в каждом сегменте.'
            : 'Выручка — фактически полученные деньги (нал/карта + погашение кредита). Суммы в таблице сокращены (к/М).'}
      </p>
    </div>
  )
}
