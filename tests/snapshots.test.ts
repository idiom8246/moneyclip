import { describe, expect, it } from 'vitest'
import { freshDb } from './helpers'
import { backfillMissingSnapshots, createRecord, updateRecord } from '../src/lib/records'
import type { RateSource } from '../src/lib/currency'

// 1 HKD = 4.5 JPY
const fx: RateSource = { manualRates: { JPY: 4.5 } }
const snap = { base: 'HKD', rateSource: fx }

describe('currency snapshots', () => {
  it('backfills net line-only prices once without replacing an existing snapshot', async () => {
    const db = await freshDb()
    const rec = await createRecord({ title: 'net', currency: 'JPY', basePrice: 123,
      items: [{ id: 'i', name: 'tea', qty: 2, lineTotal: '90.00' }],
    }, db)
    expect(await backfillMissingSnapshots(db, 'HKD', fx)).toBe(1)
    const saved = await db.records.get(rec.id)
    expect(saved?.basePrice).toBe(123)
    expect(saved?.items?.[0].baseUnitPrice).toBe(10)
    expect(await backfillMissingSnapshots(db, 'HKD', fx)).toBe(0)
  })
  it('freezes basePrice + item.baseUnitPrice for foreign-currency records', async () => {
    const db = await freshDb()
    const rec = await createRecord(
      { title: 'Donki', currency: 'JPY', price: 680, items: [{ id: 'i1', name: 'x', unitPrice: 680 }] },
      db,
      snap,
    )
    expect(rec.basePrice).toBeCloseTo(680 / 4.5)
    expect(rec.items?.[0].baseUnitPrice).toBeCloseTo(680 / 4.5)
  })

  it('stores no snapshot for base-currency records', async () => {
    const db = await freshDb()
    const rec = await createRecord({ title: 'HK', currency: 'HKD', price: 50, items: [] }, db, snap)
    expect(rec.basePrice).toBeUndefined()
  })

  it('drops the snapshot when no rate is available', async () => {
    const db = await freshDb()
    const rec = await createRecord(
      { title: 'NoRate', currency: 'XYZ', price: 10, items: [] },
      db,
      { base: 'HKD', rateSource: { manualRates: {} } },
    )
    expect(rec.basePrice).toBeUndefined()
  })

  it('recomputes on edit; drops when the rate disappears', async () => {
    const db = await freshDb()
    const rec = await createRecord({ title: 't', currency: 'JPY', price: 450, items: [] }, db, snap)
    expect(rec.basePrice).toBeCloseTo(100)

    await updateRecord(rec.id, { price: 900 }, db, snap)
    expect((await db.records.get(rec.id))?.basePrice).toBeCloseTo(200)

    await updateRecord(rec.id, { price: 450 }, db, { base: 'HKD', rateSource: { manualRates: {} } })
    expect((await db.records.get(rec.id))?.basePrice).toBeUndefined()
  })

  it('backfills only legacy records that never had a snapshot', async () => {
    const db = await freshDb()
    const legacy = await createRecord({ title: 'legacy', currency: 'JPY', price: 450, items: [] }, db)
    expect(legacy.basePrice).toBeUndefined()

    const patched = await db.records.get(legacy.id)
    await db.records.put({ ...patched!, basePrice: undefined })

    const filled = await backfillMissingSnapshots(db, 'HKD', fx)
    expect(filled).toBe(1)
    expect((await db.records.get(legacy.id))?.basePrice).toBeCloseTo(100)

    // second run: already backfilled → no-op
    expect(await backfillMissingSnapshots(db, 'HKD', fx)).toBe(0)
  })
})
