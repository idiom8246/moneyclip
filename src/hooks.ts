import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import type { Attachment, Category, ConsumptionRecord } from './db/types'
import type { ShoppingItem } from './lib/shoppingList'
import { useSetting, getSetting } from './lib/settings'
import { ensureRates } from './lib/rates'
import type { RateSource } from './lib/currency'
import { useEffect, useMemo, useState } from 'react'
import type { URLSearchParamsInit } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'

export function useRecords(): ConsumptionRecord[] | undefined {
  return useLiveQuery(() => db.records.orderBy('createdAt').reverse().toArray(), [])
}

export function useRecord(id: string | undefined): ConsumptionRecord | undefined {
  return useLiveQuery(() => (id ? db.records.get(id) : undefined), [id])
}

export function useCategories(): Category[] | undefined {
  return useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), [])
}

export function useAttachments(recordId: string | undefined): Attachment[] | undefined {
  return useLiveQuery(
    () => (recordId ? db.attachments.where('recordId').equals(recordId).toArray() : []),
    [recordId],
  )
}

/** All historical tags, sorted by frequency — used for tag autocomplete. */
export function useAllTags(): string[] {
  const records = useRecords()
  if (!records) return []
  const counts = new Map<string, number>()
  for (const r of records) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag)
}

export { useSetting }

/** Exchange-rate cache for the given base; refreshes best-effort. */
export function useRates(base: string) {
  const [tick, setTick] = useState(0)
  const entry = useLiveQuery(() => db.rateCache.get(base), [base, tick])
  useEffect(() => {
    let cancelled = false
    void ensureRates(base)
      .then(() => !cancelled && setTick((t) => t + 1))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [base])
  return entry
}

/** manualRates + rateCache bundled — the RateSource every conversion needs. */
export function useRateSource(): RateSource {
  const manualRates = useSetting('manualRates')
  const defaultCurrency = useSetting('defaultCurrency')
  const cache = useRates(defaultCurrency)
  return useMemo(() => ({ manualRates, cache: cache ?? null }), [manualRates, cache])
}

/** Last N search queries (spec §5.4 initial screen). */
export function useRecentSearches(): string[] {
  return useLiveQuery(() => getSetting('recentSearches'), [], []) ?? []
}

/** Pagination for large lists (spec §8: 分頁/虛擬化). */
export function usePagedList<T>(items: T[], pageSize = 100) {
  const [count, setCount] = useState(pageSize)
  useEffect(() => setCount(pageSize), [items, pageSize])
  return {
    visible: items.slice(0, count),
    hasMore: items.length > count,
    loadMore: () => setCount((c) => c + pageSize),
  }
}

/** Shopping list, oldest first — unchecked on top when rendering. */
export function useShoppingItems(): ShoppingItem[] | undefined {
  return useLiveQuery(() => db.shoppingList.orderBy('createdAt').toArray(), [])
}

/** Shared single URL-param setter for filter chips (Collection & Search). */
export function useSetSearchParam() {
  const [, setSearchParams] = useSearchParams()
  return (key: string, value: string | null, other?: URLSearchParamsInit) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })
    void other
  }
}


