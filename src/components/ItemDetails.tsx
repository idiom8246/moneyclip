import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { RecordItem } from '../db/types'
import { isPurchaseItem, itemLineTotal, itemUnitPrice, productKey } from '../lib/invoice'
import { formatMoney } from '../lib/currency'
import { DataFields } from './InvoiceDetails'

export function ItemDetails({ items, currency, onTrack }: { items: RecordItem[]; currency: string; onTrack: (item: RecordItem) => void }) {
  const { t, i18n } = useTranslation()
  if (!items.length) return <p className="py-6 text-sm">{t('invoice.noItems')}</p>
  return <ul className="divide-y divide-line dark:divide-dusk-line">{items.map((item) => {
    const price = itemUnitPrice(item)
    const total = itemLineTotal(item)
    const purchase = isPurchaseItem(item)
    return <li key={item.id} className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {purchase ? <Link className="break-words font-medium underline decoration-line underline-offset-4 dark:decoration-dusk-line" to={`/product/${encodeURIComponent(productKey(item))}`}>{item.name}</Link>
            : <p className="break-words font-medium">{item.name}</p>}
          <p className="mt-1 text-sm tabular-nums">{item.quantityText ?? item.qty ?? '—'} {item.unit ?? ''}
            {price !== undefined && <> · {formatMoney(price, currency, i18n.language)} / {item.unit || t('invoice.each')}</>}
          </p>
          {item.lineKind && item.lineKind !== 'purchase' && <p className="mt-1 text-sm">{t(`invoice.kinds.${item.lineKind}`)}</p>}
        </div>
        {total !== undefined && <p className="shrink-0 font-semibold tabular-nums">{formatMoney(Number(total), currency, i18n.language)}</p>}
      </div>
      {item.lineTotal !== undefined && <p className="mt-1 text-xs">{t(`invoice.basis.${item.priceBasis ?? 'after_line_discounts'}`)}</p>}
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer content-center text-sm">{t('invoice.itemDetails')}</summary>
        <DataFields value={{ ...item, name: undefined, id: undefined, baseUnitPrice: undefined, sourceId: undefined }} />
      </details>
      {purchase && <button type="button" onClick={() => onTrack(item)} className="min-h-11 text-sm underline underline-offset-4" aria-label={`${t('inventory.addToInventory')}: ${item.name}`}>{t('inventory.addToInventory')}</button>}
    </li>
  })}</ul>
}
