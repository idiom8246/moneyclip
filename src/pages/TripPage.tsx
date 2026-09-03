import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
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

  return (
    <div className="px-4 pb-10">
      <PageHeader title={decoded.replace(/^trip:/, '')} onBack={() => history.back()} />

      {report.receipts.length === 0 ? (
        <p className="px-6 py-16 text-center text-ink-soft dark:text-dusk-soft">{t('trip.empty')}</p>
      ) : (
        <>
          <div className="mt-4 rounded-2xl bg-paper-raised p-4 shadow-sm shadow-ink/[0.04] ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line dark:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft dark:text-dusk-soft">
              {t('trip.total')}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">
              {formatMoney(Math.round(report.convertedTotal * 100) / 100, defaultCurrency, i18n.language)}
            </p>
            {Object.entries(report.byCurrency).map(([cur, amt]) => (
              <p key={cur} className="mt-0.5 text-xs tabular-nums text-ink-soft dark:text-dusk-soft">
                {formatMoney(amt, cur, i18n.language)}
              </p>
            ))}
            {report.unconvertedCount > 0 && (
              <p className="mt-1 text-xs text-ink-soft dark:text-dusk-soft">{t('reports.unconverted')}</p>
            )}
            {report.dateRange && (
              <p className="mt-2 text-xs tabular-nums text-ink-soft dark:text-dusk-soft">
                {report.dateRange[0]} → {report.dateRange[1]}
              </p>
            )}
          </div>

          {report.byCategory.length > 0 && (
            <SectionCard title={t('trip.byCategory')}>
              <Bars
                rows={report.byCategory.map((c) => ({ label: catName(c.categoryId), value: c.total }))}
                format={(v) => formatMoney(Math.round(v), defaultCurrency, i18n.language)}
              />
            </SectionCard>
          )}

          <SectionCard title={t('trip.receipts')}>
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
