'use client'

import { useState } from 'react'
import PaySheet from './pay-sheet'

interface DebtPayButtonProps {
  clientId: string
  clientName: string
  totalDebt: number
}

export default function DebtPayButton({ clientId, clientName, totalDebt }: DebtPayButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '14px 24px', borderRadius: '14px', border: 'none',
          background: 'var(--mk-accent)',
          color: '#fff', fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em',
          cursor: 'pointer', width: '100%',
          transition: 'background 0.15s',
        }}
      >
        Принять оплату
      </button>

      <PaySheet
        key={open ? clientId : 'closed'}
        clientId={clientId}
        clientName={clientName}
        totalDebt={totalDebt}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
