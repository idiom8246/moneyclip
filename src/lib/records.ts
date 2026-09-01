import type { MoneyclipDB } from '../db/db'
import { db as defaultDb } from '../db/db'
import type {
  Attachment,
  Category,
  ConsumptionRecord,
  RecordItem,
} from '../db/types'
import { uid } from './uid'

export type RecordInput = Omit<
  ConsumptionRecord,
  'id' | 'createdAt' | 'updatedAt' | 'tags' | 'favorite' | 'status'
> & {
  tags?: string[]
  favorite?: boolean
  status?: ConsumptionRecord['status']
}

export async function createRecord(
  input: RecordInput,
  database: MoneyclipDB = defaultDb,
): Promise<ConsumptionRecord> {
  const now = Date.now()
  const record: ConsumptionRecord = {
    favorite: false,
    status: 'active',
    ...input,
    tags: input.tags ?? [],
    id: uid(),
    createdAt: now,
    updatedAt: now,
  }
  await database.records.add(record)
  return record
}

export async function updateRecord(
  id: string,
  patch: Partial<Omit<ConsumptionRecord, 'id' | 'createdAt'>>,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  // createdAt is preserved; only updatedAt moves (spec §4 records).
  await database.records.update(id, { ...patch, updatedAt: Date.now() })
}

export async function toggleFavorite(
  id: string,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  const rec = await database.records.get(id)
  if (!rec) return
  await database.records.update(id, { favorite: !rec.favorite, updatedAt: Date.now() })
}

export async function setArchived(
  id: string,
  archived: boolean,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  await database.records.update(id, {
    status: archived ? 'archived' : 'active',
    updatedAt: Date.now(),
  })
}

/** Delete a record AND its attachments (spec §4 attachments). */
export async function deleteRecord(
  id: string,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.records, database.attachments, async () => {
    await database.attachments.where('recordId').equals(id).delete()
    await database.records.delete(id)
  })
}

// ---------- attachments ----------

export async function addAttachment(
  recordId: string,
  blob: Blob,
  thumbBlob: Blob,
  database: MoneyclipDB = defaultDb,
): Promise<Attachment> {
  const attachment: Attachment = {
    id: uid(),
    recordId,
    blob,
    thumbBlob,
    createdAt: Date.now(),
  }
  await database.attachments.add(attachment)
  return attachment
}

export async function deleteAttachment(
  id: string,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  await database.attachments.delete(id)
}

// ---------- categories ----------

export async function addCategory(
  name: string,
  database: MoneyclipDB = defaultDb,
): Promise<Category> {
  const max = await database.categories.orderBy('sortOrder').last()
  const category: Category = {
    id: uid(),
    name,
    sortOrder: (max?.sortOrder ?? -1) + 1,
    builtIn: false,
  }
  await database.categories.add(category)
  return category
}

export async function renameCategory(
  id: string,
  name: string,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  await database.categories.update(id, { name })
}

/** Delete a category; records keep existing, categoryId → null (spec §4). */
export async function deleteCategory(
  id: string,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.categories, database.records, async () => {
    await database.records.where('categoryId').equals(id).modify({ categoryId: null })
    await database.categories.delete(id)
  })
}

// ---------- items ----------

/** Sum of qty×unitPrice over items; undefined when nothing computable. */
export function itemsAutoTotal(items: RecordItem[] | undefined): number | undefined {
  if (!items || items.length === 0) return undefined
  let sum = 0
  let any = false
  for (const it of items) {
    const qty = it.qty ?? 1
    if (it.unitPrice !== undefined) {
      sum += qty * it.unitPrice
      any = true
    }
  }
  return any ? sum : undefined
}

/**
 * Effective display price: items auto-sum wins when present (spec §4 /
 * Record.items), manual price otherwise. Manual override is handled at the
 * data level: callers may keep `price` even when items exist (外幣找零 etc.).
 */
export function effectivePrice(rec: ConsumptionRecord): number | undefined {
  return rec.price ?? itemsAutoTotal(rec.items)
}
