import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, GhostButton, SectionCard } from '../components/ui'
import { categoryDisplayName } from '../lib/search'
import { useCategories, useRateSource, useRecords, useSetting } from '../hooks'
import { priceHistory } from '../lib/analytics'
import { formatMoney } from '../lib/currency'
import { addShoppingItem } from '../lib/shoppingList'
import { addFromItem } from '../lib/inventory'
import { useToast } from '../components/Toast'

/** Product dossier: one item's price history across merchants and trips. */
export function DossierPage() {
  const { t, i18n } = useTranslation()
  const { key = '' } = useParams()
  // useParams already decodes; decoding again would corrupt '%' in names.
  const decoded = key
  const records = useRecords()
  const categories = useCategories() ?? []
  const defaultCurrency = useSetting('defaultCurrency')
  const rateSource = useRateSource()

  const dossier = useMemo(
    () => priceHistory(records ?? [], decoded, defaultCurrency, rateSource),
    [records, decoded, defaultCurrency, rateSource],
  )
  const toast = useToast()
  const latest = dossier.purchases[0]
  const categoryOf = (categoryId: string | null | undefined) => {
    const c = categories.find((x) => x.id === categoryId)
    return c ? `${c.icon ?? ''} ${categoryDisplayName(c, i18n.language)}` : ''
  }

  return (
    <div className="px-4 pb-10">
      <PageHeader title={dossier.name || t('dossier.title')} onBack={() => history.back()} />

      {key.startsWith('bc:') && !dossier.name && (
        <p className="mt-3 rounded-xl bg-terracotta-soft px-3 py-2 text-sm text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink">
          {t('dossier.unnamedBarcode')}
        </p>
      )}

      {dossier.count === 0 ? (
        <p className="px-6 py-16 text-center text-ink-soft dark:text-dusk-soft">{t('dossier.empty')}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-paper-raised p-2.5 ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('dossier.avg')}</p>
              <p className="text-sm font-semibold tabular-nums">
                {dossier.avg !== undefined ? formatMoney(dossier.avg, defaultCurrency, i18n.language) : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-paper-raised p-2.5 ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('dossier.best')}</p>
              <p className="text-sm font-semibold tabular-nums text-terracotta-deep dark:text-dusk-ink">
                {dossier.min !== undefined ? formatMoney(dossier.min, defaultCurrency, i18n.language) : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-paper-raised p-2.5 ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('dossier.worst')}</p>
              <p className="text-sm font-semibold tabular-nums">
                {dossier.max !== undefined ? formatMoney(dossier.max, defaultCurrency, i18n.language) : '—'}
              </p>
            </div>
          </div>

          {latest?.unitPrice !== undefined && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <GhostButton
                onClick={() => {
                  void addShoppingItem({
                    name: dossier.name,
                    estPrice: latest.unitPrice,
                    estCurrency: latest.currency ?? defaultCurrency,
                  })
                  toast(t('list.added'))
                }}
              >
                {t('list.addToList')}
              </GhostButton>
              <GhostButton
                onClick={() => {
                  void addFromItem({ name: dossier.name, barcode: decoded.startsWith('bc:') ? decoded.slice(3) : undefined })
                  toast(t('inventory.added'))
                }}
              >
                {t('inventory.addToInventory')}
              </GhostButton>
            </div>
          )}

          <SectionCard title={t('dossier.purchases', { count: dossier.count })}>
            <ul className="space-y-2">
              {dossier.purchases.map((p, i) => {
                const rec = (records ?? []).find((r) => r.id === p.recordId)
                const showConverted = p.currency && p.currency.toUpperCase() !== defaultCurrency.toUpperCase()
                return (
                  <li key={`${p.recordId}-${i}`}>
                    <Link
                      to={`/record/${p.recordId}`}
                      className="flex min-h-14 items-center justify-between gap-2 rounded-xl bg-paper p-2.5 ring-1 ring-line transition-all active:scale-[0.99] dark:bg-dusk dark:ring-dusk-line"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {p.merchant ?? '—'}
                          {rec && categoryOf(rec.categoryId) && (
                            <span className="ml-1.5 text-xs text-ink-soft dark:text-dusk-soft">
                              {categoryOf(rec.categoryId)}
                            </span>
                          )}
                        </p>
                        <p className="text-xs tabular-nums text-ink-soft dark:text-dusk-soft">
                          {p.date ?? ''}
                          {p.qty !== undefined && ` · ×${p.qty}`}
                          {p.unit && ` ${p.unit}`}
                          {p.originalPrice !== undefined && p.unitPrice !== undefined && p.originalPrice > p.unitPrice && (
                            <span className="ml-1.5 text-terracotta-deep dark:text-dusk-ink">
                              {t('dossier.was', { price: formatMoney(p.originalPrice, p.currency ?? defaultCurrency, i18n.language) })}
                            </span>
                          )}
                        </p>
                        {p.priceBasis && <p className="mt-1 text-xs">{t(`invoice.basis.${p.priceBasis}`)}</p>}
                        {p.unallocatedDiscount && <p className="mt-1 text-xs">{t('invoice.issues.unallocated')}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {p.unitPrice !== undefined
                            ? formatMoney(p.unitPrice, p.currency ?? defaultCurrency, i18n.language)
                            : '—'}
                          {p.unit && <span className="block text-xs font-normal">/ {p.unit}</span>}
                        </p>
                        {showConverted && p.converted !== undefined && (
                          <p className="text-xs tabular-nums text-ink-soft dark:text-dusk-soft">
                            {t('detail.approxConverted', {
                              amount: formatMoney(Math.round(p.converted * 100) / 100, defaultCurrency, i18n.language),
                            })}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </SectionCard>
        </>
      )}
    </div>
  )
}
