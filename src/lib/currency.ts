import type { ConsumptionRecord, RateCacheEntry } from '../db/types'
import { effectivePrice } from './records'

/** Common currencies for the settings dropdown (spec §5.5 allows custom codes too). */
export const COMMON_CURRENCIES = [
  'TWD', 'JPY', 'USD', 'EUR', 'KRW', 'CNY', 'HKD', 'GBP', 'THB', 'SGD', 'AUD', 'CAD',
] as const

export interface RateSource {
  /** manualRates from settings — highest priority. */
  manualRates: Record<string, number>
  /** rateCache entry (ECB-based, fetched earlier). */
  cache?: RateCacheEntry | null
}

/**
 * Convert `amount` from `from` to `to`.
 *
 * Returns null when no rate is available — we never invent numbers (spec §6.3
 * 「不捏造數字」).
 *
 * Semantics of stored rates: rates are quoted vs an implicit base of
 * `cache.base` … i.e. `rates[CUR]` = how many CUR per 1 unit of base. So
 * `amount(from) → base → to`.
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  source: RateSource,
): number | null {
  if (from === to) return amount
  const upper = (c: string) => c.toUpperCase()
  from = upper(from)
  to = upper(to)

  const manualRates = source.manualRates ?? {}
  const cache = source.cache

  // Manual override: manualRates[CUR] = units of CUR per 1 unit of default (to) currency.
  if (manualRates[from] !== undefined && manualRates[from] > 0) {
    return amount / manualRates[from]
  }
  if (!cache) return null
  if (cache.base !== to) return null // cache quoted against a different base — unusable here

  const rateFrom = from === cache.base ? undefined : cache.rates[from]
  // `to` equals cache.base already, so target rate is 1 by definition.
  if (from === cache.base) return amount
  if (rateFrom !== undefined && rateFrom > 0) {
    return amount / rateFrom
  }
  return null
}

export interface MonthInsight {
  /** Total in default currency; only records we could convert. */
  total: number
  /** Original amounts per foreign currency involved, e.g. { JPY: 12000 }. Excludes default currency. */
  foreignAmounts: Record<string, number>
  /** True when some amount could not be converted (no rate). */
  hadUnconverted: boolean
  /** Top categories by converted total. */
  topCategories: Array<{ categoryId: string | null; total: number }>
  /** trip:* tag subtotals in default currency (converted where possible). */
  tripTotals: Array<{ tag: string; total: number }>
}

/** Insights for the collection header — calm, text-first (spec §5.1). */
export function computeMonthInsight(
  records: ConsumptionRecord[],
  yearMonth: string, // 'yyyy-mm'
  defaultCurrency: string,
  source: RateSource,
): MonthInsight {
  let total = 0
  const foreign: Record<string, number> = {}
  let hadUnconverted = false
  const byCategory = new Map<string | null, number>()
  const byTrip = new Map<string, number>()

  for (const rec of records) {
    if (rec.status === 'archived') continue
    if (!rec.date || !rec.date.startsWith(yearMonth)) continue
    const price = effectivePrice(rec)
    if (price === undefined) continue
    const currency = (rec.currency ?? defaultCurrency).toUpperCase()

    let converted: number | null
    if (currency === defaultCurrency.toUpperCase()) {
      converted = price
    } else {
      foreign[currency] = (foreign[currency] ?? 0) + price
      converted = convert(price, currency, defaultCurrency, source)
    }

    if (converted === null) {
      hadUnconverted = true
    } else {
      total += converted
      byCategory.set(
        rec.categoryId ?? null,
        (byCategory.get(rec.categoryId ?? null) ?? 0) + converted,
      )
      for (const tag of rec.tags) {
        if (tag.startsWith('trip:')) {
          byTrip.set(tag, (byTrip.get(tag) ?? 0) + converted)
        }
      }
    }
  }

  return {
    total,
    foreignAmounts: foreign,
    hadUnconverted,
    topCategories: [...byCategory.entries()]
      .map(([categoryId, t]) => ({ categoryId, total: t }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    tripTotals: [...byTrip.entries()]
      .map(([tag, t]) => ({ tag, total: t }))
      .sort((a, b) => b.total - a.total),
  }
}

/** Intl-based currency formatting without rounding surprises. */
export function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString(locale)}`
  }
}
