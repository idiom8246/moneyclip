import { describe, expect, it } from 'vitest'
import { computeMonthInsight, convert } from '../src/lib/currency'
import type { ConsumptionRecord } from '../src/db/types'

const fxCache = {
  base: 'TWD',
  rates: { JPY: 4.5, USD: 0.031 }, // 1 TWD = 4.5 JPY, 0.031 USD
  fetchedAt: Date.now(),
  source: 'test',
}

describe('convert', () => {
  it('same currency is identity', () => {
    expect(convert(100, 'TWD', 'TWD', { manualRates: {} })).toBe(100)
  })

  it('uses cached rates (JPY → TWD)', () => {
    expect(convert(450, 'JPY', 'TWD', { manualRates: {}, cache: fxCache })).toBeCloseTo(100)
  })

  it('manual override beats cache', () => {
    // manual: 1 TWD = 5 JPY
    expect(convert(500, 'JPY', 'TWD', { manualRates: { JPY: 5 }, cache: fxCache })).toBe(100)
  })

  it('returns null without any usable rate — never invents numbers', () => {
    expect(convert(100, 'EUR', 'TWD', { manualRates: {}, cache: fxCache })).toBeNull()
    expect(convert(100, 'JPY', 'TWD', { manualRates: {} })).toBeNull()
    expect(convert(100, 'JPY', 'EUR', { manualRates: {}, cache: fxCache })).toBeNull()
  })
})

describe('computeMonthInsight', () => {
  const mk = (p: Partial<ConsumptionRecord>): ConsumptionRecord => ({
    id: Math.random().toString(36),
    title: 'x',
    tags: [],
    favorite: false,
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    ...p,
  })

  it('sums month total in default currency and tracks foreign amounts', () => {
    const records = [
      mk({ price: 100, currency: 'TWD', date: '2026-08-01', categoryId: 'c1' }),
      mk({ price: 450, currency: 'JPY', date: '2026-08-15', tags: ['trip:kyoto'] }),
      mk({ price: 50, currency: 'EUR', date: '2026-08-20' }), // unconvertible
      mk({ price: 999, currency: 'TWD', date: '2026-07-31' }), // other month
      mk({ price: 200, currency: 'TWD', date: '2026-08-05', status: 'archived' }),
    ]
    const insight = computeMonthInsight(records, '2026-08', 'TWD', {
      manualRates: {},
      cache: fxCache,
    })
    expect(insight.total).toBeCloseTo(200) // 100 TWD + 450 JPY/4.5
    expect(insight.foreignAmounts).toEqual({ JPY: 450, EUR: 50 })
    expect(insight.hadUnconverted).toBe(true)
    expect(insight.tripTotals).toEqual([{ tag: 'trip:kyoto', total: 100 }])
    expect(insight.topCategories[0]).toEqual({ categoryId: 'c1', total: 100 })
  })
})
