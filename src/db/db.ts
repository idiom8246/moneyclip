import Dexie, { type Table } from 'dexie'
import type {
  Attachment,
  Category,
  ConsumptionRecord,
  ProductCacheEntry,
  RateCacheEntry,
  SettingRow,
} from './types'
import type { FormDraft } from '../lib/drafts'

export class MoneyclipDB extends Dexie {
  records!: Table<ConsumptionRecord, string>
  categories!: Table<Category, string>
  attachments!: Table<Attachment, string>
  settings!: Table<SettingRow, string>
  productCache!: Table<ProductCacheEntry, string>
  rateCache!: Table<RateCacheEntry, string>
  drafts!: Table<FormDraft & { id: string }, string>

  constructor(name = 'moneyclip') {
    super(name)
    this.version(1).stores({
      // Indexed fields per spec §4; text search is done in-memory (§7/5.4).
      records: 'id, date, categoryId, status, favorite, createdAt',
      categories: 'id, sortOrder',
      attachments: 'id, recordId',
      settings: 'key',
      productCache: 'barcode',
      rateCache: 'base',
    })
    // v2: unsaved add-form draft (incl. staged photo blobs) — kills the
    // "tab died, receipt gone" failure mode.
    this.version(2).stores({
      drafts: 'id',
    })
  }
}

export const db = new MoneyclipDB()
