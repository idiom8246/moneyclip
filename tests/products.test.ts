import { describe, expect, it, vi } from 'vitest'
import { freshDb } from './helpers'
import { lookupProduct } from '../src/lib/products'

const okResponse = (body: unknown) =>
  ({ ok: true, json: () => Promise.resolve(body) }) as Response

describe('lookupProduct (spec §6.1)', () => {
  it('queries OpenFoodFacts on miss and writes productCache', async () => {
    const db = await freshDb()
    const fetcher = vi.fn().mockResolvedValue(
      okResponse({ status: 1, product: { product_name: 'KitKat ミニ', brands: 'Nestlé', image_url: 'https://x/y.jpg' } }),
    )
    const info = await lookupProduct('4902201', db, fetcher)
    expect(info).toEqual({ barcode: '4902201', name: 'KitKat ミニ', brand: 'Nestlé', imageUrl: 'https://x/y.jpg' })
    const cached = await db.productCache.get('4902201')
    expect(cached?.name).toBe('KitKat ミニ')
  })

  it('hits productCache without network', async () => {
    const db = await freshDb()
    await db.productCache.put({ barcode: '111', name: 'Cached', cachedAt: Date.now() })
    const fetcher = vi.fn()
    const info = await lookupProduct('111', db, fetcher)
    expect(info?.name).toBe('Cached')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('returns null offline & unknown — barcode preserved by caller', async () => {
    const db = await freshDb()
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await lookupProduct('999', db, fetcher)).toBeNull()
  })

  it('returns null when the API has no product', async () => {
    const db = await freshDb()
    const fetcher = vi.fn().mockResolvedValue(okResponse({ status: 0 }))
    expect(await lookupProduct('000', db, fetcher)).toBeNull()
  })
})
