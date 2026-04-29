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
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <LoginForm redirectPath={params.redirect} />
    </main>
  )
}
