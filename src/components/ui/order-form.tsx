'use client'
import { useActionState, useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { createOrder, searchClients, createClient } from '@/app/actions/orders'
import type { CreateOrderState, ClientResult } from '@/app/actions/orders'

/* ── Pure helpers ─────────────────────────────────────────────────────────── */

type ItemState = { boxes: string; weight: string }
type ItemsState = Record<string, ItemState>

function calcTotal(items: ItemsState, priceMap: Record<string, number>): number {
  return (
    Math.round(
      Object.entries(items).reduce((sum, [pid, item]) => {
        const price = priceMap[pid] ?? 0
        const weight = parseFloat(item.weight) || 0
        return sum + price * weight
      }, 0) * 100,
    ) / 100
  )
}

function effectiveTotal(
  calculated: number,
  discountPct: string,
  manualTotal: string,
): number {
  // Priority rule: manual_total absolute priority if filled;
  // otherwise discount_percent if > 0; otherwise calculated
  const manual = parseFloat(manualTotal)
  if (manualTotal !== '' && !isNaN(manual) && manual >= 0) return manual
  const pct = parseFloat(discountPct)
  if (discountPct !== '' && !isNaN(pct) && pct > 0) {
    return Math.round(calculated * (1 - pct / 100) * 100) / 100
  }
  return calculated
}

function formatRub(amount: number): string {
  return amount.toLocaleString('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  })
}

/* ── Icons ────────────────────────────────────────────────────────────────── */

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="2" opacity="0.22" />
      <path
        d="M13 7.5A5.5 5.5 0 0 0 7.5 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ── Interfaces ───────────────────────────────────────────────────────────── */

interface Product {
  id: string
  name: string
  sort_order: number
}

interface Props {
  products: Product[]
  priceMap: Record<string, number>
  initialClientId?: string
  initialClientName?: string
}

/* ── Component ────────────────────────────────────────────────────────────── */

export default function OrderForm({ products, priceMap, initialClientId, initialClientName }: Props) {
  /* ── State ── */
  const [items, setItems] = useState<ItemsState>(
    Object.fromEntries(products.map(p => [p.id, { boxes: '', weight: '' }])),
  )
  const [discountPct, setDiscountPct] = useState('')
  const [manualTotal, setManualTotal] = useState('')
  const [paymentType, setPaymentType] = useState<'cash' | 'card' | 'debt'>('cash')
  const [clientQuery, setClientQuery] = useState(initialClientName ?? '')
  const [clientResults, setClientResults] = useState<ClientResult[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(
    initialClientId && initialClientName ? { id: initialClientId, name: initialClientName } : null,
  )
  const [showDropdown, setShowDropdown] = useState(false)
  const [clientCreating, setClientCreating] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [orderState, orderAction, saving] = useActionState<CreateOrderState, FormData>(
    createOrder,
    undefined,
  )
  const [formKey, setFormKey] = useState(0)
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [prepaymentAmount, setPrepaymentAmount] = useState('')
  const [prepaymentType, setPrepaymentType] = useState<'cash' | 'card'>('cash')

  /* ── Derived values ── */
  const calculated = calcTotal(items, priceMap)
  const effective = effectiveTotal(calculated, discountPct, manualTotal)
  const hasItems = Object.values(items).some(i => parseFloat(i.weight) > 0)
  const needsClient = paymentType === 'debt'
  const hasClient = selectedClient !== null
  const canSave = hasItems && (!needsClient || hasClient) && !saving && !isPending

  /* ── Sync action success to local state ── */
  useEffect(() => {
    if (orderState?.success) setFormSubmitted(true)
  }, [orderState?.success])

  /* ── Debounced client search ── */
  useEffect(() => {
    if (clientQuery.length < 2) {
      setClientResults([])
      setShowDropdown(false)
      return
    }
    const timer = setTimeout(async () => {
      const results = await searchClients(clientQuery)
      setClientResults(results)
      setShowDropdown(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [clientQuery])

  /* ── Handlers ── */
  async function handleAddClient() {
    if (!clientQuery.trim()) return
    setClientCreating(true)
    const result = await createClient(clientQuery)
    setClientCreating(false)
    if ('error' in result) return
    setSelectedClient(result)
    setClientQuery('')
    setShowDropdown(false)
  }

  function buildFormData(): FormData {
    const fd = new FormData()
    fd.set('payment_type', paymentType)
    if (selectedClient) {
      fd.set('client_id', selectedClient.id)
      fd.set('client_name_raw', selectedClient.name)
    }
    if (discountPct) fd.set('discount_percent', discountPct)
    if (manualTotal) fd.set('manual_total', manualTotal)
    for (const [pid, item] of Object.entries(items)) {
      const weight = parseFloat(item.weight)
      if (!weight || weight <= 0) continue
      fd.set(`weight_${pid}`, item.weight)
      fd.set(`boxes_${pid}`, item.boxes || '0')
      fd.set(`price_${pid}`, String(priceMap[pid] ?? 0))
    }
    if (paymentType === 'debt' && prepaymentAmount && parseFloat(prepaymentAmount) > 0) {
      fd.set('prepayment_amount', prepaymentAmount)
      fd.set('prepayment_type', prepaymentType)
    }
    return fd
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const manual = parseFloat(manualTotal)
    if (manualTotal !== '' && !isNaN(manual) && calculated > 0 && manual < calculated * 0.8) {
      const ok = window.confirm(
        `Итог ${formatRub(manual)} значительно ниже расчётного ${formatRub(calculated)}. Сохранить?`,
      )
      if (!ok) return
    }
    startTransition(() => {
      orderAction(buildFormData())
    })
  }

  function resetForm() {
    setFormSubmitted(false)
    setItems(Object.fromEntries(products.map(p => [p.id, { boxes: '', weight: '' }])))
    setDiscountPct('')
    setManualTotal('')
    setPaymentType('cash')
    setClientQuery('')
    setClientResults([])
    setSelectedClient(null)
    setShowDropdown(false)
    setPrepaymentAmount('')
    setPrepaymentType('cash')
    setFormKey(k => k + 1)
  }

  /* ── After success ── */
  if (formSubmitted) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingTop: '32px',
          animationName: 'mkUp',
          animationDuration: '0.35s',
          animationFillMode: 'both',
          animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            padding: '16px',
            borderRadius: '14px',
            background: 'var(--mk-ok-bg)',
            border: '1px solid var(--mk-ok-border)',
            color: 'var(--mk-ok-text)',
            fontSize: '16px',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          Заказ сохранён
        </div>
        <button
          type="button"
          onClick={resetForm}
          style={{
            width: '100%',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--mk-accent) 0%, var(--mk-accent-hi) 100%)',
            border: 'none',
            color: 'white',
            fontSize: '16px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            fontFamily: 'var(--font-geist-sans)',
            boxShadow: '0 6px 24px var(--mk-accent-glow)',
          }}
        >
          Новый заказ
        </button>
        <Link
          href="/orders"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '50px',
            borderRadius: '14px',
            background: 'transparent',
            border: '1.5px solid var(--mk-border)',
            color: 'var(--mk-text-2)',
            fontSize: '15px',
            fontWeight: 500,
            textDecoration: 'none',
            fontFamily: 'var(--font-geist-sans)',
          }}
        >
          К списку заказов
        </Link>
      </div>
    )
  }

  /* ── Form ── */
  return (
    <form
      key={formKey}
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'var(--font-geist-sans)' }}
    >

      {/* ── Section 1: Products ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mk-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Товары
        </span>
        {products.map((product, i) => {
          const hasPrice = Boolean(priceMap[product.id])
          const item = items[product.id] ?? { boxes: '', weight: '' }
          const filled = Boolean(item.boxes || item.weight)
          const lineTotal =
            hasPrice && parseFloat(item.weight) > 0
              ? priceMap[product.id] * parseFloat(item.weight)
              : null

          return (
            <div
              key={product.id}
              style={{
                padding: '12px 16px',
                borderRadius: '14px',
                background: hasPrice ? (filled ? 'var(--mk-card-fill)' : 'var(--mk-card)') : 'var(--mk-surface)',
                borderTop: `1px solid ${filled ? 'rgba(200,67,26,0.2)' : 'var(--mk-border)'}`,
                borderRight: `1px solid ${filled ? 'rgba(200,67,26,0.2)' : 'var(--mk-border)'}`,
                borderBottom: `1px solid ${filled ? 'rgba(200,67,26,0.2)' : 'var(--mk-border)'}`,
                borderLeft: `3px solid ${filled ? 'var(--mk-accent)' : 'transparent'}`,
                opacity: hasPrice ? 1 : 0.55,
                transition: 'background 0.2s, border-color 0.2s',
                animationName: 'mkUp',
                animationDuration: '0.35s',
                animationFillMode: 'both',
                animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                animationDelay: `${i * 0.04}s`,
              }}
            >
              {/* Row 1: name + price */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasPrice ? '10px' : '0' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: hasPrice ? 'var(--mk-text)' : 'var(--mk-text-3)', letterSpacing: '-0.01em' }}>
                  {product.name}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--mk-text-3)', fontWeight: 500 }}>
                  {hasPrice ? `${formatRub(priceMap[product.id])} / кг` : 'Цена не установлена'}
                </span>
              </div>

              {/* Row 2: inputs (only if has price) */}
              {hasPrice && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* Boxes */}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--mk-text-3)', fontWeight: 500, marginBottom: '4px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Ящики
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.boxes}
                      onChange={e => setItems(prev => ({ ...prev, [product.id]: { ...prev[product.id], boxes: e.target.value } }))}
                      inputMode="numeric"
                      placeholder="0"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: '40px',
                        padding: '0 10px',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: 'var(--mk-text)',
                        background: 'var(--mk-surface)',
                        border: '1.5px solid var(--mk-border)',
                        borderRadius: '10px',
                        outline: 'none',
                        fontFamily: 'var(--font-geist-sans)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  {/* Weight */}
                  <div style={{ flex: '0 0 110px' }}>
                    <label style={{ display: 'block', fontSize: '10px', color: 'var(--mk-text-3)', fontWeight: 500, marginBottom: '4px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Вес кг
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={item.weight}
                      onChange={e => setItems(prev => ({ ...prev, [product.id]: { ...prev[product.id], weight: e.target.value } }))}
                      inputMode="decimal"
                      placeholder="0.0"
                      style={{
                        display: 'block',
                        width: '100%',
                        height: '40px',
                        padding: '0 10px',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: 'var(--mk-text)',
                        background: 'var(--mk-surface)',
                        border: '1.5px solid var(--mk-border)',
                        borderRadius: '10px',
                        outline: 'none',
                        fontFamily: 'var(--font-geist-sans)',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  {/* Line total */}
                  <div style={{ flex: '0 0 72px', textAlign: 'right', paddingTop: '18px' }}>
                    {lineTotal !== null ? (
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--mk-text-2)' }}>
                        {formatRub(lineTotal)}
                      </span>
                    ) : (
                      <span style={{ fontSize: '13px', color: 'var(--mk-text-3)' }}>—</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Section 2: Discount + Manual total ─────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mk-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Скидка и итог
        </span>
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Discount % */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--mk-text-3)', fontWeight: 500, marginBottom: '6px' }}>
              Скидка %
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={discountPct}
              onChange={e => setDiscountPct(e.target.value)}
              inputMode="numeric"
              placeholder="0"
              style={{
                display: 'block',
                width: '100%',
                height: '44px',
                padding: '0 12px',
                fontSize: '17px',
                fontWeight: 600,
                color: 'var(--mk-text)',
                background: 'var(--mk-surface)',
                border: '1.5px solid var(--mk-border)',
                borderRadius: '12px',
                outline: 'none',
                fontFamily: 'var(--font-geist-sans)',
                boxSizing: 'border-box',
              }}
            />
            {parseFloat(discountPct) > 50 && (
              <div
                style={{
                  marginTop: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(200, 170, 0, 0.1)',
                  border: '1px solid rgba(200, 170, 0, 0.25)',
                  color: '#c8a200',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Скидка больше 50% — проверьте перед сохранением
              </div>
            )}
          </div>
          {/* Manual total */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--mk-text-3)', fontWeight: 500, marginBottom: '6px' }}>
              Ручной итог ₽
            </label>
            <input
              type="number"
              min="0"
              value={manualTotal}
              onChange={e => setManualTotal(e.target.value)}
              inputMode="decimal"
              placeholder="—"
              style={{
                display: 'block',
                width: '100%',
                height: '44px',
                padding: '0 12px',
                fontSize: '17px',
                fontWeight: 600,
                color: 'var(--mk-text)',
                background: 'var(--mk-surface)',
                border: '1.5px solid var(--mk-border)',
                borderRadius: '12px',
                outline: 'none',
                fontFamily: 'var(--font-geist-sans)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Section 3: Payment type ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mk-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Тип оплаты
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {([
            { value: 'cash', label: 'Наличные' },
            { value: 'card', label: 'Карта' },
            { value: 'debt', label: 'В кредит' },
          ] as const).map(opt => {
            const active = paymentType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaymentType(opt.value)}
                style={{
                  flex: 1,
                  height: '42px',
                  borderRadius: '12px',
                  border: active ? '1.5px solid var(--mk-accent)' : '1.5px solid var(--mk-border)',
                  background: active ? 'rgba(200,67,26,0.1)' : 'var(--mk-surface)',
                  color: active ? 'var(--mk-accent)' : 'var(--mk-text-2)',
                  fontSize: '14px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'var(--font-geist-sans)',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Section 4: Client ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mk-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Клиент{needsClient && <span style={{ color: 'var(--mk-accent)', marginLeft: '4px' }}>*</span>}
        </span>

        {selectedClient ? (
          /* Selected client chip */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 14px',
              height: '44px',
              borderRadius: '12px',
              background: 'var(--mk-card-fill)',
              border: '1.5px solid var(--mk-accent)',
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--mk-text)' }}>
              {selectedClient.name}
            </span>
            <button
              type="button"
              onClick={() => { setSelectedClient(null); setClientQuery('') }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--mk-text-3)',
                fontSize: '18px',
                lineHeight: 1,
                padding: '4px',
                fontFamily: 'var(--font-geist-sans)',
              }}
            >
              ×
            </button>
          </div>
        ) : (
          /* Search input + dropdown */
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={clientQuery}
              onChange={e => {
                setClientQuery(e.target.value)
                setSelectedClient(null)
              }}
              onFocus={() => {
                if (clientQuery.length >= 2 && clientResults.length > 0) setShowDropdown(true)
              }}
              onBlur={() => {
                setTimeout(() => setShowDropdown(false), 150)
              }}
              placeholder="Поиск клиента..."
              style={{
                display: 'block',
                width: '100%',
                height: '44px',
                padding: '0 12px',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--mk-text)',
                background: 'var(--mk-surface)',
                border: '1.5px solid var(--mk-border)',
                borderRadius: '12px',
                outline: 'none',
                fontFamily: 'var(--font-geist-sans)',
                boxSizing: 'border-box',
              }}
            />

            {showDropdown && (clientResults.length > 0 || clientQuery.length >= 2) && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  zIndex: 50,
                  background: 'var(--mk-card)',
                  border: '1px solid var(--mk-border)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                }}
              >
                {clientResults.map(r => {
                  const exactMatch = r.name.toLowerCase() === clientQuery.toLowerCase()
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setSelectedClient(r)
                        setClientQuery('')
                        setShowDropdown(false)
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '12px 14px',
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        borderBottom: '1px solid var(--mk-border)',
                        color: 'var(--mk-text)',
                        fontSize: '15px',
                        fontWeight: exactMatch ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-geist-sans)',
                      }}
                    >
                      {r.name}
                    </button>
                  )
                })}

                {/* Add button — shown if no exact match */}
                {!clientResults.some(r => r.name.toLowerCase() === clientQuery.toLowerCase()) && (
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={handleAddClient}
                    disabled={clientCreating}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '12px 14px',
                      textAlign: 'left',
                      background: 'rgba(200,67,26,0.07)',
                      border: 'none',
                      color: 'var(--mk-accent)',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: clientCreating ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-geist-sans)',
                    }}
                  >
                    {clientCreating ? 'Добавляю...' : `Добавить «${clientQuery}»`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 4.5: Prepayment ────────────────────────────────────── */}
      {paymentType === 'debt' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mk-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Предоплата <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(необязательно)</span>
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Amount input */}
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--mk-text-3)', fontWeight: 500, marginBottom: '6px' }}>
                Сумма ₽
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                max={effective}
                value={prepaymentAmount}
                onChange={e => setPrepaymentAmount(e.target.value)}
                inputMode="decimal"
                placeholder={`до ${formatRub(effective)}`}
                style={{
                  display: 'block',
                  width: '100%',
                  height: '44px',
                  padding: '0 12px',
                  fontSize: '17px',
                  fontWeight: 600,
                  color: 'var(--mk-text)',
                  background: 'var(--mk-surface)',
                  border: '1.5px solid var(--mk-border)',
                  borderRadius: '12px',
                  outline: 'none',
                  fontFamily: 'var(--font-geist-sans)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            {/* Type selector */}
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--mk-text-3)', fontWeight: 500, marginBottom: '6px' }}>
                Способ
              </label>
              <div style={{ display: 'flex', gap: '6px', height: '44px' }}>
                {(['cash', 'card'] as const).map(pt => {
                  const active = prepaymentType === pt
                  return (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPrepaymentType(pt)}
                      style={{
                        flex: 1,
                        height: '44px',
                        borderRadius: '12px',
                        border: active ? '1.5px solid var(--mk-accent)' : '1.5px solid var(--mk-border)',
                        background: active ? 'rgba(200,67,26,0.1)' : 'var(--mk-surface)',
                        color: active ? 'var(--mk-accent)' : 'var(--mk-text-2)',
                        fontSize: '13px',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        fontFamily: 'var(--font-geist-sans)',
                      }}
                    >
                      {pt === 'cash' ? 'Нал' : 'Карта'}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Section 5: Total + Save ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Total display */}
        <div
          style={{
            padding: '16px',
            borderRadius: '14px',
            background: 'var(--mk-card)',
            border: '1px solid var(--mk-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--mk-text-3)', fontWeight: 500 }}>
            Итого
          </span>
          <span
            style={{
              fontSize: '32px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--mk-text)',
              lineHeight: 1.1,
            }}
          >
            {formatRub(effective)}
          </span>
          {effective !== calculated && calculated > 0 && (
            <span style={{ fontSize: '13px', color: 'var(--mk-text-3)', fontWeight: 400 }}>
              расчётный: {formatRub(calculated)}
            </span>
          )}
        </div>

        {/* Error */}
        {orderState?.error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'var(--mk-err-bg)',
              border: '1px solid var(--mk-err-border)',
              color: 'var(--mk-err-text)',
              fontSize: '14px',
              fontWeight: 500,
              animationName: 'mkUp',
              animationDuration: '0.2s',
              animationFillMode: 'both',
            }}
          >
            {orderState.error}
          </div>
        )}

        {/* Save button */}
        <button
          type="submit"
          disabled={!canSave}
          style={{
            width: '100%',
            height: '60px',
            borderRadius: '16px',
            marginBottom: '8px',
            background: canSave
              ? 'linear-gradient(135deg, var(--mk-accent) 0%, var(--mk-accent-hi) 100%)'
              : 'var(--mk-card-fill)',
            border: 'none',
            color: canSave ? 'white' : 'var(--mk-text-3)',
            fontSize: '17px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: canSave ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: canSave ? 1 : 0.55,
            transition: 'opacity 0.2s, box-shadow 0.2s',
            fontFamily: 'var(--font-geist-sans)',
            boxShadow: canSave ? '0 6px 24px var(--mk-accent-glow)' : 'none',
          }}
        >
          {saving || isPending ? <><Spinner /> Сохраняю...</> : 'Сохранить заказ'}
        </button>
      </div>
    </form>
  )
}
