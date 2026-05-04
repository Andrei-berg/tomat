import Link from 'next/link'
import { verifySession, getDebtors } from '@/lib/dal'
import BottomNav from '@/components/ui/bottom-nav'

function rub(n: number) {
  return n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'сегодня'
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`
  return `${Math.floor(days / 30)} мес. назад`
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default async function DebtorsPage() {
  await verifySession()
  const debtors = await getDebtors()

  const total = debtors.reduce((s, d) => s + d.totalDebt, 0)

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px', paddingBottom: 'calc(var(--mk-nav-h) + 32px)' }}>

        {/* ── Header ── */}
        <div style={{ paddingTop: '24px', paddingBottom: '4px' }}>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
            Контроль
          </p>
          <h1 style={{ margin: '4px 0 0', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--mk-text)' }}>
            Долги
          </h1>
        </div>

        {/* ── Total debt banner ── */}
        {debtors.length > 0 && (
          <div style={{
            marginTop: '20px',
            padding: '20px 22px',
            borderRadius: '16px',
            background: 'var(--mk-amber-bg)',
            border: '1px solid var(--mk-amber-border)',
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

        {/* ── List ── */}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {debtors.map((d, i) => {
                const inits = initials(d.clientName)
                return (
                  <div
                    key={`${d.clientId}-${i}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 16px', borderRadius: '14px',
                      background: 'var(--mk-card)', border: '1px solid var(--mk-border)',
                      borderLeft: '3px solid var(--mk-amber)',
                      animation: 'mkUp 0.22s both',
                      animationDelay: `${i * 0.04}s`,
                      textDecoration: 'none',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                      background: 'var(--mk-amber-bg)', border: '1px solid var(--mk-amber-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 800, color: 'var(--mk-amber)',
                    }}>
                      {inits}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {d.clientId ? (
                        <Link href={`/clients/${d.clientId}`} style={{ textDecoration: 'none' }}>
                          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--mk-text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {d.clientName}
                          </p>
                        </Link>
                      ) : (
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--mk-text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.clientName}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--mk-text-2)' }}>
                          {d.orderCount} заказ{d.orderCount === 1 ? '' : d.orderCount < 5 ? 'а' : 'ов'}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--mk-text-3)' }}>
                          {relativeDate(d.lastOrderAt)}
                        </span>
                      </div>
                    </div>

                    {/* Debt amount */}
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--mk-amber)', letterSpacing: '-0.03em', fontFamily: 'var(--font-geist-mono)' }}>
                        {rub(d.totalDebt)}
                      </p>
                      {d.clientId && (
                        <Link
                          href={`/orders/new?clientId=${d.clientId}&clientName=${encodeURIComponent(d.clientName)}`}
                          style={{
                            fontSize: '11px', color: 'var(--mk-text-3)', textDecoration: 'none',
                            marginTop: '4px', display: 'block',
                          }}
                        >
                          + заказ
                        </Link>
                      )}
                    </div>
                  </div>
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
