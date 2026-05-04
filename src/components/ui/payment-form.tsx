'use client'

import { useActionState } from 'react'
import { recordPayment } from '@/app/actions/debts'
import type { RecordPaymentState } from '@/app/actions/debts'

interface PaymentFormProps {
  orderId: string
  clientId: string
  maxAmount: number  // remaining debt for this order
}

export default function PaymentForm({ orderId, clientId, maxAmount }: PaymentFormProps) {
  const [state, action, pending] = useActionState<RecordPaymentState, FormData>(recordPayment, undefined)

  if (state?.success) {
    return (
      <p style={{ margin: '8px 0 0', fontSize: '13px', fontWeight: 600, color: 'var(--mk-green, #22c55e)' }}>
        Погашение зафиксировано
      </p>
    )
  }

  return (
    <form action={action} style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="client_id" value={clientId} />

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="number"
          name="amount"
          placeholder={`до ${maxAmount.toLocaleString('ru-RU')} ₽`}
          min="0.01"
          max={maxAmount}
          step="0.01"
          required
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: '10px',
            border: '1px solid var(--mk-border)',
            background: 'var(--mk-surface)',
            color: 'var(--mk-text)',
            fontSize: '14px',
            fontFamily: 'var(--font-geist-mono)',
          }}
        />
        <select
          name="payment_type"
          defaultValue="cash"
          style={{
            padding: '8px 10px',
            borderRadius: '10px',
            border: '1px solid var(--mk-border)',
            background: 'var(--mk-surface)',
            color: 'var(--mk-text)',
            fontSize: '13px',
          }}
        >
          <option value="cash">Наличные</option>
          <option value="card">Карта</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        style={{
          padding: '9px 18px',
          borderRadius: '10px',
          border: 'none',
          background: pending ? 'var(--mk-border)' : 'var(--mk-amber)',
          color: pending ? 'var(--mk-text-3)' : '#fff',
          fontSize: '13px',
          fontWeight: 700,
          cursor: pending ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {pending ? 'Сохранение…' : 'Погасить'}
      </button>

      {state?.error && (
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--mk-red, #ef4444)' }}>
          {state.error}
        </p>
      )}
    </form>
  )
}
