import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { getSession } from '@/lib/session'
import Sidebar from '@/components/ui/sidebar'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Tomat — Учёт продаж',
  description: 'Учёт продаж помидоров с фуры',
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession()
  const authenticated = session.isAuthenticated

  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body
        className={authenticated ? 'has-sidebar' : ''}
        style={{ margin: 0, padding: 0, background: 'var(--mk-bg)', color: 'var(--mk-text)', fontFamily: 'var(--font-geist-sans)' }}
      >
        {authenticated && <Sidebar />}
        {children}
      </body>
    </html>
  )
}
