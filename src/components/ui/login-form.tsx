'use client'
import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

interface Props {
  redirectPath?: string
}

export default function LoginForm({ redirectPath }: Props) {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <form action={action} className="flex flex-col gap-4 w-full max-w-sm p-6 bg-white rounded-xl shadow">
      <input type="hidden" name="redirect" value={redirectPath ?? '/'} />
      <h1 className="text-2xl font-bold text-center">Вход</h1>
      <input
        name="password"
        type="password"
        placeholder="Пароль"
        autoFocus
        required
        className="border rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {state?.error && (
        <p className="text-red-500 text-sm text-center">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-blue-600 text-white rounded-lg px-4 py-3 text-lg font-medium disabled:opacity-50 active:bg-blue-700"
      >
        {pending ? 'Вход...' : 'Войти'}
      </button>
    </form>
  )
}
