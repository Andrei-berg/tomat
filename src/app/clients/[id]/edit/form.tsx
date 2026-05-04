'use client'
import { useActionState } from 'react'
import { updateClient } from '@/app/actions/clients'
import type { ClientFormState } from '@/app/actions/clients'

interface Props { id: string; name: string; phone: string; notes: string }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: '12px',
  background: 'var(--mk-card)', border: '1px solid var(--mk-border)',
  color: 'var(--mk-text)', fontSize: '15px', fontWeight: 500,
  outline: 'none', boxSizing: 'border-box',
  fontFamily: 'var(--font-geist-sans)',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700,
  letterSpacing: '0.16em', textTransform: 'uppercase',
  color: 'var(--mk-text-3)', marginBottom: '8px',
}

export default function EditClientForm({ id, name, phone, notes }: Props) {
  const action = updateClient.bind(null, id)
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(action, undefined)

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={labelStyle}>Имя</label>
        <input
          name="name"
          defaultValue={name}
          required
          style={inputStyle}
          placeholder="Введите имя клиента"
        />
      </div>

      <div>
        <label style={labelStyle}>Телефон</label>
        <input
          name="phone"
          type="tel"
          defaultValue={phone}
          style={inputStyle}
          placeholder="+7 (999) 000-00-00"
        />
      </div>

      <div>
        <label style={labelStyle}>Заметки</label>
        <textarea
          name="notes"
          defaultValue={notes}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          placeholder="Дополнительная информация..."
        />
      </div>

      {state?.error && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          background: 'var(--mk-err-bg)', border: '1px solid var(--mk-err-border)',
          color: 'var(--mk-err-text)', fontSize: '13px', fontWeight: 500,
        }}>
          {state.error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            flex: 1, padding: '14px', borderRadius: '12px',
            background: pending ? 'var(--mk-card)' : 'var(--mk-accent)',
            color: pending ? 'var(--mk-text-2)' : '#fff',
            fontSize: '15px', fontWeight: 700, border: 'none', cursor: pending ? 'default' : 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          {pending ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
