import type { Category, ConsumptionRecord, RecordItem } from '../db/types'
import { convert, type RateSource } from './currency'
import { effectivePrice } from './records'
import { isPurchaseItem, itemUnitPrice, productKey } from './invoice'

/**
 * Pure computations for the dossier / store / trip / reports pages.
 * Conversion rule everywhere (pinned): item/record snapshot → live convert
 * → unconverted (never invented).
 */

export function normalizeItemName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Barcode identity wins; names fall back to exact-on-normalized matching. */
export function itemKey(it: RecordItem): string {
  return productKey(it)
}

export interface DossierPurchase {
  date?: string
  merchant?: string
  qty?: number
  /** Raw unit price in the record's currency. */
  unitPrice?: number
  originalPrice?: number
  unit?: string
  priceBasis?: RecordItem['priceBasis']
  unallocatedDiscount?: boolean
  currency?: string
  /** Snapshot taken at save time, in the base currency (absent on legacy rows). */
  baseUnitPrice?: number
  /** Snapshot/converted unit price in the base currency (absent when unconvertible). */
  converted?: number
  unconverted?: boolean
  recordId: string
}

export interface Dossier {
  key: string
  /** Most recent raw item name — barcode-only entries surface the raw barcode. */
  name: string
  purchases: DossierPurchase[]
  min?: number
  max?: number
  avg?: number
  count: number
}

interface FlatPurchase extends DossierPurchase {
  name: string
  dateValue: number
}

function itemMatches(it: RecordItem, key: string): boolean {
  return itemKey(it) === key
}

export function priceHistory(
  records: ConsumptionRecord[],
  key: string,
  base: string,
  rateSource: RateSource,
): Dossier {
  const purchases: FlatPurchase[] = []
  for (const rec of records) {
    for (const it of rec.items ?? []) {
      if (!isPurchaseItem(it) || !itemMatches(it, key)) continue
      const unitPrice = itemUnitPrice(it)
      const currency = (rec.currency ?? base).toUpperCase()
      let converted: number | null
      if (it.baseUnitPrice !== undefined) {
        converted = it.baseUnitPrice
      } else if (unitPrice === undefined || currency === base.toUpperCase()) {
        converted = unitPrice ?? null
      } else {
        converted = convert(unitPrice, currency, base, rateSource)
      }
      purchases.push({
        name: it.name,
        date: rec.date,
        merchant: rec.merchant,
        qty: it.qty,
        unitPrice,
        unit: it.unit,
        priceBasis: it.lineTotal !== undefined ? (it.priceBasis ?? 'after_line_discounts') : (it.priceBasis ?? 'printed_unit'),
        unallocatedDiscount: rec.invoice?.adjustments?.some((a) => a.scope === 'receipt' && !a.itemIds?.length) || rec.items?.some((i) => i.lineKind === 'adjustment'),
        originalPrice: it.originalPrice,
        currency: rec.currency,
        baseUnitPrice: it.baseUnitPrice,
        converted: converted ?? undefined,
        unconverted: converted === null,
        recordId: rec.id,
        dateValue: rec.date ? Number(rec.date.replaceAll('-', '')) : -1,
      })
    }
  }
  purchases.sort((a, b) => b.dateValue - a.dateValue)

  const convertible = purchases
    .map((p) => p.converted)
    .filter((n): n is number => n !== undefined)
  const sum = convertible.reduce((a, b) => a + b, 0)
  return {
    key,
    name: purchases[0]?.name ?? '',
    purchases,
    min: convertible.length ? Math.min(...convertible) : undefined,
    max: convertible.length ? Math.max(...convertible) : undefined,
    avg: convertible.length ? sum / convertible.length : undefined,
    count: purchases.length,
  }
}

// ---------- merchant stats ----------

export interface MerchantStats {
  displayName: string
  visits: number
  total: number
  avgPerVisit: number
  unconvertedCount: number
  topItems: Array<{ name: string; count: number }>
  receipts: ConsumptionRecord[]
}

function merchantKey(merchant: string | undefined): string {
  return normalizeItemName(merchant ?? '')
}

export function merchantStats(
  records: ConsumptionRecord[],
  merchant: string,
  base: string,
  rateSource: RateSource,
): MerchantStats {
  const key = merchantKey(merchant)
  const receipts = records.filter((r) => r.status === 'active' && merchantKey(r.merchant) === key)
  const casing = new Map<string, number>()
  const items = new Map<string, { name: string; count: number }>()
  let total = 0
  let unconvertedCount = 0

  for (const rec of receipts) {
    const raw = rec.merchant ?? ''
    casing.set(raw, (casing.get(raw) ?? 0) + 1)
    const price = effectivePrice(rec)
    const currency = (rec.currency ?? base).toUpperCase()
    let converted: number | null
    if (currency === base.toUpperCase()) converted = price ?? 0
    else if (price !== undefined && rec.basePrice !== undefined) converted = rec.basePrice
    else if (price !== undefined) converted = convert(price, currency, base, rateSource)
    else converted = null

    if (converted === null) unconvertedCount++
    else total += converted

    for (const it of rec.items ?? []) {
      if (!isPurchaseItem(it)) continue
      const n = normalizeItemName(it.name)
      if (!n) continue
      const entry = items.get(n) ?? { name: it.name, count: 0 }
      entry.count++
      items.set(n, entry)
    }
  }

  const displayName = [...casing.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? merchant
  return {
    displayName,
    visits: receipts.length,
    total,
    avgPerVisit: receipts.length ? total / receipts.length : 0,
    unconvertedCount,
    topItems: [...items.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    receipts: [...receipts].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
  }
}

// ---------- trip report ----------

export interface TripReport {
  tag: string
  receipts: ConsumptionRecord[]
  dateRange?: [string, string]
  byCurrency: Record<string, number>
  convertedTotal: number
  convertedForeignCount: number
  unconvertedCount: number
  unconvertedByCurrency: Record<string, number>
  byCategory: Array<{ categoryId: string | null; total: number }>
  savings: number
  savingsCount: number
}

/** Σ (originalPrice − unitPrice) × qty across a set of records, clamped ≥0. */
function sumSavings(
  rows: ConsumptionRecord[],
  base: string,
  rateSource: RateSource,
): { savings: number; savingsCount: number } {
  let savings = 0
  let savingsCount = 0
  for (const rec of rows) {
    const currency = (rec.currency ?? base).toUpperCase()
    for (const it of rec.items ?? []) {
      if (!isPurchaseItem(it)) continue
      const paidUnit = itemUnitPrice(it)
      if (it.originalPrice === undefined || paidUnit === undefined || it.priceQuantity || (it.priceUnit && it.priceUnit !== it.unit)) continue
      const savedUnit = it.originalPrice - paidUnit
      if (savedUnit <= 0) continue
      const saved = savedUnit * (it.qty ?? 1)
      let convertedSaved: number | null
      if (currency === base.toUpperCase()) convertedSaved = saved
      else if (it.baseUnitPrice !== undefined && paidUnit > 0)
        convertedSaved = saved * (it.baseUnitPrice / paidUnit)
      else convertedSaved = convert(saved, currency, base, rateSource)
      if (convertedSaved === null) continue
      savings += convertedSaved
      savingsCount++
    }
  }
  return { savings, savingsCount }
}

export function tripReport(
  records: ConsumptionRecord[],
  tag: string,
  base: string,
  rateSource: RateSource,
): TripReport {
  const receipts = records
    .filter((r) => r.status === 'active' && r.tags.includes(tag))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  const byCurrency: Record<string, number> = {}
  const unconvertedByCurrency: Record<string, number> = {}
  const byCategory = new Map<string | null, number>()
  let convertedTotal = 0
  let convertedForeignCount = 0
  let unconvertedCount = 0
  let minDate: string | undefined
  let maxDate: string | undefined

  for (const rec of receipts) {
    if (rec.date && (!minDate || rec.date < minDate)) minDate = rec.date
    if (rec.date && (!maxDate || rec.date > maxDate)) maxDate = rec.date
    const price = effectivePrice(rec)
    if (price === undefined) continue
    const currency = (rec.currency ?? base).toUpperCase()
    if (currency !== base.toUpperCase()) byCurrency[currency] = (byCurrency[currency] ?? 0) + price

    let converted: number | null
    if (currency === base.toUpperCase()) converted = price
    else if (rec.basePrice !== undefined) converted = rec.basePrice
    else converted = convert(price, currency, base, rateSource)

    if (converted === null) {
      unconvertedCount++
      unconvertedByCurrency[currency] = (unconvertedByCurrency[currency] ?? 0) + price
    } else {
      if (currency !== base.toUpperCase()) convertedForeignCount++
      convertedTotal += converted
      byCategory.set(rec.categoryId ?? null, (byCategory.get(rec.categoryId ?? null) ?? 0) + converted)
    }
  }

  return {
    tag,
    receipts,
    dateRange: minDate ? [minDate, maxDate ?? minDate] : undefined,
    byCurrency,
    convertedTotal,
    convertedForeignCount,
    unconvertedCount,
    unconvertedByCurrency,
    byCategory: [...byCategory.entries()]
      .map(([categoryId, total]) => ({ categoryId, total }))
      .sort((a, b) => b.total - a.total),
    ...sumSavings(receipts, base, rateSource),
  }
}

// ---------- monthly report ----------

export interface MonthReport {
  month: string
  total: number
  count: number
  convertedForeignCount: number
  unconvertedCount: number
  unconvertedByCurrency: Record<string, number>
  byCategory: Array<{ categoryId: string | null; total: number }>
  byMerchant: Array<{ merchant: string; total: number }>
  savings: number
  savingsCount: number
}

export function reportMonth(
  records: ConsumptionRecord[],
  month: string,
  base: string,
  rateSource: RateSource,
): MonthReport {
  const rows = records.filter((r) => r.status === 'active' && r.date?.startsWith(month))
  const byCategory = new Map<string | null, number>()
  const byMerchant = new Map<string, { merchant: string; total: number }>()
  const unconvertedByCurrency: Record<string, number> = {}
  let total = 0
  let convertedForeignCount = 0
  let unconvertedCount = 0

  for (const rec of rows) {
    const price = effectivePrice(rec)
    const currency = (rec.currency ?? base).toUpperCase()
    let converted: number | null
    if (price === undefined) converted = null
    else if (currency === base.toUpperCase()) converted = price
    else if (rec.basePrice !== undefined) converted = rec.basePrice
    else converted = convert(price, currency, base, rateSource)

    if (converted === null) {
      unconvertedCount++
      if (price !== undefined) unconvertedByCurrency[currency] = (unconvertedByCurrency[currency] ?? 0) + price
    } else {
      if (currency !== base.toUpperCase()) convertedForeignCount++
      total += converted
      byCategory.set(rec.categoryId ?? null, (byCategory.get(rec.categoryId ?? null) ?? 0) + converted)
      const mKey = merchantKey(rec.merchant)
      if (mKey) {
        const entry = byMerchant.get(mKey) ?? { merchant: rec.merchant ?? '', total: 0 }
        entry.total += converted
        byMerchant.set(mKey, entry)
      }
    }
  }
  return {
    month,
    total,
    count: rows.length,
    convertedForeignCount,
    unconvertedCount,
    unconvertedByCurrency,
    byCategory: [...byCategory.entries()]
      .map(([categoryId, t]) => ({ categoryId, total: t }))
      .sort((a, b) => b.total - a.total),
    byMerchant: [...byMerchant.values()]
      .sort((a, b) => b.total - a.total)
      .map(({ merchant, total }) => ({ merchant, total })),
    ...sumSavings(rows, base, rateSource),
  }
}

/** Distinct active months, newest first — the Reports page stepper. */
export function availableMonths(records: ConsumptionRecord[]): string[] {
  const months = new Set<string>()
  for (const r of records) {
    if (r.status === 'active' && r.date) months.add(r.date.slice(0, 7))
  }
  return [...months].sort((a, b) => b.localeCompare(a))
}

/** Re-export so pages can map category ids without importing lib/search. */
export type { Category }
