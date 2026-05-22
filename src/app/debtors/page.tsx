import { verifySession, getDebtors } from '@/lib/dal'
import DebtorsList from '@/components/ui/debtors-list'
import BottomNav from '@/components/ui/bottom-nav'

function rub(n: number) {
  return n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

export default async function DebtorsPage() {
  await verifySession()
  const debtors = await getDebtors()

  const total = debtors.reduce((s, d) => s + d.totalDebt, 0)

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px', paddingBottom: 'calc(var(--mk-nav-h) + 32px)' }}>

        {/* Header */}
        <div style={{ paddingTop: '24px', paddingBottom: '4px' }}>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
            Контроль
          </p>
          <h1 style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--mk-text)' }}>
            Долги
          </h1>
        </div>

        {/* Total banner */}
        {debtors.length > 0 && (
          <div style={{
            marginTop: '20px', padding: '20px 22px', borderRadius: '16px',
            background: 'var(--mk-amber-bg)', border: '1px solid var(--mk-amber-border)',
          }}>
            <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mk-amber)', opacity: 0.7 }}>
              К получению
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--mk-amber)', fontFamily: 'var(--font-geist-mono)', lineHeight: 1 }}>
              {rub(total)}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--mk-text-2)' }}>
              {debtors.length} {debtors.length === 1 ? 'должник' : debtors.length < 5 ? 'должника' : 'должников'}
            </p>
          </div>
        )}

        {/* List */}
        <div style={{ marginTop: '16px' }}>
          {debtors.length === 0 ? (
            <div style={{
              padding: '52px 24px', textAlign: 'center',
              borderRadius: '16px', background: 'var(--mk-surface)',
              border: '1px solid var(--mk-border)',
            }}>
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ margin: '0 auto 14px', display: 'block', opacity: 0.25 }}>
                <path d="M22 5 3.5 38.5h37L22 5z" stroke="var(--mk-text)" strokeWidth="2" strokeLinejoin="round" />
                <path d="M22 18v10M22 32v2" stroke="var(--mk-text)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--mk-text-2)' }}>
                Долгов нет
              </p>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--mk-text-3)' }}>
                Все расчёты закрыты
              </p>
            </div>
          ) : (
            <DebtorsList debtors={debtors} />
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
