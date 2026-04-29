'use server'
import { redirect } from 'next/navigation'
import { createSession, deleteSession } from '@/lib/session'

export async function login(
  state: { error?: string } | undefined,
  formData: FormData,
) {
  const password = formData.get('password') as string
  const redirectPath = (formData.get('redirect') as string) || '/'

  if (!password || password !== process.env.APP_PASSWORD) {
    return { error: 'Неверный пароль' }
  }

  await createSession()
  redirect(redirectPath.startsWith('/') ? redirectPath : '/')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
