import Link from 'next/link'
import { verifySession, getClientsWithStats } from '@/lib/dal'
import type { ClientWithStats } from '@/lib/dal'
import BottomNav from '@/components/ui/bottom-nav'

function rub(n: number) {
  return n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'сегодня'
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`
  if (days < 365) return `${Math.floor(days / 30)} мес. назад`
  return `${Math.floor(days / 365)} г. назад`
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = ['#c8431a', '#d4780e', '#57b875', '#6090e0', '#9060d0', '#d04080']
function avatarColor(name: string): string {
  const code = (name.charCodeAt(0) ?? 0) + (name.charCodeAt(1) ?? 0)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

function ClientCard({ client, i }: { client: ClientWithStats; i: number }) {
  const color = avatarColor(client.name)
  const hasDebt = client.debtAmount > 0
  return (
    <Link
      key={client.id}
      href={`/clients/${client.id}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '14px 16px', borderRadius: '14px',
        background: 'var(--mk-card)', border: '1px solid var(--mk-border)',
        textDecoration: 'none',
        animation: 'mkUp 0.22s both',
        animationDelay: `${i * 0.03}s`,
      }}
    >
      {/* Avatar */}
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
        background: `${color}22`, border: `1px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '15px', fontWeight: 800, color, letterSpacing: '-0.02em',
      }}>
        {initials(client.name)}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--mk-text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {client.name}
          </span>
          {hasDebt && (
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px',
              background: 'var(--mk-amber-bg)', color: 'var(--mk-amber)',
              border: '1px solid var(--mk-amber-border)', flexShrink: 0,
              letterSpacing: '0.03em',
            }}>
              ДОЛГ
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--mk-text-2)' }}>
            {client.orderCount} заказ{client.orderCount === 1 ? '' : client.orderCount < 5 ? 'а' : 'ов'}
          </span>
          {client.lastOrderAt && (
            <span style={{ fontSize: '12px', color: 'var(--mk-text-3)' }}>
              {relativeDate(client.lastOrderAt)}
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--mk-text)', letterSpacing: '-0.03em', fontFamily: 'var(--font-geist-mono)' }}>
          {rub(client.totalSpent)}
        </span>
        {hasDebt && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--mk-amber)', fontFamily: 'var(--font-geist-mono)' }}>
            -{rub(client.debtAmount)}
          </span>
        )}
      </div>
    </Link>
  )
}

export default async function ClientsPage() {
  await verifySession()
  const clients = await getClientsWithStats()

  const withDebt = clients.filter(c => c.debtAmount > 0)
  const active = [...clients].sort((a, b) => (b.lastOrderAt ?? '').localeCompare(a.lastOrderAt ?? ''))
  const regulars = active.filter(c => c.is_regular)
  const occasional = active.filter(c => !c.is_regular)

  return (
    <div style={{ minHeight: '100svh', background: 'var(--mk-bg)', fontFamily: 'var(--font-geist-sans)' }}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 20px', paddingBottom: 'calc(var(--mk-nav-h) + 32px)' }}>

        {/* ── Header ── */}
        <div style={{ paddingTop: '24px', paddingBottom: '20px' }}>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
            База
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--mk-text)' }}>
              Клиенты
            </h1>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'baseline', gap: '4px',
                fontSize: '13px', fontWeight: 600, color: 'var(--mk-text)',
                background: 'var(--mk-card)', border: '1px solid var(--mk-border)',
                padding: '4px 10px', borderRadius: '20px',
              }}>
                {regulars.length}
                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--mk-text-3)' }}>пост.</span>
              </span>
              {occasional.length > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'baseline', gap: '4px',
                  fontSize: '13px', fontWeight: 600, color: 'var(--mk-text-2)',
                  background: 'var(--mk-surface)', border: '1px solid var(--mk-border)',
                  padding: '4px 10px', borderRadius: '20px',
                }}>
                  {occasional.length}
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--mk-text-3)' }}>раз.</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Debt alert (if any) ── */}
        {withDebt.length > 0 && (
          <Link
            href="/debtors"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderRadius: '14px',
              background: 'var(--mk-amber-bg)', border: '1px solid var(--mk-amber-border)',
              textDecoration: 'none', marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2.5 1.5 17.5h17L10 2.5z" stroke="#d4780e" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M10 8v5" stroke="#d4780e" strokeWidth="2" strokeLinecap="round" />
                <circle cx="10" cy="14.5" r="0.75" fill="#d4780e" />
              </svg>
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#d4780e' }}>
                  {withDebt.length} {withDebt.length === 1 ? 'клиент' : withDebt.length < 5 ? 'клиента' : 'клиентов'} в расчёте
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--mk-text-2)' }}>
                  Суммарный долг: {rub(withDebt.reduce((s, c) => s + c.debtAmount, 0))}
                </p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="#d4780e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}

        {/* ── Client list ── */}
        {clients.length === 0 ? (
          <div style={{
            padding: '52px 24px', textAlign: 'center',
            borderRadius: '16px', background: 'var(--mk-surface)', border: '1px solid var(--mk-border)',
          }}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ margin: '0 auto 14px', display: 'block', opacity: 0.25 }}>
              <circle cx="18" cy="16" r="6" stroke="var(--mk-text)" strokeWidth="2" />
              <path d="M6 38c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="var(--mk-text)" strokeWidth="2" strokeLinecap="round" />
              <path d="M32 20c2.209 0 4 1.791 4 4s-1.791 4-4 4M38 38c0-4.418-2.686-8-6-8" stroke="var(--mk-text)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--mk-text-2)' }}>Клиентов пока нет</p>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--mk-text-3)' }}>
              Они появятся при создании заказов с привязкой к клиенту
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {regulars.map((client, i) => (
                <ClientCard key={client.id} client={client} i={i} />
              ))}
              {regulars.length === 0 && (
                <p style={{ margin: 0, padding: '8px 2px', fontSize: '13px', color: 'var(--mk-text-3)' }}>
                  Постоянных клиентов пока нет
                </p>
              )}
            </div>

            {occasional.length > 0 && (
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
                  Разовые · {occasional.length}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {occasional.map((client, i) => (
                    <ClientCard key={client.id} client={client} i={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
