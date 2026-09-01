import { describe, expect, it } from 'vitest'
import { searchRecords } from '../src/lib/search'
import type { Category, ConsumptionRecord } from '../src/db/types'

const cat = (id: string, name: string, nameEn?: string): Category => ({
  id, name, nameEn, sortOrder: 0, builtIn: true,
})

const cats = [cat('c1', '餐飲', 'Dining'), cat('c2', '電子', 'Electronics')]

let n = 0
const rec = (p: Partial<ConsumptionRecord>): ConsumptionRecord => ({
  id: `r${n}`,
  title: `t${n}`,
  tags: [],
  favorite: false,
  status: 'active',
  createdAt: n,
  updatedAt: n++,
  ...p,
})

describe('searchRecords', () => {
  const data = [
    rec({ title: '一蘭拉麵', merchant: 'Ichiran', categoryId: 'c1', date: '2026-07-01' }),
    rec({ title: '耳機', merchant: 'BIC Camera', note: 'Sony WH-1000XM5', categoryId: 'c2', tags: ['trip:tokyo'], date: '2026-07-03' }),
    rec({ title: '拉麵博物館門票', tags: ['ramen'], date: '2026-07-02' }),
    rec({ title: '舊的拉麵', status: 'archived', date: '2026-06-01' }),
    rec({ title: '最愛的一餐', favorite: true, saveReason: 'bought', date: '2026-07-05' }),
  ]

  it('matches title / merchant / note / tags / category name, case-insensitive', () => {
    expect(searchRecords(data, cats, '拉麵', {}).map((r) => r.title)).toContain('一蘭拉麵')
    expect(searchRecords(data, cats, 'ichiran', {}).map((r) => r.title)).toContain('一蘭拉麵')
    expect(searchRecords(data, cats, 'sony', {}).map((r) => r.title)).toContain('耳機')
    expect(searchRecords(data, cats, 'TRIP:TOKYO', {}).map((r) => r.title)).toContain('耳機')
    expect(searchRecords(data, cats, 'dining', {}).map((r) => r.title)).toContain('一蘭拉麵')
    expect(searchRecords(data, cats, '餐飲', {}).map((r) => r.title)).toContain('一蘭拉麵')
  })

  it('excludes archived by default; includeArchived turns them on', () => {
    expect(searchRecords(data, cats, '拉麵', {}).map((r) => r.title)).not.toContain('舊的拉麵')
    expect(
      searchRecords(data, cats, '拉麵', { includeArchived: true }).map((r) => r.title),
    ).toContain('舊的拉麵')
  })

  it('filters by category / saveReason / favorite / date range / tag', () => {
    expect(searchRecords(data, cats, '', { categoryId: 'c2' })).toHaveLength(1)
    expect(searchRecords(data, cats, '', { saveReason: 'bought' })).toHaveLength(1)
    expect(searchRecords(data, cats, '', { favoriteOnly: true })).toHaveLength(1)
    expect(
      searchRecords(data, cats, '', { dateFrom: '2026-07-01', dateTo: '2026-07-02' }),
    ).toHaveLength(2)
    expect(searchRecords(data, cats, '', { tag: 'ramen' })).toHaveLength(1)
  })

  it('empty query matches all (filtered) records', () => {
    expect(searchRecords(data, cats, '   ', {})).toHaveLength(4) // archived excluded
  })

  it('sorts by createdAt desc / date / price desc / price asc', () => {
    const priced = [
      rec({ title: 'a', price: 100, date: '2026-01-01' }),
      rec({ title: 'b', price: 900, date: '2026-01-03' }),
      rec({ title: 'c', price: 50, date: '2026-01-02' }),
    ]
    expect(searchRecords(priced, [], '', {}, 'priceAsc').map((r) => r.title)).toEqual(['c', 'a', 'b'])
    expect(searchRecords(priced, [], '', {}, 'priceDesc').map((r) => r.title)).toEqual(['b', 'a', 'c'])
    expect(searchRecords(priced, [], '', {}, 'date').map((r) => r.title)).toEqual(['b', 'c', 'a'])
    expect(searchRecords(priced, [], '', {}, 'createdAt').map((r) => r.title)).toEqual(['c', 'b', 'a'])
  })
})
