import { describe, expect, it } from 'vitest'
import { freshDb } from './helpers'
import { createRecord, addAttachment } from '../src/lib/records'
import { exportCSV, exportJSON, importJSON } from '../src/lib/exportImport'
import { MoneyclipDB } from '../src/db/db'

describe('export/import', () => {
  it('JSON export → import round-trips records, categories, attachments', async () => {
    const db = await freshDb()
    const cat = (await db.categories.toArray())[0]
    const rec = await createRecord(
      {
        title: '往復きっぷ',
        price: 12000,
        currency: 'JPY',
        date: '2026-07-10',
        merchant: 'JR',
        categoryId: cat.id,
        tags: ['trip:kansai'],
        note: '新大阪〜東京',
        saveReason: 'remember',
        items: [{ id: 'i1', name: 'のぞみ', qty: 1, unitPrice: 12000, barcode: '49' }],
      },
      db,
    )
    await addAttachment(rec.id, new Blob(['img-bytes']), new Blob(['thumb']), db)

    const bundle = await exportJSON(db, { includeImages: true })

    const db2 = new MoneyclipDB(`import-${Date.now()}`)
    const result = await importJSON(db2, bundle)
    expect(result.records).toBe(1)

    const imported = await db2.records.get(rec.id)
    expect(imported).toMatchObject({
      title: '往復きっぷ',
      price: 12000,
      currency: 'JPY',
      tags: ['trip:kansai'],
      note: '新大阪〜東京',
      saveReason: 'remember',
      items: [{ id: 'i1', name: 'のぞみ', qty: 1, unitPrice: 12000, barcode: '49' }],
    })
    const attachments = await db2.attachments.where('recordId').equals(rec.id).toArray()
    expect(attachments).toHaveLength(1)
    expect(await attachments[0].blob.text()).toBe('img-bytes')
    expect(await db2.categories.count()).toBe(12)
  })

  it('CSV export produces flat rows with joined tags and serialized items', async () => {
    const db = await freshDb()
    const cats = await db.categories.toArray()
    const rec = await createRecord(
      {
        title: 'Café "Blue"', price: 250, currency: 'TWD', date: '2026-08-01',
        merchant: 'Blue, Bottle', categoryId: cats[0].id, tags: ['a', 'b'],
        saveReason: 'bought', note: 'line1\nline2',
        items: [{ id: 'i', name: 'latte', qty: 2, unitPrice: 125 }],
      },
      db,
    )
    const csv = exportCSV([rec], cats)
    const lines = csv.split('\n')
    expect(lines[0]).toMatch(/^title,price,currency,date,merchant,category,tags,saveReason,favorite,status,note,items,createdAt$/)
    expect(csv).toContain('"Café ""Blue"""')
    expect(csv).toContain('"Blue, Bottle"')
    expect(csv).toContain('a;b')
    expect(csv).toContain('latte x2 @125')
    expect(csv).toContain('"line1\nline2"')
  })

  it('import rejects invalid bundles', async () => {
    const db = await freshDb()
    await expect(importJSON(db, { version: 2 } as never)).rejects.toThrow()
  })
})
