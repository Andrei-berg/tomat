/**
 * RED: Tests for savePrices and copyYesterdayPrices Server Actions
 * These tests must fail until prices.ts is created.
 */

// Mock revalidatePath from next/cache
const mockRevalidatePath = jest.fn()
jest.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

// Mock the supabase server module
const mockUpsert = jest.fn()
const mockFromSelect = jest.fn()
const mockFromSelectEq = jest.fn()
const mockFromUpsert = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))

function mockFrom(table: string) {
  return {
    select: (col: string, opts?: object) => ({
      eq: mockFromSelectEq,
    }),
    upsert: mockFromUpsert,
  }
}

// Mock next/navigation
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

// Mock session — authenticated
jest.mock('@/lib/session', () => ({
  getSession: jest.fn().mockResolvedValue({ isAuthenticated: true }),
}))

// server-only is mocked via moduleNameMapper in jest.config.js

import { savePrices, copyYesterdayPrices } from '@/app/actions/prices'

const TODAY = new Date().toISOString().split('T')[0]
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().split('T')[0]

describe('savePrices', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('upserts valid price entries and returns success', async () => {
    mockFromUpsert.mockResolvedValueOnce({ error: null })

    const formData = new FormData()
    formData.set('prod-1', '50')
    formData.set('prod-2', '80')

    const result = await savePrices(undefined, formData)

    expect(mockFromUpsert).toHaveBeenCalledWith(
      [
        { product_id: 'prod-1', date: TODAY, price_per_kg: 50 },
        { product_id: 'prod-2', date: TODAY, price_per_kg: 80 },
      ],
      { onConflict: 'product_id,date' },
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/prices')
    expect(result).toEqual({ success: true })
  })

  it('filters out Next.js internal fields starting with $', async () => {
    mockFromUpsert.mockResolvedValueOnce({ error: null })

    const formData = new FormData()
    formData.set('$ACTION_ID', 'some-action-id')
    formData.set('prod-1', '50')

    const result = await savePrices(undefined, formData)

    const upsertCall = mockFromUpsert.mock.calls[0][0]
    expect(upsertCall.every((e: { product_id: string }) => !e.product_id.startsWith('$'))).toBe(true)
    expect(result).toEqual({ success: true })
  })

  it('returns error when all entries are invalid (zero or non-numeric)', async () => {
    const formData = new FormData()
    formData.set('prod-1', '0')
    formData.set('prod-2', 'abc')
    formData.set('prod-3', '-5')

    const result = await savePrices(undefined, formData)

    expect(mockFromUpsert).not.toHaveBeenCalled()
    expect(result).toEqual({ error: 'Введите хотя бы одну цену' })
  })

  it('returns error on DB error', async () => {
    mockFromUpsert.mockResolvedValueOnce({ error: { message: 'DB connection failed' } })

    const formData = new FormData()
    formData.set('prod-1', '50')

    const result = await savePrices(undefined, formData)

    expect(mockRevalidatePath).not.toHaveBeenCalled()
    expect(result).toEqual({ error: 'DB connection failed' })
  })

  it('does not call revalidatePath on DB error', async () => {
    mockFromUpsert.mockResolvedValueOnce({ error: { message: 'some error' } })

    const formData = new FormData()
    formData.set('prod-1', '50')

    await savePrices(undefined, formData)

    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

describe('copyYesterdayPrices', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns prices from yesterday as a Record', async () => {
    mockFromSelectEq.mockResolvedValueOnce({
      data: [
        { product_id: 'prod-1', price_per_kg: 50 },
        { product_id: 'prod-2', price_per_kg: 80 },
      ],
      error: null,
    })

    const result = await copyYesterdayPrices(undefined)

    expect(mockFromSelectEq).toHaveBeenCalledWith('date', YESTERDAY)
    expect(result).toEqual({
      prices: { 'prod-1': 50, 'prod-2': 80 },
    })
  })

  it('returns error when no yesterday prices exist', async () => {
    mockFromSelectEq.mockResolvedValueOnce({ data: [], error: null })

    const result = await copyYesterdayPrices(undefined)

    expect(result).toEqual({ error: 'Цены вчера не найдены' })
  })

  it('returns error message on DB error', async () => {
    mockFromSelectEq.mockResolvedValueOnce({ data: null, error: { message: 'Query failed' } })

    const result = await copyYesterdayPrices(undefined)

    expect(result).toEqual({ error: 'Query failed' })
  })

  it('does NOT write to DB (only reads)', async () => {
    mockFromSelectEq.mockResolvedValueOnce({
      data: [{ product_id: 'prod-1', price_per_kg: 50 }],
      error: null,
    })

    await copyYesterdayPrices(undefined)

    expect(mockFromUpsert).not.toHaveBeenCalled()
  })
})
