import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ isAuthenticated: true }),
}))

import { getTodayPrices, hasTodayPrices } from '@/lib/dal'

const TODAY = new Date().toISOString().split('T')[0]

describe('getTodayPrices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns array of product_id and price_per_kg for today', async () => {
    const fakeData = [
      { product_id: 'prod-1', price_per_kg: 50 },
      { product_id: 'prod-2', price_per_kg: 80 },
    ]
    mockEq.mockResolvedValueOnce({ data: fakeData })
    mockSelect.mockReturnValueOnce({ eq: mockEq })
    mockFrom.mockReturnValueOnce({ select: mockSelect })

    const result = await getTodayPrices()

    expect(mockFrom).toHaveBeenCalledWith('prices')
    expect(mockSelect).toHaveBeenCalledWith('product_id, price_per_kg')
    expect(mockEq).toHaveBeenCalledWith('date', TODAY)
    expect(result).toEqual(fakeData)
  })

  it('returns empty array when no prices set for today', async () => {
    mockEq.mockResolvedValueOnce({ data: null })
    mockSelect.mockReturnValueOnce({ eq: mockEq })
    mockFrom.mockReturnValueOnce({ select: mockSelect })

    const result = await getTodayPrices()

    expect(result).toEqual([])
  })
})

describe('hasTodayPrices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when at least one price row exists for today', async () => {
    mockEq.mockResolvedValueOnce({ count: 3 })
    mockSelect.mockReturnValueOnce({ eq: mockEq })
    mockFrom.mockReturnValueOnce({ select: mockSelect })

    const result = await hasTodayPrices()

    expect(mockFrom).toHaveBeenCalledWith('prices')
    expect(mockSelect).toHaveBeenCalledWith('*', { count: 'exact', head: true })
    expect(mockEq).toHaveBeenCalledWith('date', TODAY)
    expect(result).toBe(true)
  })

  it('returns false when no price rows exist for today', async () => {
    mockEq.mockResolvedValueOnce({ count: 0 })
    mockSelect.mockReturnValueOnce({ eq: mockEq })
    mockFrom.mockReturnValueOnce({ select: mockSelect })

    const result = await hasTodayPrices()

    expect(result).toBe(false)
  })

  it('returns false when count is null', async () => {
    mockEq.mockResolvedValueOnce({ count: null })
    mockSelect.mockReturnValueOnce({ eq: mockEq })
    mockFrom.mockReturnValueOnce({ select: mockSelect })

    const result = await hasTodayPrices()

    expect(result).toBe(false)
  })
})
