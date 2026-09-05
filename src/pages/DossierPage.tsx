import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PriceSparkline } from '../components/charts'
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
  const sparkPoints = [...dossier.purchases]
    .reverse()
    .filter((purchase): purchase is typeof purchase & { converted: number } => purchase.converted !== undefined)
    .map((purchase, index) => ({ label: purchase.date ?? String(index + 1), value: purchase.converted }))
  const categoryOf = (categoryId: string | null | undefined) => {
    const c = categories.find((x) => x.id === categoryId)
    return c ? `${c.icon ?? ''} ${categoryDisplayName(c, i18n.language)}` : ''
  }

  return (
    <div className="px-4 pb-10">
      <PageHeader title={dossier.name || t('dossier.title')} onBack={() => history.back()} />

      {key.startsWith('bc:') && !dossier.name && (
        <p className="mt-3 rounded-xl bg-cobalt-soft px-3 py-2 text-sm font-medium text-cobalt-deep dark:bg-cobalt-lift/15 dark:text-cobalt-lift">
          {t('dossier.unnamedBarcode')}
        </p>
      )}

      {dossier.count === 0 ? (
        <EmptyState kind="dossier" title={t('dossier.emptyTitle')} body={t('dossier.empty')} />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="glass-soft rounded-2xl p-2.5">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('dossier.avg')}</p>
              <p className="font-display text-sm font-bold tabular-nums">
                {dossier.avg !== undefined ? formatMoney(dossier.avg, defaultCurrency, i18n.language) : '—'}
              </p>
            </div>
            <div className="glass-soft rounded-2xl p-2.5">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('dossier.best')}</p>
              <p className="font-display text-sm font-bold tabular-nums text-cobalt-deep dark:text-cobalt-lift">
                {dossier.min !== undefined ? formatMoney(dossier.min, defaultCurrency, i18n.language) : '—'}
              </p>
            </div>
            <div className="glass-soft rounded-2xl p-2.5">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('dossier.worst')}</p>
              <p className="font-display text-sm font-bold tabular-nums">
                {dossier.max !== undefined ? formatMoney(dossier.max, defaultCurrency, i18n.language) : '—'}
              </p>
            </div>
          </div>

          {sparkPoints.length > 1 && (
            <SectionCard title={t('dossier.priceTrend')} className="mt-3">
              <PriceSparkline
                points={sparkPoints}
                ariaLabel={`${t('dossier.priceTrend')}: ${sparkPoints.map((point) => `${point.label} ${formatMoney(point.value, defaultCurrency, i18n.language)}`).join(', ')}`}
              />
            </SectionCard>
          )}

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

          <SectionCard title={t('dossier.purchases', { count: dossier.count })} className="mt-3">
            <ul className="space-y-2">
              {dossier.purchases.map((p, i) => {
                const rec = (records ?? []).find((r) => r.id === p.recordId)
                const showConverted = p.currency && p.currency.toUpperCase() !== defaultCurrency.toUpperCase()
                return (
                  <li key={`${p.recordId}-${i}`}>
                    <Link
                      to={`/record/${p.recordId}`}
                      className="glass-soft flex min-h-14 items-center justify-between gap-2 rounded-xl p-2.5 transition-all active:scale-[0.99]"
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
                            <span className="ml-1.5 text-cobalt-deep dark:text-dusk-ink">
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
