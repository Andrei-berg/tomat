'use client'

import type { ReportData } from '@/lib/dal'
import PeriodControls from '@/components/ui/period-controls'

function formatRub(n: number): string {
  return n.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  })
}

export default function ReportForm({
  data,
  from,
  to,
}: {
  data: ReportData
  from: string
  to: string
}) {
  const { paymentSummary: ps, productRows } = data
  const totalRevenue = ps.cash + ps.card

  const sectionTitle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--mk-text-2)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
    marginTop: '24px',
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--mk-surface)',
    border: '1px solid var(--mk-border)',
    borderRadius: '12px',
    overflow: 'hidden',
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    borderBottom: '1px solid var(--mk-border)',
    fontSize: '14px',
  }

  const lastRowStyle: React.CSSProperties = {
    ...rowStyle,
    borderBottom: 'none',
  }

  const labelStyle: React.CSSProperties = { color: 'var(--mk-text-2)' }
  const valueStyle: React.CSSProperties = {
    fontWeight: 600,
    color: 'var(--mk-text)',
    fontVariantNumeric: 'tabular-nums',
  }

  const exportUrl = (format: 'excel' | 'pdf') =>
    `/api/report/${format}?from=${from}&to=${to}`

  return (
    <div>
      {/* Period selection (presets + manual range) */}
      <p style={sectionTitle}>Период</p>
      <PeriodControls from={from} to={to} basePath="/report" />

      {/* Revenue by payment type */}
      <p style={sectionTitle}>Выручка</p>
      <div style={cardStyle}>
        <div style={rowStyle}>
          <span style={labelStyle}>Наличные</span>
          <span style={valueStyle}>{formatRub(ps.cash)}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Карта</span>
          <span style={valueStyle}>{formatRub(ps.card)}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>В кредит (не получено)</span>
          <span style={{ ...valueStyle, color: 'var(--mk-accent)' }}>{formatRub(ps.debtUnpaid)}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>В кредит (получено)</span>
          <span style={valueStyle}>{formatRub(ps.debtReceived)}</span>
        </div>
        <div style={{ ...lastRowStyle, borderTop: '1px solid var(--mk-border)', background: 'rgba(200,67,26,0.04)' }}>
          <span style={{ ...labelStyle, fontWeight: 600, color: 'var(--mk-text)' }}>Итого получено</span>
          <span style={{ ...valueStyle, fontSize: '16px' }}>{formatRub(totalRevenue + ps.debtReceived)}</span>
        </div>
      </div>

      {/* Product breakdown */}
      {productRows.length > 0 && (
        <>
          <p style={sectionTitle}>По товарам</p>
          <div style={cardStyle}>
            {/* Header row */}
            <div style={{ ...rowStyle, background: 'rgba(255,255,255,0.03)', fontSize: '12px', color: 'var(--mk-text-3)' }}>
              <span style={{ flex: 2 }}>Товар</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Ящики</span>
              <span style={{ flex: 1, textAlign: 'right' }}>кг</span>
              <span style={{ flex: 1.5, textAlign: 'right' }}>Сумма</span>
            </div>
            {productRows.map((row, i) => {
              const isLast = i === productRows.length - 1
              return (
                <div key={row.productId} style={isLast ? lastRowStyle : rowStyle}>
                  <span style={{ flex: 2, color: 'var(--mk-text)' }}>{row.productName}</span>
                  <span style={{ flex: 1, textAlign: 'right', ...valueStyle }}>{row.totalBoxes}</span>
                  <span style={{ flex: 1, textAlign: 'right', ...valueStyle }}>{row.totalKg.toFixed(1)}</span>
                  <span style={{ flex: 1.5, textAlign: 'right', ...valueStyle }}>{formatRub(row.totalAmount)}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {productRows.length === 0 && (
        <p style={{ color: 'var(--mk-text-3)', fontSize: '14px', marginTop: '24px', textAlign: 'center' }}>
          Нет заказов за выбранный период
        </p>
      )}

      {/* Export buttons */}
      <p style={sectionTitle}>Экспорт</p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <a
          href={exportUrl('excel')}
          download
          style={{
            flex: 1,
            display: 'block',
            textAlign: 'center',
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid var(--mk-border)',
            background: 'var(--mk-surface)',
            color: 'var(--mk-text)',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
            fontFamily: 'var(--font-geist-sans)',
          }}
        >
          Excel (.xlsx)
        </a>
        <a
          href={exportUrl('pdf')}
          download
          style={{
            flex: 1,
            display: 'block',
            textAlign: 'center',
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid var(--mk-border)',
            background: 'var(--mk-surface)',
            color: 'var(--mk-text)',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
            fontFamily: 'var(--font-geist-sans)',
          }}
        >
          PDF
        </a>
      </div>
    </div>
  )
}
