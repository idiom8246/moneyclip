import type { RateSource } from './currency'
import { convert } from './currency'

/**
 * Currency snapshots — freeze an amount in the default currency at save
 * time so dossiers/reports never drift with later rate refreshes.
 * Rule (pinned): only when a foreign currency AND a rate exist; snapshots
 * are dropped when the rate disappears; legacy records stay untouched
 * (backfillMissingSnapshots fills only the never-converted ones).
 */
/** Anything shaped like a record/item whose snapshots we can recompute. */
export function computeSnapshots<
  T extends {
    price?: number
    currency?: string
    basePrice?: number
    items?: Array<{ unitPrice?: number; baseUnitPrice?: number }>
  },
>(input: T, base: string, rateSource: RateSource): T {
  const currency = (input.currency ?? base).toUpperCase()
  const isBase = currency === base.toUpperCase()
  const out: T = { ...input }

  if (isBase) {
    delete out.basePrice
  } else if (input.price !== undefined) {
    out.basePrice = convert(input.price, currency, base, rateSource) ?? undefined
  } else {
    delete out.basePrice
  }

  if (input.items) {
    out.items = input.items.map((it) => {
      const item = { ...it }
      if (isBase || it.unitPrice === undefined) {
        delete item.baseUnitPrice
      } else {
        item.baseUnitPrice = convert(it.unitPrice, currency, base, rateSource) ?? undefined
      }
      return item
    })
  }
  return out
}
