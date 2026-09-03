import { describe, expect, it } from 'vitest'
import type { ConsumptionRecord, RecordItem } from '../src/db/types'
import {
  availableMonths,
  itemKey,
  merchantStats,
  normalizeItemName,
  priceHistory,
  reportMonth,
  tripReport,
} from '../src/lib/analytics'
import type { RateSource } from '../src/lib/currency'

let seq = 0
function mk(partial: Partial<ConsumptionRecord>): ConsumptionRecord {
  return {
    id: `r${++seq}`,
    title: 't',
    tags: [],
    favorite: false,
    status: 'active',
    createdAt: seq,
    updatedAt: seq,
    ...partial,
  }
}
const item = (p: Partial<RecordItem>): RecordItem => ({ id: `i${++seq}`, name: '', ...p })

// 1 HKD = 4.5 JPY → JPY 450 = HKD 100
const fx: RateSource = { manualRates: { JPY: 4.5 } }

describe('normalizeItemName / itemKey', () => {
  it('collapses case and whitespace', () => {
    expect(normalizeItemName('  AB Vita   LEMON ')).toBe('ab vita lemon')
  })
  it('barcode wins over name', () => {
    expect(itemKey(item({ name: 'Milk', barcode: '4890008102432' }))).toBe('bc:4890008102432')
    expect(itemKey(item({ name: 'Milk' }))).toBe('n:milk')
  })
})

describe('priceHistory', () => {
  const records = [
    mk({
      date: '2026-08-01',
      merchant: '7-ELEVEN',
      currency: 'HKD',
      items: [item({ name: 'AB Vita Lemon', unitPrice: 5, qty: 24, originalPrice: 7.5 })],
    }),
    mk({
      date: '2026-07-10',
      merchant: 'Donki',
      currency: 'JPY',
      items: [item({ name: 'AB VITA   lemon', unitPrice: 680, qty: 10, baseUnitPrice: 151.1 })],
    }),
    mk({ date: '2026-06-01', merchant: 'Mannings', items: [item({ name: 'Something else', unitPrice: 9 })] }),
  ]

  it('merges name variants, sorts desc, keeps raw + converted values', () => {
    const d = priceHistory(records, 'n:ab vita lemon', 'HKD', fx)
    expect(d.count).toBe(2)
    expect(d.purchases[0]).toMatchObject({ merchant: '7-ELEVEN', unitPrice: 5, originalPrice: 7.5 })
    expect(d.purchases[1]).toMatchObject({ merchant: 'Donki', unitPrice: 680, baseUnitPrice: 151.1 })
    expect(d.name).toBe('AB Vita Lemon') // most recent raw name
  })

  it('stats prefer snapshots, fall back to live conversion, skip unconverted', () => {
    const d = priceHistory(records, 'n:ab vita lemon', 'HKD', fx)
    // HKD 5 stays 5; JPY 680 uses the stored snapshot 151.1 (NOT live 680/4.5≈151.11)
    expect(d.min).toBeCloseTo(5)
    expect(d.max).toBeCloseTo(151.1)
    expect(d.avg).toBeCloseTo((5 + 151.1) / 2)
  })

  it('unconverted purchases are listed but excluded from stats', () => {
    const noFx: RateSource = { manualRates: {} }
    const legacy = [mk({ date: '2026-05-01', currency: 'JPY', items: [item({ name: 'ab vita lemon', unitPrice: 700 })] })]
    const d = priceHistory([...records, ...legacy], 'n:ab vita lemon', 'HKD', noFx)
    expect(d.count).toBe(3)
    // legacy JPY row: no snapshot, no rate → listed, flagged, excluded from stats
    expect(d.purchases[2].unconverted).toBe(true)
    expect(d.purchases[2].converted).toBeUndefined()
    // the HKD row is still convertible without any rate
    expect(d.min).toBeCloseTo(5)
  })

  it('groups barcode items under bc: even without a name', () => {
    const withBarcode = [mk({ items: [item({ barcode: '4890008102432', unitPrice: 12.9 })] })]
    const d = priceHistory(withBarcode, 'bc:4890008102432', 'HKD', fx)
    expect(d.count).toBe(1)
  })
})

describe('merchantStats', () => {
  const records = [
    mk({ merchant: '7-ELEVEN', date: '2026-08-14', currency: 'HKD', price: 189.6, items: [item({ name: 'Pokka' }), item({ name: 'Vita' })] }),
    mk({ merchant: '7-eleven', date: '2026-08-01', currency: 'HKD', price: 45.2, items: [item({ name: 'Pokka' })] }),
    mk({ merchant: 'Wellcome', date: '2026-07-02', currency: 'HKD', price: 328 }),
  ]

  it('groups by normalized merchant and counts item frequency', () => {
    const s = merchantStats(records, '7-ELEVEN', 'HKD', fx)
    expect(s.visits).toBe(2)
    expect(s.total).toBeCloseTo(234.8)
    expect(s.avgPerVisit).toBeCloseTo(117.4)
    expect(s.topItems[0]).toMatchObject({ name: 'Pokka', count: 2 })
    expect(s.displayName).toBe('7-ELEVEN') // most frequent raw casing
  })

  it('is case-insensitive on the lookup key', () => {
    expect(merchantStats(records, '7-Eleven', 'HKD', fx).visits).toBe(2)
  })
})

describe('tripReport', () => {
  const records = [
    mk({ date: '2026-03-14', currency: 'JPY', price: 1187, tags: ['trip:tokyo', 'x'], items: [] }),
    mk({ date: '2026-03-10', currency: 'JPY', price: 2450, tags: ['trip:tokyo'], categoryId: 'c1', items: [] }),
    mk({ date: '2026-03-11', currency: 'HKD', price: 50, tags: ['trip:tokyo'], items: [] }),
    mk({ date: '2026-03-12', currency: 'HKD', price: 999, tags: [], items: [] }),
  ]

  it('scopes to the tag, spans dates, splits currencies, converts with snapshots/live', () => {
    const r = tripReport(records, 'trip:tokyo', 'HKD', fx)
    expect(r.receipts).toHaveLength(3)
    expect(r.dateRange).toEqual(['2026-03-10', '2026-03-14'])
    expect(r.byCurrency.JPY).toBeCloseTo(3637)
    expect(r.convertedTotal).toBeCloseTo(50 + 3637 / 4.5)
    expect(r.unconvertedCount).toBe(0)
  })
})

describe('reportMonth / availableMonths', () => {
  const records = [
    mk({ date: '2026-08-01', currency: 'HKD', price: 100, categoryId: 'food', merchant: 'A', items: [item({ name: 'x', unitPrice: 100, originalPrice: 150 })] }),
    mk({ date: '2026-08-05', currency: 'HKD', price: 40, merchant: 'B' }),
    mk({ date: '2026-08-06', currency: 'HKD', price: 30, merchant: 'A', status: 'archived' }),
    mk({ date: '2026-07-01', currency: 'HKD', price: 999 }),
  ]

  it('scopes to the month, excludes archived, aggregates category+merchant', () => {
    const r = reportMonth(records, '2026-08', 'HKD', fx)
    expect(r.total).toBeCloseTo(140)
    expect(r.count).toBe(2)
    expect(r.byCategory[0]).toMatchObject({ categoryId: 'food', total: 100 })
    expect(r.byMerchant[0]).toMatchObject({ merchant: 'A', total: 100 })
  })

  it('savings = Σ (originalPrice − unitPrice) × qty, clamped at 0 per item', () => {
    const r = reportMonth(records, '2026-08', 'HKD', fx)
    expect(r.savings).toBeCloseTo(50)
    expect(r.savingsCount).toBe(1)
  })

  it('lists distinct months desc', () => {
    expect(availableMonths(records)).toEqual(['2026-08', '2026-07'])
  })
})
