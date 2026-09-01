import type { MoneyclipDB } from '../db/db'
import { db as defaultDb } from '../db/db'
import type { ProductCacheEntry } from '../db/types'

/**
 * Barcode → product name via local cache, then OpenFoodFacts (spec §6.1).
 * Offline & uncached → null (caller keeps the barcode for manual naming).
 */

const OFF_API = 'https://world.openfoodfacts.org/api/v2/product'

export interface ProductInfo {
  barcode: string
  name: string
  brand?: string
  imageUrl?: string
}

export async function lookupProduct(
  barcode: string,
  database: MoneyclipDB = defaultDb,
  fetcher: typeof fetch = fetch,
): Promise<ProductInfo | null> {
  const cached = await database.productCache.get(barcode)
  if (cached) {
    return { barcode, name: cached.name, brand: cached.brand, imageUrl: cached.imageUrl }
  }
  try {
    const res = await fetcher(
      `${OFF_API}/${encodeURIComponent(barcode)}.json?fields=product_name,brands,image_url`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      status: number
      product?: { product_name?: string; brands?: string; image_url?: string }
    }
    if (data.status !== 1 || !data.product?.product_name) return null
    const entry: ProductCacheEntry = {
      barcode,
      name: data.product.product_name,
      brand: data.product.brands || undefined,
      imageUrl: data.product.image_url || undefined,
      cachedAt: Date.now(),
    }
    await database.productCache.put(entry)
    return { barcode, name: entry.name, brand: entry.brand, imageUrl: entry.imageUrl }
  } catch {
    return null
  }
}
