import Link from 'next/link'

// Segmented control switching between the period summary (/report) and the
// client-segment dynamics (/report/trend). Period is carried over in the query.
export default function ReportTabs({
  active,
  from,
  to,
}: {
  active: 'summary' | 'trend'
  from: string
  to: string
}) {
  const q = `?from=${from}&to=${to}`
  const tabs: { key: 'summary' | 'trend'; label: string; href: string }[] = [
    { key: 'summary', label: 'Сводка', href: `/report${q}` },
    { key: 'trend', label: 'Динамика', href: `/report/trend${q}` },
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        padding: '4px',
        borderRadius: '12px',
        background: 'var(--mk-surface)',
        border: '1px solid var(--mk-border)',
        marginTop: '4px',
        marginBottom: '8px',
      }}
    >
      {tabs.map(t => {
        const isActive = t.key === active
        return (
          <Link
            key={t.key}
            href={t.href}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '8px 0',
              borderRadius: '9px',
              fontSize: '14px',
              fontWeight: isActive ? 700 : 500,
              textDecoration: 'none',
              color: isActive ? '#fff' : 'var(--mk-text-2)',
              background: isActive ? 'var(--mk-accent)' : 'transparent',
              fontFamily: 'var(--font-geist-sans)',
            }}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
