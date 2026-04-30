'use client'
import { useActionState, useState } from 'react'
import { savePrices, copyYesterdayPrices } from '@/app/actions/prices'

interface Product { id: string; name: string; sort_order: number }
interface Props {
  products: Product[]
  priceMap: Record<string, number | null>
}

export default function PricesForm({ products, priceMap }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(products.map(p => [p.id, priceMap[p.id]?.toString() ?? '']))
  )
  const [saveState, saveAction, saving] = useActionState(savePrices, undefined)
  const [copyPending, setCopyPending] = useState(false)
  const [copyError, setCopyError] = useState<string | undefined>()

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

  return (
    <form action={saveAction} className="flex flex-col gap-4">
      {products.map(product => (
        <div key={product.id} className="flex items-center gap-3">
          <label htmlFor={product.id} className="w-32 font-medium text-sm">
            {product.name}
          </label>
          <input
            id={product.id}
            type="number"
            name={product.id}
            value={values[product.id] ?? ''}
            onChange={e => setValues(prev => ({ ...prev, [product.id]: e.target.value }))}
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="₽/кг"
            className="border rounded-lg px-3 py-3 text-lg w-28 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      ))}

      {saveState?.error && (
        <p className="text-red-500 text-sm">{saveState.error}</p>
      )}
      {saveState?.success && (
        <p className="text-green-600 text-sm">Цены сохранены</p>
      )}
      {copyError && (
        <p className="text-red-500 text-sm">{copyError}</p>
      )}

      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={copyPending || saving}
          className="border rounded-lg px-4 py-3 text-base disabled:opacity-50"
        >
          {copyPending ? 'Копирую...' : 'Скопировать вчерашние'}
        </button>
        <button
          type="submit"
          disabled={saving || copyPending}
          className="bg-blue-600 text-white rounded-lg px-4 py-3 text-base font-medium disabled:opacity-50 flex-1"
        >
          {saving ? 'Сохраняю...' : 'Сохранить'}
        </button>
      </div>
    </form>
  )
}
