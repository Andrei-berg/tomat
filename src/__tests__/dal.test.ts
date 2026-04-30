/**
 * RED: Tests for getTodayPrices and hasTodayPrices in dal.ts
 * These tests must fail until the functions are implemented.
 */

// Mock the supabase server module before importing dal
const mockFrom = jest.fn()
const mockSelect = jest.fn()
const mockEq = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))

// Mock next/navigation redirect used in verifySession
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

// Mock session to always be authenticated
jest.mock('@/lib/session', () => ({
  getSession: jest.fn().mockResolvedValue({ isAuthenticated: true }),
}))

import { getTodayPrices, hasTodayPrices } from '@/lib/dal'

const TODAY = new Date().toISOString().split('T')[0]

describe('getTodayPrices', () => {
  beforeEach(() => {
    jest.clearAllMocks()
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
    jest.clearAllMocks()
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
