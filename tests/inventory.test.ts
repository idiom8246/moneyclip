import { describe, expect, it } from 'vitest'
import { freshDb } from './helpers'
import {
  addFromItem,
  deleteInventoryItem,
  discardItem,
  displayStatus,
  expiringSoon,
  isTracked,
  markStatus,
  markUsed,
  usageTimeline,
} from '../src/lib/inventory'
import type { InventoryItem } from '../src/db/types'

function mkItem(p: Partial<InventoryItem>): InventoryItem {
  return {
    id: 'x', name: 'Milk', status: 'unopened', qty: 1,
    createdAt: 0, updatedAt: 0, ...p,
  }
}

describe('inventory state machine', () => {
  it('addFromItem guards duplicates per record+item', async () => {
    const db = await freshDb()
    const first = await addFromItem({ name: 'Milk', sourceRecordId: 'r1', sourceItemName: 'Milk' }, db)
    expect(first).not.toBeNull()
    const dup = await addFromItem({ name: 'Milk', sourceRecordId: 'r1', sourceItemName: 'Milk' }, db)
    expect(dup).toBeNull()
    expect(await isTracked('r1', 'Milk', db)).toBe(true)
    // same item from another record = a new physical item
    expect(await addFromItem({ name: 'Milk', sourceRecordId: 'r2', sourceItemName: 'Milk' }, db)).not.toBeNull()
  })

  it('markUsed shrinks qty, flips unopened→opened, logs events', async () => {
    const db = await freshDb()
    const it1 = (await addFromItem({ name: 'Shampoo', qty: 4 }, db))!
    await markUsed(it1.id, 50, db)
    const after = await db.inventory.get(it1.id)
    expect(after?.qty).toBe(2)
    expect(after?.status).toBe('opened')
    const events = await usageTimeline(it1.id, db)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'used', amountPct: 50 })
  })

  it('finish/expired/discard write their events; displayStatus derives expiry', async () => {
    const db = await freshDb()
    const it1 = (await addFromItem({ name: 'Cake', expiresAt: '2020-01-01' }, db))!
    expect(displayStatus(it1)).toBe('expired') // derived, stored status untouched
    expect((await db.inventory.get(it1.id))?.status).toBe('unopened')

    await markStatus(it1.id, 'finished', db)
    await discardItem(it1.id, db)
    const events = await usageTimeline(it1.id, db)
    // same-millisecond events may tie — compare as a set
    expect(events.map((e) => e.kind).sort()).toEqual(['discarded', 'finished'])
    expect(await db.inventory.get(it1.id)).toMatchObject({ status: 'finished' })
  })

  it('expiringSoon windows by date and skips finished items', async () => {
    const items = [
      mkItem({ id: 'a', expiresAt: '2020-01-05' }), // past → expired, not "soon"
      mkItem({ id: 'b', expiresAt: '2020-01-03' }), // within window of 2020-01-01+3d
      mkItem({ id: 'c', status: 'finished', expiresAt: '2020-01-02' }),
      mkItem({ id: 'd' }), // no expiry
    ]
    const soon = expiringSoon(items, 3, '2020-01-01')
    expect(soon.map((i) => i.id)).toEqual(['b'])
  })

  it('delete removes the item and its timeline', async () => {
    const db = await freshDb()
    const it1 = (await addFromItem({ name: 'x' }, db))!
    await markUsed(it1.id, 10, db)
    await deleteInventoryItem(it1.id, db)
    expect(await db.inventory.get(it1.id)).toBeUndefined()
    expect(await usageTimeline(it1.id, db)).toHaveLength(0)
  })
})
