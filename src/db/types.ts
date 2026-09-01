/** Domain model — aligned with spec §4. All data lives in IndexedDB via Dexie. */

export type SaveReason =
  | 'want'
  | 'bought'
  | 'remember'
  | 'compare'
  | 'recommend'
  | 'repurchase'
  | 'other'

export const SAVE_REASONS: SaveReason[] = [
  'want',
  'bought',
  'remember',
  'compare',
  'recommend',
  'repurchase',
  'other',
]

export type RecordStatus = 'active' | 'archived'

export interface RecordItem {
  id: string
  name: string
  qty?: number
  unitPrice?: number
  barcode?: string
}

/** `ConsumptionRecord` — the central entity (spec calls it `records`). */
export interface ConsumptionRecord {
  id: string
  title: string
  /** Amount in original currency; optional by design (item-first, not amount-first). */
  price?: number
  /** ISO 4217, e.g. HKD, JPY. */
  currency?: string
  /** ISO yyyy-mm-dd. */
  date?: string
  merchant?: string
  categoryId?: string | null
  tags: string[]
  note?: string
  saveReason?: SaveReason
  favorite: boolean
  status: RecordStatus
  items?: RecordItem[]
  createdAt: number
  updatedAt: number
}

export interface Category {
  id: string
  name: string
  /** English name for built-in categories; falls back to `name`. */
  nameEn?: string
  icon?: string
  sortOrder: number
  builtIn: boolean
}

export interface Attachment {
  id: string
  recordId: string
  blob: Blob
  thumbBlob: Blob
  createdAt: number
}

/** settings table row: { key, value } */
export interface SettingRow {
  key: string
  value: unknown
}

export interface OcrConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface AppSettings {
  defaultCurrency: string
  locale: 'zh-TW' | 'en'
  theme: 'system' | 'light' | 'dark'
  ocrConfig: OcrConfig
  manualRates: Record<string, number>
  /** Last 5 search queries (spec §5.4 initial screen). */
  recentSearches: string[]
  /** Last 8 viewed record ids (spec §5.4 initial screen). */
  recentViewed: string[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  // HKD is the shipped default for HK-based users. Existing users keep their
  // stored setting — getSetting() prefers the settings table over this value.
  defaultCurrency: 'HKD',
  locale: 'zh-TW',
  theme: 'system',
  ocrConfig: { baseUrl: '', apiKey: '', model: '' },
  manualRates: {},
  recentSearches: [],
  recentViewed: [],
}

export interface ProductCacheEntry {
  barcode: string
  name: string
  brand?: string
  imageUrl?: string
  cachedAt: number
}

export interface RateCacheEntry {
  /** Base currency the rates were fetched against, e.g. "TWD". */
  base: string
  rates: Record<string, number>
  fetchedAt: number
  source: string
}
