'use client'
import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

interface Props {
  redirectPath?: string
}

export default function LoginForm({ redirectPath }: Props) {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <div style={{ width: '100%', maxWidth: '380px' }}>
      {/* Brand mark */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 32 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: 'linear-gradient(135deg, #e8602f, #8a2a0e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 38,
          boxShadow: '0 12px 40px rgba(212,69,28,0.35), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}>
          🍅
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--mk-text)' }}>
            Tomat
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--mk-text-2)' }}>
            Учёт продаж · Рынок «Восточный»
          </p>
        </div>
      </div>

      {/* Form card */}
      <form
        action={action}
        style={{
          background: 'var(--mk-surface)',
          border: '1px solid var(--mk-border)',
          borderRadius: 20,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <input type="hidden" name="redirect" value={redirectPath ?? '/'} />

        <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mk-text-2)' }}>
          Пароль
        </label>

        <input
          name="password"
          type="password"
          placeholder="Введите пароль"
          autoFocus
          required
          style={{
            width: '100%', height: 48, padding: '0 14px',
            background: 'var(--mk-card)', border: '1px solid var(--mk-border)',
            borderRadius: 10, color: 'var(--mk-text)',
            fontSize: 16, fontFamily: 'inherit',
            outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--mk-accent)'; e.target.style.boxShadow = '0 0 0 3px var(--mk-accent-glow)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--mk-border)'; e.target.style.boxShadow = 'none' }}
        />

        {state?.error && (
          <p style={{ margin: 0, color: 'var(--mk-err-text)', fontSize: 13, textAlign: 'center' }}>
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          style={{
            width: '100%', height: 48, borderRadius: 10, border: 'none',
            background: pending ? 'var(--mk-card)' : 'var(--mk-accent)',
            color: pending ? 'var(--mk-text-3)' : '#fff',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            cursor: pending ? 'not-allowed' : 'pointer',
            transition: 'background 120ms',
          }}
        >
          {pending ? 'Вхожу...' : 'Войти'}
        </button>

        <p style={{ margin: 0, fontSize: 12, color: 'var(--mk-text-3)', textAlign: 'center' }}>
          Один пароль для продавца и владельца
        </p>
      </form>
    </div>
  )
}
