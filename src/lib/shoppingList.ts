import type { MoneyclipDB } from '../db/db'
import { db as defaultDb } from '../db/db'
import { uid } from './uid'

export interface ShoppingItem {
  id: string
  name: string
  qty?: number
  /** Rough price for the est. total — copied from the dossier's last purchase. */
  estPrice?: number
  estCurrency?: string
  /** IndexedDB can't index booleans — 1 = checked. */
  checked: 0 | 1
  createdAt: number
}

export async function addShoppingItem(
  input: { name: string; qty?: number; estPrice?: number; estCurrency?: string },
  database: MoneyclipDB = defaultDb,
): Promise<ShoppingItem> {
  const item: ShoppingItem = {
    id: uid(),
    name: input.name.trim(),
    qty: input.qty,
    estPrice: input.estPrice,
    estCurrency: input.estCurrency,
    checked: 0,
    createdAt: Date.now(),
  }
  if (!item.name) throw new Error('empty-name')
  await database.shoppingList.add(item)
  return item
}

export async function toggleShoppingItem(id: string, database: MoneyclipDB = defaultDb): Promise<void> {
  const item = await database.shoppingList.get(id)
  if (item) await database.shoppingList.update(id, { checked: item.checked ? 0 : 1 })
}

export async function removeShoppingItem(id: string, database: MoneyclipDB = defaultDb): Promise<void> {
  await database.shoppingList.delete(id)
}

export async function clearDoneShoppingItems(database: MoneyclipDB = defaultDb): Promise<void> {
  await database.shoppingList.where('checked').equals(1).delete()
}
