import type { InventoryItem, InventoryStatus, UsageEvent } from '../db/types'
import type { MoneyclipDB } from '../db/db'
import { db as defaultDb } from '../db/db'
import { uid } from './uid'

/**
 * Inventory state machine (pinned):
 * - explicit 加入庫存 per item (never auto)
 * - duplicate guard on sourceRecordId + sourceItemName
 * - expiry is DERIVED for display (no auto state write); finished/expired
 *   are explicit user actions that log events
 * - no low-stock concept (pinned A: no trigger)
 */

const today = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function isTracked(
  sourceRecordId: string,
  sourceItemName: string,
  database: MoneyclipDB = defaultDb,
): Promise<boolean> {
  const hits = await database.inventory
    .filter((i) => i.sourceRecordId === sourceRecordId && i.sourceItemName === sourceItemName)
    .toArray()
  return hits.length > 0
}

export async function addFromItem(
  input: {
    name: string
    barcode?: string
    categoryId?: string | null
    qty?: number
    unit?: string
    expiresAt?: string
    sourceRecordId?: string
    sourceItemName?: string
  },
  database: MoneyclipDB = defaultDb,
): Promise<InventoryItem | null> {
  if (input.sourceRecordId && input.sourceItemName) {
    if (await isTracked(input.sourceRecordId, input.sourceItemName, database)) return null
  }
  const now = Date.now()
  const item: InventoryItem = {
    id: uid(),
    name: input.name.trim(),
    barcode: input.barcode,
    categoryId: input.categoryId ?? null,
    status: 'unopened',
    qty: input.qty && input.qty > 0 ? input.qty : 1,
    unit: input.unit,
    expiresAt: input.expiresAt,
    sourceRecordId: input.sourceRecordId,
    sourceItemName: input.sourceItemName,
    createdAt: now,
    updatedAt: now,
  }
  await database.inventory.add(item)
  return item
}

export async function logEvent(
  event: Omit<UsageEvent, 'id' | 'at'>,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  await database.usageEvents.add({ id: uid(), at: Date.now(), ...event })
}

/** Use a percentage of the item; qty shrinks proportionally. */
export async function markUsed(
  itemId: string,
  pct: number,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  const item = await database.inventory.get(itemId)
  if (!item) return
  const clamped = Math.max(0, Math.min(100, pct))
  const nextQty = Math.max(0, Math.round(item.qty * (1 - clamped / 100) * 100) / 100)
  await database.transaction('rw', database.inventory, database.usageEvents, async () => {
    await database.inventory.update(itemId, {
      qty: nextQty,
      status: item.status === 'unopened' ? 'opened' : item.status,
      openedAt: item.openedAt ?? today(),
      updatedAt: Date.now(),
    })
    await logEvent({ itemId, kind: 'used', amountPct: clamped }, database)
  })
}

export async function markStatus(
  itemId: string,
  status: Extract<InventoryStatus, 'finished' | 'expired'>,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  const item = await database.inventory.get(itemId)
  if (!item) return
  await database.transaction('rw', database.inventory, database.usageEvents, async () => {
    await database.inventory.update(itemId, { status, updatedAt: Date.now() })
    await logEvent({ itemId, kind: status }, database)
  })
}

export async function discardItem(
  itemId: string,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  // Thrown away — leaves active tracking; the event carries the reason.
  const item = await database.inventory.get(itemId)
  if (!item) return
  await database.transaction('rw', database.inventory, database.usageEvents, async () => {
    await database.inventory.update(itemId, { status: 'finished', updatedAt: Date.now() })
    await logEvent({ itemId, kind: 'discarded' }, database)
  })
}

/** Expiry is display-derived — the stored status is never auto-mutated. */
export function displayStatus(item: InventoryItem, asOf = today()): InventoryStatus {
  if (item.status === 'finished' || item.status === 'expired') return item.status
  if (item.expiresAt && item.expiresAt < asOf) return 'expired'
  return item.status
}

export function expiringSoon(items: InventoryItem[], days: number, asOf = today()): InventoryItem[] {
  const [y, m, d] = asOf.split('-').map(Number)
  const limit = new Date(y, m - 1, d + days)
  const limitStr = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`
  return items.filter(
    (i) => i.expiresAt && i.status !== 'finished' && i.expiresAt >= asOf && i.expiresAt <= limitStr,
  )
}

export async function usageTimeline(
  itemId: string,
  database: MoneyclipDB = defaultDb,
): Promise<UsageEvent[]> {
  return database.usageEvents.where('itemId').equals(itemId).reverse().sortBy('at')
}

export async function deleteInventoryItem(
  itemId: string,
  database: MoneyclipDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.inventory, database.usageEvents, async () => {
    await database.usageEvents.where('itemId').equals(itemId).delete()
    await database.inventory.delete(itemId)
  })
}
