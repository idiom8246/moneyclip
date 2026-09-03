import Dexie, { type Table } from 'dexie'
import type {
  Attachment,
  Category,
  ConsumptionRecord,
  InventoryItem,
  ProductCacheEntry,
  RateCacheEntry,
  SettingRow,
  UsageEvent,
} from './types'
import type { FormDraft } from '../lib/drafts'
import type { ShoppingItem } from '../lib/shoppingList'

export class MoneyclipDB extends Dexie {
  records!: Table<ConsumptionRecord, string>
  categories!: Table<Category, string>
  attachments!: Table<Attachment, string>
  settings!: Table<SettingRow, string>
  productCache!: Table<ProductCacheEntry, string>
  rateCache!: Table<RateCacheEntry, string>
  drafts!: Table<FormDraft & { id: string }, string>
  shoppingList!: Table<ShoppingItem, string>
  inventory!: Table<InventoryItem, string>
  usageEvents!: Table<UsageEvent, string>

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
    // v3: shopping list (Phase 2 — 清單).
    this.version(3).stores({
      shoppingList: 'id, checked, createdAt',
    })
    // v4: inventory + usage timeline (Phase 3 — 庫存).
    this.version(4).stores({
      inventory: 'id, status, expiresAt, name, createdAt',
      usageEvents: 'id, itemId, at',
    })
  }
}

export const db = new MoneyclipDB()
