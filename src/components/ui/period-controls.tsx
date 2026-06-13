'use client'

import { useRouter } from 'next/navigation'

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export type Preset = { key: string; label: string; from: string; to: string }

export function periodPresets(): Preset[] {
  const today = new Date()
  const t = iso(today)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 6)
  const firstOfMonth = t.slice(0, 8) + '01'
  return [
    { key: 'today', label: 'Сегодня', from: t, to: t },
    { key: 'yesterday', label: 'Вчера', from: iso(yesterday), to: iso(yesterday) },
    { key: 'week', label: 'Неделя', from: iso(weekAgo), to: t },
    { key: 'month', label: 'Месяц', from: firstOfMonth, to: t },
  ]
}

const dateInputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '4px',
  padding: '8px 10px',
  borderRadius: '8px',
  border: '1px solid var(--mk-border)',
  background: 'var(--mk-surface)',
  color: 'var(--mk-text)',
  fontSize: '14px',
  colorScheme: 'dark',
}

export default function PeriodControls({
  from,
  to,
  basePath,
}: {
  from: string
  to: string
  basePath: string
}) {
  const router = useRouter()
  const presets = periodPresets()

  function go(f: string, t: string) {
    router.push(`${basePath}?from=${f}&to=${t}`)
  }

  return (
    <div>
      {/* Quick presets */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {presets.map(p => {
          const active = p.from === from && p.to === to
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => go(p.from, p.to)}
              style={{
                flex: '1 1 0',
                padding: '7px 4px',
                borderRadius: '8px',
                border: `1px solid ${active ? 'var(--mk-accent)' : 'var(--mk-border)'}`,
                background: active ? 'rgba(200,67,26,0.10)' : 'var(--mk-surface)',
                color: active ? 'var(--mk-accent)' : 'var(--mk-text-2)',
                fontSize: '13px',
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                fontFamily: 'var(--font-geist-sans)',
                whiteSpace: 'nowrap',
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Manual range */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <label style={{ flex: 1, fontSize: '13px', color: 'var(--mk-text-2)' }}>
          С
          <input type="date" value={from} max={to} onChange={e => go(e.target.value, to)} style={dateInputStyle} />
        </label>
        <label style={{ flex: 1, fontSize: '13px', color: 'var(--mk-text-2)' }}>
          По
          <input type="date" value={to} min={from} onChange={e => go(from, e.target.value)} style={dateInputStyle} />
        </label>
      </div>
    </div>
  )
}
