import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { RecordCard } from '../components/RecordCard'
import { Bars } from '../components/charts'
import { PageHeader, SectionCard } from '../components/ui'
import { categoryDisplayName } from '../lib/search'
import { tripReport } from '../lib/analytics'
import { formatMoney } from '../lib/currency'
import { useCategories, useRateSource, useRecords, useSetting } from '../hooks'

/** One trip (#trip:tag) — totals, category split, receipts. */
export function TripPage() {
  const { t, i18n } = useTranslation()
  const { tag = '' } = useParams()
  // useParams already decodes; decoding again would corrupt '%' in names.
  const decoded = tag
  const records = useRecords()
  const categories = useCategories() ?? []
  const defaultCurrency = useSetting('defaultCurrency')
  const rateSource = useRateSource()

  const report = useMemo(
    () => tripReport(records ?? [], decoded, defaultCurrency, rateSource),
    [records, decoded, defaultCurrency, rateSource],
  )
  const catName = (categoryId: string | null) => {
    const c = categories.find((x) => x.id === categoryId)
    return c ? `${c.icon ?? ''} ${categoryDisplayName(c, i18n.language)}` : t('form.noCategory')
  }
  const money = (v: number) => formatMoney(Math.round(v * 100) / 100, defaultCurrency, i18n.language)
  const unconvertedAmounts = Object.entries(report.unconvertedByCurrency)
    .map(([currency, amount]) => formatMoney(amount, currency, i18n.language))

  return (
    <div className="px-4 pb-10">
      <PageHeader title={decoded.replace(/^trip:/, '')} onBack={() => history.back()} />

      {report.receipts.length === 0 ? (
        <EmptyState kind="trip" title={t('trip.emptyTitle')} body={t('trip.empty')} />
      ) : (
        <>
          <div className="glass-soft animate-rise-in mt-4 rounded-[24px] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft dark:text-dusk-soft">
              {t('trip.total')}
            </p>
            <p className="mt-1 font-display text-[34px] font-bold leading-10 tabular-nums tracking-[-0.02em] [font-stretch:110%]">
              {(report.convertedForeignCount > 0 || report.unconvertedCount > 0) && '≈ '}
              {formatMoney(Math.round(report.convertedTotal * 100) / 100, defaultCurrency, i18n.language)}
            </p>
            {report.unconvertedCount > 0 && (
              <p className="mt-2 inline-flex flex-wrap items-center gap-1 rounded-full bg-cobalt-soft px-2.5 py-1 text-xs text-cobalt-deep dark:bg-cobalt-lift/15 dark:text-cobalt-lift">
                <strong>{t('reports.unconverted')}</strong>
                <span>· {t('reports.excludedUnconverted')}</span>
                {unconvertedAmounts.length > 0 && <span className="tabular-nums">{unconvertedAmounts.join(' · ')}</span>}
              </p>
            )}
            {report.dateRange && (
              <p className="mt-2 text-xs tabular-nums text-ink-soft dark:text-dusk-soft">
                {report.dateRange[0]} → {report.dateRange[1]}
              </p>
            )}
          </div>

          {report.savings > 0 && (
            <div className="rounded-[20px] bg-cobalt-soft p-4 text-cobalt-deep dark:bg-cobalt-lift/15 dark:text-cobalt-lift">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80">{t('reports.savings')}</p>
              <p className="mt-0.5 font-display text-2xl font-bold tabular-nums">{money(report.savings)}</p>
            </div>
          )}

          {report.byCategory.length > 0 && (
            <SectionCard title={t('trip.byCategory')} className="mt-4">
              <Bars
                rows={report.byCategory.map((c) => ({ label: catName(c.categoryId), value: c.total }))}
                format={(v) => formatMoney(Math.round(v), defaultCurrency, i18n.language)}
              />
            </SectionCard>
          )}

          <SectionCard title={t('trip.receipts')} className="mt-4">
            <div className="space-y-3">
              {report.receipts.map((rec) => (
                <RecordCard key={rec.id} record={rec} categories={categories} defaultCurrency={defaultCurrency} />
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
