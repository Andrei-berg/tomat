'use client'
import { useActionState, useState, useEffect } from 'react'
import { savePrices, copyYesterdayPrices } from '@/app/actions/prices'

interface Product { id: string; name: string; sort_order: number }
interface Props {
  products: Product[]
  priceMap: Record<string, number | null>
}

/* ── Icon helpers ─────────────────────────────────────── */

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="15" height="15" viewBox="0 0 15 15" fill="none"
      style={{ flexShrink: 0 }}
    >
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="2" opacity="0.22" />
      <path d="M13 7.5A5.5 5.5 0 0 0 7.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <path d="M7 2v10M3 8l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Component ────────────────────────────────────────── */

export default function PricesForm({ products, priceMap }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(products.map(p => [p.id, priceMap[p.id]?.toString() ?? '']))
  )
  const [saveState, saveAction, saving] = useActionState(savePrices, undefined)
  const [copyPending, setCopyPending] = useState(false)
  const [copyError, setCopyError] = useState<string | undefined>()
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (saveState?.success) {
      setShowSuccess(true)
      const t = setTimeout(() => setShowSuccess(false), 2600)
      return () => clearTimeout(t)
    }
  }, [saveState])

  async function handleCopy() {
    setCopyPending(true)
    setCopyError(undefined)
    const result = await copyYesterdayPrices(undefined)
    setCopyPending(false)
    if (result?.error) {
      setCopyError(result.error)
    } else if (result?.prices) {
      setValues(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(result.prices!).map(([id, v]) => [id, v.toString()])
        ),
      }))
    }
  }

  const filledCount = products.filter(p => Boolean(values[p.id])).length
  const allFilled = products.length > 0 && filledCount === products.length
  const busy = saving || copyPending

  return (
    <form
      action={saveAction}
      style={{ display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-geist-sans)' }}
    >
      {/* ── Counter ───────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px',
      }}>
        <span style={{ fontSize: '12px', color: 'var(--mk-text-3)', letterSpacing: '0.02em' }}>
          Заполнено
        </span>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: allFilled ? 'var(--mk-ok-text)' : 'var(--mk-text-2)',
          transition: 'color 0.25s',
        }}>
          {filledCount} / {products.length}
        </span>
      </div>

      {/* ── Product rows ──────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {products.map((product, i) => {
          const filled = Boolean(values[product.id])
          return (
            <label
              key={product.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '66px',
                padding: '0 16px',
                borderRadius: '14px',
                cursor: 'text',
                background: filled ? 'var(--mk-card-fill)' : 'var(--mk-card)',
                borderTop:    `1px solid ${filled ? 'rgba(200,67,26,0.2)' : 'var(--mk-border)'}`,
                borderRight:  `1px solid ${filled ? 'rgba(200,67,26,0.2)' : 'var(--mk-border)'}`,
                borderBottom: `1px solid ${filled ? 'rgba(200,67,26,0.2)' : 'var(--mk-border)'}`,
                borderLeft:   `3px solid ${filled ? 'var(--mk-accent)' : 'transparent'}`,
                transition: 'background 0.2s, border-color 0.2s',
                animationName: 'mkUp',
                animationDuration: '0.35s',
                animationFillMode: 'both',
                animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                animationDelay: `${i * 0.045}s`,
              }}
            >
              {/* Product name */}
              <span style={{
                fontSize: '15px',
                fontWeight: filled ? 600 : 500,
                color: filled ? 'var(--mk-text)' : 'var(--mk-text-2)',
                letterSpacing: '-0.01em',
                transition: 'color 0.2s',
                flex: '1 1 auto',
                paddingRight: '12px',
              }}>
                {product.name}
              </span>

              {/* Input + unit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <div
                  style={{
                    background: 'var(--mk-surface)',
                    borderRadius: '10px',
                    border: '1.5px solid var(--mk-border)',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <input
                    id={product.id}
                    type="number"
                    name={product.id}
                    value={values[product.id] ?? ''}
                    onChange={e => setValues(prev => ({ ...prev, [product.id]: e.target.value }))}
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="—"
                    onFocus={e => {
                      const w = e.currentTarget.parentElement
                      if (w) w.style.borderColor = 'var(--mk-accent)'
                    }}
                    onBlur={e => {
                      const w = e.currentTarget.parentElement
                      if (w) w.style.borderColor = 'var(--mk-border)'
                    }}
                    style={{
                      display: 'block',
                      width: '88px',
                      height: '42px',
                      padding: '0 12px',
                      fontSize: '18px',
                      fontWeight: 600,
                      textAlign: 'right',
                      letterSpacing: '-0.02em',
                      color: filled ? 'var(--mk-text)' : 'var(--mk-text-3)',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontFamily: 'var(--font-geist-sans)',
                      transition: 'color 0.15s',
                    }}
                  />
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--mk-text-3)',
                  width: '28px',
                  letterSpacing: '0.01em',
                  userSelect: 'none',
                }}>
                  ₽/кг
                </span>
              </div>
            </label>
          )
        })}
      </div>

      {/* ── Status messages ───────────────────────────── */}
      {saveState?.error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          marginBottom: '12px',
          borderRadius: '12px',
          background: 'var(--mk-err-bg)',
          border: '1px solid var(--mk-err-border)',
          color: 'var(--mk-err-text)',
          fontSize: '14px',
          fontWeight: 500,
          animationName: 'mkUp',
          animationDuration: '0.2s',
          animationFillMode: 'both',
        }}>
          {saveState.error}
        </div>
      )}

      {copyError && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '12px',
          borderRadius: '12px',
          background: 'var(--mk-err-bg)',
          border: '1px solid var(--mk-err-border)',
          color: 'var(--mk-err-text)',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          {copyError}
        </div>
      )}

      {showSuccess && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          marginBottom: '12px',
          borderRadius: '12px',
          background: 'var(--mk-ok-bg)',
          border: '1px solid var(--mk-ok-border)',
          color: 'var(--mk-ok-text)',
          fontSize: '14px',
          fontWeight: 600,
          animationName: 'mkPop',
          animationDuration: '0.3s',
          animationFillMode: 'both',
        }}>
          <CheckIcon />
          Цены сохранены
        </div>
      )}

      {/* ── Action buttons ────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>

        {/* Copy yesterday — ghost */}
        <button
          type="button"
          onClick={handleCopy}
          disabled={busy}
          style={{
            width: '100%',
            height: '50px',
            borderRadius: '14px',
            background: 'transparent',
            border: '1.5px solid var(--mk-border)',
            color: 'var(--mk-text-2)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: busy ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: busy ? 0.45 : 1,
            transition: 'opacity 0.15s',
            fontFamily: 'var(--font-geist-sans)',
          }}
        >
          {copyPending ? <><Spinner /> Копирую...</> : <><ArrowDownIcon /> Скопировать вчерашние</>}
        </button>

        {/* Save — primary tomato gradient */}
        <button
          type="submit"
          disabled={busy}
          style={{
            width: '100%',
            height: '60px',
            borderRadius: '16px',
            background: busy
              ? 'var(--mk-card-fill)'
              : 'linear-gradient(135deg, var(--mk-accent) 0%, var(--mk-accent-hi) 100%)',
            border: 'none',
            color: busy ? 'var(--mk-text-2)' : 'white',
            fontSize: '17px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: busy ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: busy ? 0.55 : 1,
            transition: 'opacity 0.2s, box-shadow 0.2s',
            fontFamily: 'var(--font-geist-sans)',
            boxShadow: !busy ? '0 6px 24px var(--mk-accent-glow)' : 'none',
          }}
        >
          {saving ? <><Spinner /> Сохраняю...</> : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
