import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bars, Pie } from '../components/charts'
import { PageHeader, SectionCard } from '../components/ui'
import { categoryDisplayName } from '../lib/search'
import { availableMonths, reportMonth } from '../lib/analytics'
import { formatMoney } from '../lib/currency'
import { useCategories, useRateSource, useRecords, useSetting } from '../hooks'

/** Monthly reports — totals, category pie, merchant bars, discount savings. */
export function ReportsPage() {
  const { t, i18n } = useTranslation()
  const records = useRecords()
  const categories = useCategories() ?? []
  const defaultCurrency = useSetting('defaultCurrency')
  const rateSource = useRateSource()

  const months = useMemo(() => availableMonths(records ?? []), [records])
  const [index, setIndex] = useState(0)
  const month = months[Math.min(index, Math.max(0, months.length - 1))]
  const report = useMemo(
    () => (month ? reportMonth(records ?? [], month, defaultCurrency, rateSource) : null),
    [records, month, defaultCurrency, rateSource],
  )
  const money = (v: number) => formatMoney(Math.round(v * 100) / 100, defaultCurrency, i18n.language)
  const catName = (categoryId: string | null) => {
    const c = categories.find((x) => x.id === categoryId)
    return c ? `${c.icon ?? ''} ${categoryDisplayName(c, i18n.language)}` : t('form.noCategory')
  }

  return (
    <div className="px-4 pb-10">
      <PageHeader title={t('reports.title')} onBack={() => history.back()} />

      {months.length === 0 || !report ? (
        <p className="px-6 py-16 text-center text-ink-soft dark:text-dusk-soft">{t('reports.empty')}</p>
      ) : (
        <div className="space-y-4 pt-2">
          {/* month stepper */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label={t('common.back')}
              disabled={index >= months.length - 1}
              onClick={() => setIndex((i) => Math.min(months.length - 1, i + 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-ink-soft disabled:opacity-30 dark:text-dusk-soft"
            >
              ‹
            </button>
            <span className="min-w-24 text-center text-lg font-semibold tabular-nums">{month}</span>
            <button
              type="button"
              aria-label="›"
              disabled={index <= 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-xl text-ink-soft disabled:opacity-30 dark:text-dusk-soft"
            >
              ›
            </button>
          </div>

          <div className="rounded-2xl bg-paper-raised p-4 shadow-sm shadow-ink/[0.04] ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line dark:shadow-none">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft dark:text-dusk-soft">
              {t('reports.total')}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{money(report.total)}</p>
            <p className="mt-0.5 text-xs text-ink-soft dark:text-dusk-soft">
              {t('reports.receipts', { count: report.count })}
            </p>
            {report.unconvertedCount > 0 && (
              <p className="mt-1 text-xs text-ink-soft dark:text-dusk-soft">{t('reports.unconverted')}</p>
            )}
          </div>

          {report.savings > 0 && (
            <div className="rounded-2xl bg-terracotta-soft p-4 text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{t('reports.savings')}</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums">{money(report.savings)}</p>
            </div>
          )}

          {report.byCategory.length > 0 && (
            <SectionCard title={t('reports.byCategory')}>
              <Pie
                slices={report.byCategory.map((c) => ({ label: catName(c.categoryId), value: c.total }))}
                ariaLabel={`${t('reports.byCategory')}: ${report.byCategory
                  .map((c) => `${catName(c.categoryId)} ${money(c.total)}`)
                  .join(', ')}`}
              />
            </SectionCard>
          )}

          {report.byMerchant.length > 0 && (
            <SectionCard title={t('reports.byStore')}>
              <Bars rows={report.byMerchant.map((m) => ({ label: m.merchant, value: m.total }))} format={money} />
            </SectionCard>
          )}
        </div>
      )}
    </div>
  )
}
