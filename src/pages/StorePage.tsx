import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { RecordCard } from '../components/RecordCard'
import { PageHeader, SectionCard } from '../components/ui'
import { merchantStats } from '../lib/analytics'
import { formatMoney } from '../lib/currency'
import { itemKey } from '../lib/analytics'
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

  const stats = useMemo(
    () => merchantStats(records ?? [], decoded, defaultCurrency, rateSource),
    [records, decoded, defaultCurrency, rateSource],
  )

  return (
    <div className="px-4 pb-10">
      <PageHeader title={decoded || t('store.title')} onBack={() => history.back()} />

      {stats.visits === 0 ? (
        <p className="px-6 py-16 text-center text-ink-soft dark:text-dusk-soft">{t('store.empty')}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-paper-raised p-2.5 ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('store.visits', { count: stats.visits })}</p>
            </div>
            <div className="rounded-xl bg-paper-raised p-2.5 ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('store.totalSpend')}</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatMoney(Math.round(stats.total * 100) / 100, defaultCurrency, i18n.language)}
              </p>
            </div>
            <div className="rounded-xl bg-paper-raised p-2.5 ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line">
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('store.avgPerVisit')}</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatMoney(Math.round(stats.avgPerVisit * 100) / 100, defaultCurrency, i18n.language)}
              </p>
            </div>
          </div>

          {stats.unconvertedCount > 0 && (
            <p className="mt-2 text-xs text-ink-soft dark:text-dusk-soft">{t('reports.unconverted')}</p>
          )}

          {stats.topItems.length > 0 && (
            <SectionCard title={t('store.topItems')}>
              <ul className="space-y-2">
                {stats.topItems.map((it) => {
                  const key = encodeURIComponent(itemKey({ id: 'k', name: it.name }))
                  return (
                    <li key={it.name}>
                      <Link
                        to={`/product/${key}`}
                        className="flex min-h-11 items-center justify-between rounded-xl bg-paper px-3 py-2 text-sm ring-1 ring-line transition-all active:scale-[0.99] dark:bg-dusk dark:ring-dusk-line"
                      >
                        <span className="truncate">{it.name}</span>
                        <span className="shrink-0 text-xs text-ink-soft dark:text-dusk-soft">×{it.count}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </SectionCard>
          )}

          <SectionCard title={t('store.recent')}>
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
