import type { Category, ConsumptionRecord, SaveReason } from '../db/types'
import { effectivePrice } from './records'
import { invoiceSearchText } from './invoice'

export type SortKey = 'createdAt' | 'date' | 'priceDesc' | 'priceAsc'

export interface SearchFilters {
  categoryId?: string | null
  saveReason?: SaveReason | null
  favoriteOnly?: boolean
  /** Default false per spec §5.4. */
  includeArchived?: boolean
  dateFrom?: string
  dateTo?: string
  /** Free-text tag filter (collection chips). */
  tag?: string | null
}

const norm = (s: string | undefined): string => (s ?? '').toLowerCase()

export function recordMatchesQuery(
  rec: ConsumptionRecord,
  query: string,
  category?: Category,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystacks = [
    rec.title,
    rec.merchant,
    rec.note,
    category?.name,
    category?.nameEn,
    ...rec.tags,
    invoiceSearchText(rec.items),
    invoiceSearchText(rec.invoice),
  ]
  return haystacks.some((h) => norm(h).includes(q))
}

export function recordMatchesFilters(
  rec: ConsumptionRecord,
  filters: SearchFilters,
): boolean {
  if (!filters.includeArchived && rec.status === 'archived') return false
  if (filters.favoriteOnly && !rec.favorite) return false
  if (filters.categoryId && rec.categoryId !== filters.categoryId) return false
  if (filters.saveReason && rec.saveReason !== filters.saveReason) return false
  if (filters.tag && !rec.tags.includes(filters.tag)) return false
  if (filters.dateFrom && (!rec.date || rec.date < filters.dateFrom)) return false
  if (filters.dateTo && (!rec.date || rec.date > filters.dateTo)) return false
  return true
}

export function sortRecords(
  records: ConsumptionRecord[],
  sort: SortKey,
): ConsumptionRecord[] {
  const arr = [...records]
  switch (sort) {
    case 'createdAt':
      return arr.sort((a, b) => b.createdAt - a.createdAt)
    case 'date':
      return arr.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    case 'priceDesc':
      return arr.sort((a, b) => (effectivePrice(b) ?? -1) - (effectivePrice(a) ?? -1))
    case 'priceAsc':
      return arr.sort((a, b) => {
        const pa = effectivePrice(a)
        const pb = effectivePrice(b)
        if (pa === undefined && pb === undefined) return 0
        if (pa === undefined) return 1
        if (pb === undefined) return -1
        return pa - pb
      })
  }
}

/**
 * Full search pipeline: filter → match → sort.
 * Text matching covers title/merchant/note/tags/category names, case-insensitive
 * substring (spec §5.4). Item names are included too (cheap, helps receipts).
 */
export function searchRecords(
  records: ConsumptionRecord[],
  categories: Category[],
  query: string,
  filters: SearchFilters = {},
  sort: SortKey = 'createdAt',
): ConsumptionRecord[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const matched = records.filter(
    (rec) =>
      recordMatchesFilters(rec, filters) &&
      recordMatchesQuery(rec, query, rec.categoryId ? byId.get(rec.categoryId) : undefined),
  )
  return sortRecords(matched, sort)
}

export function categoryDisplayName(cat: Category, locale: string): string {
  return locale.startsWith('en') ? (cat.nameEn ?? cat.name) : cat.name
}
