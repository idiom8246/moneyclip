import { describe, expect, it } from 'vitest'
import { freshDb } from './helpers'
import {
  addCategory,
  createRecord,
  deleteCategory,
  deleteRecord,
  effectivePrice,
  itemsAutoTotal,
  renameCategory,
  setArchived,
  toggleFavorite,
  updateRecord,
} from '../src/lib/records'
import { addAttachment } from '../src/lib/records'

describe('records CRUD', () => {
  it('creates a record with title only (spec: only title required)', async () => {
    const db = await freshDb()
    const rec = await createRecord({ title: '拉麵' }, db)
    expect(rec.id).toBeTruthy()
    expect(rec.status).toBe('active')
    expect(rec.favorite).toBe(false)
    expect(rec.tags).toEqual([])
    const stored = await db.records.get(rec.id)
    expect(stored?.title).toBe('拉麵')
  })

  it('update preserves createdAt and bumps updatedAt', async () => {
    const db = await freshDb()
    const rec = await createRecord({ title: 'A' }, db)
    await new Promise((r) => setTimeout(r, 5))
    await updateRecord(rec.id, { title: 'B' }, db)
    const updated = (await db.records.get(rec.id))!
    expect(updated.title).toBe('B')
    expect(updated.createdAt).toBe(rec.createdAt)
    expect(updated.updatedAt).toBeGreaterThan(rec.updatedAt)
  })

  it('toggles favorite', async () => {
    const db = await freshDb()
    const rec = await createRecord({ title: 'Fav' }, db)
    await toggleFavorite(rec.id, db)
    expect((await db.records.get(rec.id))!.favorite).toBe(true)
    await toggleFavorite(rec.id, db)
    expect((await db.records.get(rec.id))!.favorite).toBe(false)
  })

  it('archives and unarchives', async () => {
    const db = await freshDb()
    const rec = await createRecord({ title: 'Arch' }, db)
    await setArchived(rec.id, true, db)
    expect((await db.records.get(rec.id))!.status).toBe('archived')
    await setArchived(rec.id, false, db)
    expect((await db.records.get(rec.id))!.status).toBe('active')
  })

  it('deletes record and cascades attachments', async () => {
    const db = await freshDb()
    const rec = await createRecord({ title: 'With photo' }, db)
    await addAttachment(rec.id, new Blob(['x']), new Blob(['t']), db)
    await addAttachment(rec.id, new Blob(['y']), new Blob(['t']), db)
    expect(await db.attachments.where('recordId').equals(rec.id).count()).toBe(2)
    await deleteRecord(rec.id, db)
    expect(await db.records.get(rec.id)).toBeUndefined()
    expect(await db.attachments.where('recordId').equals(rec.id).count()).toBe(0)
  })
})

describe('categories', () => {
  it('seeds 12 built-in bilingual categories', async () => {
    const db = await freshDb()
    const cats = await db.categories.toArray()
    expect(cats).toHaveLength(12)
    expect(cats.every((c) => c.builtIn && c.name && c.nameEn)).toBe(true)
  })

  it('adds and renames a custom category', async () => {
    const db = await freshDb()
    const cat = await addCategory('咖啡', db)
    expect(cat.builtIn).toBe(false)
    await renameCategory(cat.id, '咖啡館', db)
    expect((await db.categories.get(cat.id))!.name).toBe('咖啡館')
  })

  it('deleting a category nulls records\' categoryId (records survive)', async () => {
    const db = await freshDb()
    const cat = await addCategory('TempCat', db)
    const rec = await createRecord({ title: 'Keeps', categoryId: cat.id }, db)
    await deleteCategory(cat.id, db)
    const after = await db.records.get(rec.id)
    expect(after).toBeDefined()
    expect(after!.categoryId).toBeNull()
    expect(await db.categories.get(cat.id)).toBeUndefined()
  })
})

describe('items', () => {
  it('auto-sums qty × unitPrice; treats missing qty as 1', () => {
    expect(
      itemsAutoTotal([
        { id: '1', name: '茶', qty: 2, unitPrice: 30 },
        { id: '2', name: '餅', unitPrice: 45 },
        { id: '3', name: '??' },
      ]),
    ).toBe(105)
  })

  it('returns undefined when nothing computable', () => {
    expect(itemsAutoTotal([{ id: '1', name: 'x' }])).toBeUndefined()
    expect(itemsAutoTotal([])).toBeUndefined()
    expect(itemsAutoTotal(undefined)).toBeUndefined()
  })

  it('manual price overrides auto-sum (spec: 外幣找零/折扣 scenarios)', () => {
    const rec = {
      id: 'r', title: 't', price: 90, favorite: false, status: 'active' as const,
      tags: [], createdAt: 1, updatedAt: 1,
      items: [{ id: 'i', name: 'x', unitPrice: 100 }],
    }
    expect(effectivePrice(rec)).toBe(90)
    expect(effectivePrice({ ...rec, price: undefined })).toBe(100)
    expect(effectivePrice({ ...rec, price: undefined, items: undefined })).toBeUndefined()
  })
})
