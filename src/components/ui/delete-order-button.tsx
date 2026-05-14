'use client'

import { useTransition } from 'react'
import { deleteOrder } from '@/app/actions/orders'

export default function DeleteOrderButton({ orderId }: { orderId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!window.confirm('Удалить заказ? Это действие нельзя отменить.')) return
    startTransition(() => {
      deleteOrder(orderId)
    })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      style={{
        width: '100%',
        height: '50px',
        borderRadius: '14px',
        background: 'transparent',
        border: '1.5px solid rgba(200, 67, 26, 0.35)',
        color: 'var(--mk-accent)',
        fontSize: '15px',
        fontWeight: 600,
        cursor: isPending ? 'not-allowed' : 'pointer',
        opacity: isPending ? 0.5 : 1,
        fontFamily: 'var(--font-geist-sans)',
        transition: 'opacity 0.15s',
      }}
    >
      {isPending ? 'Удаляю...' : 'Удалить заказ'}
    </button>
  )
}
