'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

function IconOrders({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3.5" y="4.5" width="15" height="14" rx="2.5"
        stroke="currentColor" strokeWidth={active ? 2 : 1.5} />
      <path d="M7.5 4.5V3.5a3.5 3.5 0 0 1 7 0v1"
        stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" />
      <path d="M7 11.5h8M7 14.5h5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconClients({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="9" cy="8" r="3"
        stroke="currentColor" strokeWidth={active ? 2 : 1.5} />
      <path d="M3 19c0-3.314 2.686-6 6-6s6 2.686 6 6"
        stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" />
      <path d="M16 10c1.105 0 2 .895 2 2s-.895 2-2 2"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 19c0-2.209-1.343-4-3-4"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconDebt({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 3.5 2.5 18.5h17L11 3.5z"
        stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinejoin="round" />
      <path d="M11 9v4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="11" cy="15.5" r="0.75" fill="currentColor" />
    </svg>
  )
}

function IconPrices({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 4h6l8 8-6 6-8-8V4z"
        stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
    </svg>
  )
}

function IconReport({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3.5" y="3.5" width="15" height="15" rx="2.5"
        stroke="currentColor" strokeWidth={active ? 2 : 1.5} />
      <path d="M7 8h8M7 11h8M7 14h5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const TABS = [
  {
    href: '/orders',
    label: 'Заказы',
    Icon: IconOrders,
    match: (p: string) => p.startsWith('/orders'),
  },
  {
    href: '/clients',
    label: 'Клиенты',
    Icon: IconClients,
    match: (p: string) => p.startsWith('/clients'),
  },
  {
    href: '/debtors',
    label: 'Долги',
    Icon: IconDebt,
    match: (p: string) => p.startsWith('/debtors'),
  },
  {
    href: '/prices',
    label: 'Прайс',
    Icon: IconPrices,
    match: (p: string) => p === '/prices',
  },
  {
    href: '/report',
    label: 'Отчёт',
    Icon: IconReport,
    match: (p: string) => p.startsWith('/report'),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="mk-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderTop: '1px solid var(--mk-border-sub)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        background: 'rgba(12, 9, 6, 0.88)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                padding: '10px 0 12px',
                textDecoration: 'none',
                color: active ? 'var(--mk-accent)' : 'var(--mk-text-3)',
                position: 'relative',
                transition: 'color 0.12s',
              }}
            >
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '28px',
                    height: '2.5px',
                    borderRadius: '0 0 3px 3px',
                    background: 'var(--mk-accent)',
                  }}
                />
              )}
              <Icon active={active} />
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: active ? 700 : 500,
                  letterSpacing: '0.03em',
                  fontFamily: 'var(--font-geist-sans)',
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}

        {/* Logout — always accessible */}
        <form action={logout} style={{ display: 'flex', alignItems: 'stretch' }}>
          <button
            type="submit"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '10px 14px 12px',
              background: 'none',
              border: 'none',
              borderLeft: '1px solid var(--mk-border)',
              color: 'var(--mk-text-3)',
              cursor: 'pointer',
              fontFamily: 'var(--font-geist-sans)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M7 3H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M12 12.5l3.5-3.5L12 5.5M15.5 9H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.03em', lineHeight: 1 }}>
              Выйти
            </span>
          </button>
        </form>
      </div>
    </nav>
  )
}
