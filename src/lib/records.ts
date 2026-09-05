import type { MoneyclipDB } from '../db/db'
import { db as defaultDb } from '../db/db'
import type {
  Attachment,
  Category,
  ConsumptionRecord,
  RecordItem,
} from '../db/types'
import { uid } from './uid'
import { computeSnapshots } from './snapshots'
import type { RateSource } from './currency'
import { itemLineTotal, itemUnitPrice } from './invoice'
import { decimal, decimalSum } from './decimal'

export type RecordInput = Omit<
  ConsumptionRecord,
  'id' | 'createdAt' | 'updatedAt' | 'tags' | 'favorite' | 'status'
> & {
  tags?: string[]
  favorite?: boolean
  status?: ConsumptionRecord['status']
}

/** Optional currency-snapshot context: base currency + available rates. */
export interface SnapshotContext {
  base: string
  rateSource: RateSource
}

export async function createRecord(
  input: RecordInput,
  database: MoneyclipDB = defaultDb,
  snap?: SnapshotContext,
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
  const withSnapshots = snap ? computeSnapshots(record, snap.base, snap.rateSource) : record
  await database.records.add(withSnapshots)
  return withSnapshots
}

export async function updateRecord(
  id: string,
  patch: Partial<Omit<ConsumptionRecord, 'id' | 'createdAt'>>,
  database: MoneyclipDB = defaultDb,
  snap?: SnapshotContext,
): Promise<void> {
  // createdAt is preserved; only updatedAt moves (spec §4 records).
  let next: Partial<ConsumptionRecord> & { updatedAt: number } = { ...patch, updatedAt: Date.now() }
  if (snap && (patch.price !== undefined || patch.currency !== undefined || patch.items !== undefined)) {
    const existing = await database.records.get(id)
    if (existing) {
      const merged = { ...existing, ...patch }
      const withSnapshots = computeSnapshots(merged, snap.base, snap.rateSource)
      next = {
        ...next,
        basePrice: withSnapshots.basePrice,
        items: withSnapshots.items,
      }
    }
  }
  await database.records.update(id, next)
}

/**
 * One-time lazy backfill: legacy foreign-currency records that never got a
 * snapshot (rate was missing at save / imported / edited raw) are frozen
 * with whatever rate is available NOW. Already-snapshotted records are
 * never touched — history stays put.
 */
export async function backfillMissingSnapshots(
  database: MoneyclipDB,
  base: string,
  rateSource: RateSource,
): Promise<number> {
  const baseUpper = base.toUpperCase()
  const candidates = (await database.records.toArray()).filter(
    (r) =>
      r.currency !== undefined &&
      r.currency.toUpperCase() !== baseUpper &&
      ((r.basePrice === undefined && r.price !== undefined) ||
        (r.items ?? []).some((i) => i.baseUnitPrice === undefined && itemUnitPrice(i) !== undefined)),
  )
  let filled = 0
  for (const rec of candidates) {
    const withSnapshots = computeSnapshots(rec, base, rateSource)
    withSnapshots.basePrice = rec.basePrice ?? withSnapshots.basePrice
    withSnapshots.items = withSnapshots.items?.map((item, index) => ({ ...item,
      baseUnitPrice: rec.items?.[index].baseUnitPrice ?? item.baseUnitPrice,
    }))
    if ((rec.basePrice === undefined && withSnapshots.basePrice !== undefined) ||
      withSnapshots.items?.some((item, index) => rec.items?.[index].baseUnitPrice === undefined && item.baseUnitPrice !== undefined)) {
      await database.records.put({ ...rec, ...withSnapshots, updatedAt: rec.updatedAt })
      filled++
    }
  }
  return filled
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
  const amounts = (items ?? []).map(itemLineTotal).filter((v): v is string => v !== undefined)
  return amounts.length ? Number(decimalSum(amounts)) : undefined
}

/**
 * Effective display price: items auto-sum wins when present (spec §4 /
 * Record.items), manual price otherwise. Manual override is handled at the
 * data level: callers may keep `price` even when items exist (外幣找零 etc.).
 */
export function effectivePrice(rec: ConsumptionRecord): number | undefined {
  return rec.price ?? (decimal(rec.invoice?.totals?.payable) !== undefined ? Number(rec.invoice!.totals!.payable) : itemsAutoTotal(rec.items))
}
