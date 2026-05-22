import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import LoginForm from '@/components/ui/login-form'

interface Props {
  searchParams: Promise<{ redirect?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams
  const session = await getSession()

  if (session.isAuthenticated) {
    redirect(params.redirect?.startsWith('/') ? params.redirect : '/')
  }

  return (
    <main style={{
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(60% 50% at 50% 30%, rgba(212,69,28,0.10), transparent 70%), var(--mk-bg)',
    }}>
      <LoginForm redirectPath={params.redirect} />
    </main>
  )
}
