import { useLiveQuery } from 'dexie-react-hooks'
import type { MoneyclipDB } from '../db/db'
import { db as defaultDb } from '../db/db'
import { DEFAULT_SETTINGS, type AppSettings } from '../db/types'

export async function getSetting<K extends keyof AppSettings>(
  key: K,
  database: MoneyclipDB = defaultDb,
): Promise<AppSettings[K]> {
  const row = await database.settings.get(key)
  if (row === undefined) return DEFAULT_SETTINGS[key]
  return row.value as AppSettings[K]
}

export async function setSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  await database.settings.put({ key, value })
}

export async function getAllSettings(
  database: MoneyclipDB = defaultDb,
): Promise<AppSettings> {
  const rows = await database.settings.toArray()
  const out = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    if (row.key in out) {
      ;(out as Record<string, unknown>)[row.key] = row.value
    }
  }
  return out
}

/** Reactive single-setting hook for UI. */
export function useSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const value = useLiveQuery(() => getSetting(key), [key])
  return value ?? DEFAULT_SETTINGS[key]
}
