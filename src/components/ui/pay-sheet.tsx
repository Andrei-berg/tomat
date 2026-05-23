'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordClientPayment } from '@/app/actions/debts'
import type { RecordPaymentState } from '@/app/actions/debts'

interface PaySheetProps {
  clientId: string
  clientName: string
  totalDebt: number
  open: boolean
  onClose: () => void
}

export default function PaySheet({ clientId, clientName, totalDebt, open, onClose }: PaySheetProps) {
  const router = useRouter()
  const [state, action, pending] = useActionState<RecordPaymentState, FormData>(recordClientPayment, undefined)
  const [paymentType, setPaymentType] = useState<'cash' | 'card'>('cash')
  const [amount, setAmount] = useState(String(Math.round(totalDebt)))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setAmount(String(Math.round(totalDebt)))
      setPaymentType('cash')
      setTimeout(() => inputRef.current?.select(), 280)
    }
  }, [open, totalDebt])

  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => {
        router.refresh()
        onClose()
      }, 1400)
      return () => clearTimeout(t)
    }
  }, [state?.success, router, onClose])

  if (!open) return null

  const parsed = parseFloat(amount)
  const isFullAmount = Math.abs(parsed - totalDebt) < 0.5

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          animation: 'mkFadeIn 0.2s both',
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', bottom: 0, left: '50%',
          width: '100%', maxWidth: '480px', zIndex: 201,
          background: 'var(--mk-surface)',
          borderTop: '1px solid var(--mk-border)',
          borderRadius: '24px 24px 0 0',
          padding: '0 20px 48px',
          animation: 'mkSlideUp 0.32s cubic-bezier(0.32, 0.72, 0, 1) both',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--mk-border)' }} />
        </div>

        {/* Header */}
        <div style={{ marginTop: '20px', marginBottom: '28px' }}>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
            Принять оплату
          </p>
          <p style={{ margin: '5px 0 0', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--mk-text)', lineHeight: 1.1 }}>
            {clientName}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 700, color: 'var(--mk-amber)', fontFamily: 'var(--font-geist-mono)' }}>
            К получению: {Math.round(totalDebt).toLocaleString('ru-RU')} ₽
          </p>
        </div>

        {state?.success ? (
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'var(--mk-ok-bg)', border: '2px solid var(--mk-ok-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              animation: 'mkCheckPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--mk-ok-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--mk-ok-text)' }}>
              Оплата записана
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--mk-text-3)' }}>
              {Math.round(parsed).toLocaleString('ru-RU')} ₽ · {paymentType === 'cash' ? 'Наличные' : 'Карта'}
            </p>
          </div>
        ) : (
          <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="payment_type" value={paymentType} />

            {/* Amount */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
                Сумма
              </p>

              {/* Pay in full shortcut */}
              <button
                type="button"
                onClick={() => setAmount(String(Math.round(totalDebt)))}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '15px 18px', borderRadius: '14px',
                  border: `2px solid ${isFullAmount ? 'var(--mk-ok-text)' : 'var(--mk-border)'}`,
                  background: isFullAmount ? 'var(--mk-ok-bg)' : 'var(--mk-card)',
                  cursor: 'pointer', marginBottom: '10px',
                  transition: 'border-color 0.15s, background 0.15s',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 700, color: isFullAmount ? 'var(--mk-ok-text)' : 'var(--mk-text)' }}>
                  Погасить полностью
                </span>
                <span style={{ fontSize: '17px', fontWeight: 800, fontFamily: 'var(--font-geist-mono)', color: isFullAmount ? 'var(--mk-ok-text)' : 'var(--mk-text)' }}>
                  {Math.round(totalDebt).toLocaleString('ru-RU')} ₽
                </span>
              </button>

              {/* Custom amount */}
              <div style={{ position: 'relative' }}>
                <input
                  ref={inputRef}
                  type="number"
                  name="amount"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Другая сумма"
                  min="1"
                  max={totalDebt}
                  step="1"
                  required
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '15px 48px 15px 18px',
                    borderRadius: '14px',
                    border: `2px solid ${!isFullAmount && parsed > 0 ? 'var(--mk-amber)' : 'var(--mk-border)'}`,
                    background: 'var(--mk-card)',
                    color: 'var(--mk-text)',
                    fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-geist-mono)',
                    transition: 'border-color 0.15s',
                    outline: 'none',
                  }}
                />
                <span style={{
                  position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '16px', fontWeight: 700, color: 'var(--mk-text-3)', pointerEvents: 'none',
                }}>
                  ₽
                </span>
              </div>
            </div>

            {/* Payment type */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--mk-text-3)' }}>
                Способ оплаты
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['cash', 'card'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPaymentType(type)}
                    style={{
                      flex: 1, padding: '14px 10px', borderRadius: '14px',
                      border: `2px solid ${paymentType === type ? 'var(--mk-accent)' : 'var(--mk-border)'}`,
                      background: paymentType === type ? 'rgba(200,67,26,0.12)' : 'var(--mk-card)',
                      color: paymentType === type ? 'var(--mk-accent-hi)' : 'var(--mk-text-2)',
                      fontSize: '15px', fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {type === 'cash' ? 'Наличные' : 'Карта'}
                  </button>
                ))}
              </div>
            </div>

            {state?.error && (
              <div style={{
                padding: '12px 16px', borderRadius: '12px',
                background: 'var(--mk-err-bg)', border: '1px solid var(--mk-err-border)',
              }}>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--mk-err-text)' }}>{state.error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={pending || !parsed || parsed <= 0}
              style={{
                padding: '17px', borderRadius: '16px', border: 'none',
                background: pending || !parsed || parsed <= 0 ? 'var(--mk-border)' : 'var(--mk-accent)',
                color: pending || !parsed || parsed <= 0 ? 'var(--mk-text-3)' : '#fff',
                fontSize: '16px', fontWeight: 800, letterSpacing: '-0.01em',
                cursor: pending ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {pending ? 'Записываем…' : 'Записать оплату'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
