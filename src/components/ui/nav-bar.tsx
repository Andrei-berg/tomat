'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'

export default function NavBar() {
  const pathname = usePathname()
  const isPricesActive = pathname === '/prices'
  const isOrdersActive = pathname.startsWith('/orders')
  const isReportActive = pathname.startsWith('/report')

  const activeStyle: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 700,
    background: 'rgba(200,67,26,0.12)',
    color: 'var(--mk-accent)',
    border: '1px solid rgba(200,67,26,0.2)',
    textDecoration: 'none',
    fontFamily: 'var(--font-geist-sans)',
  }

  const inactiveStyle: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    background: 'transparent',
    color: 'var(--mk-text-2)',
    border: '1px solid transparent',
    textDecoration: 'none',
    fontFamily: 'var(--font-geist-sans)',
  }

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '20px',
        paddingBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', gap: '6px' }}>
        <Link href="/prices" style={isPricesActive ? activeStyle : inactiveStyle}>
          Прайс
        </Link>
        <Link href="/orders" style={isOrdersActive ? activeStyle : inactiveStyle}>
          Заказы
        </Link>
        <Link href="/report" style={isReportActive ? activeStyle : inactiveStyle}>
          Отчёты
        </Link>
      </div>
      <form action={logout}>
        <button
          type="submit"
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            background: 'transparent',
            border: '1px solid var(--mk-border)',
            color: 'var(--mk-text-3)',
            cursor: 'pointer',
            fontFamily: 'var(--font-geist-sans)',
          }}
        >
          Выйти
        </button>
      </form>
    </nav>
  )
}
