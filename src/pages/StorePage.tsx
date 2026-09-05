import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { RecordCard } from '../components/RecordCard'
import { PageHeader, SectionCard } from '../components/ui'
import { merchantStats, itemKey, priceHistory } from '../lib/analytics'
import { formatMoney } from '../lib/currency'
import { addShoppingItem } from '../lib/shoppingList'
import { useToast } from '../components/Toast'
import { useRateSource, useRecords, useSetting } from '../hooks'

/** One merchant's spending stats — visits, average, top items, receipts. */
export function StorePage() {
  const { t, i18n } = useTranslation()
  const { name = '' } = useParams()
  // useParams already decodes; decoding again would corrupt '%' in names.
  const decoded = name
  const records = useRecords()
  const defaultCurrency = useSetting('defaultCurrency')
  const rateSource = useRateSource()
  const toast = useToast()

  const addToList = (itemName: string) => {
    // Latest raw unit price for this item becomes the estimate.
    const d = priceHistory(records ?? [], itemKey({ id: 'k', name: itemName }), defaultCurrency, rateSource)
    const latest = d.purchases[0]
    void addShoppingItem({
      name: itemName,
      estPrice: latest?.unitPrice,
      estCurrency: latest?.currency ?? defaultCurrency,
    })
    toast(t('list.added'))
  }

  const stats = useMemo(
    () => merchantStats(records ?? [], decoded, defaultCurrency, rateSource),
    [records, decoded, defaultCurrency, rateSource],
  )

  return (
    <div className="px-4 pb-10">
      <PageHeader title={decoded || t('store.title')} onBack={() => history.back()} />

      {stats.visits === 0 ? (
        <EmptyState kind="store" title={t('store.emptyTitle')} body={t('store.empty')} />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="glass-soft rounded-2xl p-2.5">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('store.visits', { count: stats.visits })}</p>
            </div>
            <div className="glass-soft rounded-2xl p-2.5">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('store.totalSpend')}</p>
              <p className="font-display text-sm font-bold tabular-nums">
                {formatMoney(Math.round(stats.total * 100) / 100, defaultCurrency, i18n.language)}
              </p>
            </div>
            <div className="glass-soft rounded-2xl p-2.5">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('store.avgPerVisit')}</p>
              <p className="font-display text-sm font-bold tabular-nums">
                {formatMoney(Math.round(stats.avgPerVisit * 100) / 100, defaultCurrency, i18n.language)}
              </p>
            </div>
          </div>

          {stats.unconvertedCount > 0 && (
            <p className="mt-2 text-xs text-ink-soft dark:text-dusk-soft">{t('reports.unconverted')}</p>
          )}

          {stats.topItems.length > 0 && (
            <SectionCard title={t('store.topItems')} className="mt-4">
              <ul className="space-y-2">
                {stats.topItems.map((it) => {
                  const key = encodeURIComponent(itemKey({ id: 'k', name: it.name }))
                  return (
                    <li key={it.name} className="flex items-center gap-2">
                      <Link
                        to={`/product/${key}`}
                        className="glass-soft flex min-h-11 min-w-0 flex-1 items-center justify-between rounded-xl px-3 py-2 text-sm transition-all active:scale-[0.99]"
                      >
                        <span className="truncate">{it.name}</span>
                        <span className="shrink-0 text-xs text-ink-soft dark:text-dusk-soft">×{it.count}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => addToList(it.name)}
                        aria-label={`${t('list.addToList')}: ${it.name}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cobalt-soft font-semibold text-cobalt transition-all active:scale-95 dark:bg-cobalt-lift/15 dark:text-cobalt-lift"
                      >
                        +
                      </button>
                    </li>
                  )
                })}
              </ul>
            </SectionCard>
          )}

          <SectionCard title={t('store.recent')} className="mt-4">
            <div className="space-y-3">
              {stats.receipts.map((rec) => (
                <RecordCard key={rec.id} record={rec} categories={[]} defaultCurrency={defaultCurrency} />
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
