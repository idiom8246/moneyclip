import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import type { Attachment, Category, ConsumptionRecord } from './db/types'
import { useSetting } from './lib/settings'
import { ensureRates } from './lib/rates'
import { useEffect, useState } from 'react'

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


