'use client'

import { useState } from 'react'
import Link from 'next/link'
import PaySheet from './pay-sheet'
import type { DebtorEntry } from '@/lib/dal'

function rub(n: number) {
  return n.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'сегодня'
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`
  return `${Math.floor(days / 30)} мес. назад`
}

type AgingTier = { label: string; color: string; bg: string; border: string }

function agingBadge(oldestDebtAt: string): AgingTier {
  const days = Math.floor((Date.now() - new Date(oldestDebtAt).getTime()) / 86400000)
  if (days <= 3) {
    const label = days === 0 ? 'сегодня' : days === 1 ? '1 день' : `${days} дня`
    return { label, color: 'var(--mk-amber)', bg: 'var(--mk-amber-bg)', border: 'var(--mk-amber-border)' }
  }
  if (days <= 14) {
    return { label: `${days} дн.`, color: '#e07820', bg: 'rgba(224,120,32,0.13)', border: 'rgba(224,120,32,0.28)' }
  }
  const label = days < 30 ? `${days} дн.` : `${Math.floor(days / 30)} мес.`
  return { label, color: 'var(--mk-err-text)', bg: 'var(--mk-err-bg)', border: 'var(--mk-err-border)' }
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

interface DebtorsListProps {
  debtors: DebtorEntry[]
}

export default function DebtorsList({ debtors }: DebtorsListProps) {
  const [selected, setSelected] = useState<DebtorEntry | null>(null)

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {debtors.map((d, i) => {
          const inits = initials(d.clientName)
          const paidAmount = d.totalOriginal - d.totalDebt
          const progressPct = d.totalOriginal > 0 ? Math.max(0, (paidAmount / d.totalOriginal) * 100) : 0
          const hasPartialPayment = paidAmount > 0.5
          const canPay = !!d.clientId
          const aging = agingBadge(d.oldestDebtAt)

          return (
            <div
              key={`${d.clientId}-${i}`}
              style={{
                borderRadius: '16px',
                background: 'var(--mk-card)',
                border: '1px solid var(--mk-border)',
                borderLeft: `3px solid ${aging.color}`,
                overflow: 'hidden',
                animation: 'mkUp 0.22s both',
                animationDelay: `${i * 0.04}s`,
              }}
            >
              {/* Main row — clickable if has clientId */}
              {d.clientId ? (
                <Link
                  href={`/debts/${d.clientId}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px 10px', textDecoration: 'none' }}
                >
                  <CardBody d={d} inits={inits} aging={aging} />
                </Link>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px 10px' }}>
                  <CardBody d={d} inits={inits} aging={aging} />
                </div>
              )}

              {/* Progress bar + actions row */}
              <div style={{ padding: '0 16px 14px' }}>
                {/* Progress bar */}
                <div style={{
                  height: '4px', borderRadius: '2px',
                  background: 'var(--mk-border)',
                  marginBottom: '12px', overflow: 'hidden',
                }}>
                  {hasPartialPayment && (
                    <div style={{
                      height: '100%', borderRadius: '2px',
                      width: `${progressPct}%`,
                      background: 'var(--mk-ok-text)',
                      transition: 'width 0.4s ease',
                    }} />
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '12px', color: 'var(--mk-text-3)' }}>
                    {hasPartialPayment ? (
                      <span>Получено {rub(paidAmount)}</span>
                    ) : (
                      <span>{d.orderCount} заказ{d.orderCount === 1 ? '' : d.orderCount < 5 ? 'а' : 'ов'} · {relativeDate(d.lastOrderAt)}</span>
                    )}
                  </div>

                  {canPay && (
                    <button
                      onClick={() => setSelected(d)}
                      style={{
                        padding: '7px 14px', borderRadius: '10px', border: 'none',
                        background: 'var(--mk-amber-bg)',
                        color: 'var(--mk-amber)',
                        fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                    >
                      Оплатить →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pay Sheet — mounted once, keyed by clientId to reset state on change */}
      {selected && (
        <PaySheet
          key={selected.clientId!}
          clientId={selected.clientId!}
          clientName={selected.clientName}
          totalDebt={selected.totalDebt}
          open={true}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

function CardBody({ d, inits, aging }: { d: DebtorEntry; inits: string; aging: AgingTier }) {
  return (
    <>
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
        background: 'var(--mk-amber-bg)', border: '1px solid var(--mk-amber-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', fontWeight: 800, color: 'var(--mk-amber)',
      }}>
        {inits}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--mk-text)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.clientName}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--mk-text-3)' }}>
          {d.orderCount} {d.orderCount === 1 ? 'операция' : d.orderCount < 5 ? 'операции' : 'операций'}
        </p>
      </div>

      <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
        <p style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: 'var(--mk-amber)', letterSpacing: '-0.03em', fontFamily: 'var(--font-geist-mono)' }}>
          {d.totalDebt.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })}
        </p>
        <span style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em',
          color: aging.color, background: aging.bg,
          border: `1px solid ${aging.border}`,
          borderRadius: '6px', padding: '2px 7px',
          lineHeight: 1.5,
        }}>
          {aging.label}
        </span>
      </div>
    </>
  )
}
