import type { MoneyclipDB } from '../db/db'
import { db as defaultDb } from '../db/db'
import type { RateCacheEntry } from '../db/types'

/**
 * Exchange rates via frankfurter.dev (ECB reference, free, no key — spec §3).
 * All failures degrade silently; callers fall back to cache or "unconverted".
 */

const API = 'https://api.frankfurter.dev/v1'

export async function fetchRates(
  base: string,
  database: MoneyclipDB = defaultDb,
): Promise<RateCacheEntry> {
  const res = await fetch(`${API}/latest?base=${encodeURIComponent(base)}`)
  if (!res.ok) throw new Error(`rate-fetch-failed:${res.status}`)
  const data = (await res.json()) as { rates: Record<string, number> }
  const entry: RateCacheEntry = {
    base,
    rates: data.rates,
    fetchedAt: Date.now(),
    source: 'frankfurter.dev',
  }
  await database.rateCache.put(entry)
  return entry
}

/** Cached entry, or fetched fresh when missing/older than maxAgeMs; null offline. */
export async function ensureRates(
  base: string,
  database: MoneyclipDB = defaultDb,
  maxAgeMs = 24 * 60 * 60 * 1000,
): Promise<RateCacheEntry | null> {
  const cached = await database.rateCache.get(base)
  if (cached && Date.now() - cached.fetchedAt < maxAgeMs) return cached
  try {
    return await fetchRates(base, database)
  } catch {
    return cached ?? null
  }
}
