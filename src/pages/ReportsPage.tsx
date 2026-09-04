import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bars, Pie } from '../components/charts'
import { EmptyState } from '../components/EmptyState'
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
  const unconvertedAmounts = report
    ? Object.entries(report.unconvertedByCurrency).map(([currency, amount]) => formatMoney(amount, currency, i18n.language))
    : []

  return (
    <div className="px-4 pb-10">
      <PageHeader title={t('reports.title')} />

      {months.length === 0 || !report ? (
        <EmptyState
          kind="reports"
          title={t('reports.emptyTitle')}
          body={t('reports.empty')}
          action={<Link to="/add" className="btn-cobalt inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold">{t('collection.emptyCta')}</Link>}
        />
      ) : (
        <div className="space-y-4 pt-2">
          {/* month stepper */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label={t('common.back')}
              disabled={index >= months.length - 1}
              onClick={() => setIndex((i) => Math.min(months.length - 1, i + 1))}
              className="glass-soft flex h-11 w-11 items-center justify-center rounded-full text-xl text-ink-soft transition-all active:scale-95 disabled:opacity-30 dark:text-dusk-soft"
            >
              ‹
            </button>
            <span className="min-w-24 text-center font-display text-lg font-semibold tabular-nums">{month}</span>
            <button
              type="button"
              aria-label="›"
              disabled={index <= 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="glass-soft flex h-11 w-11 items-center justify-center rounded-full text-xl text-ink-soft transition-all active:scale-95 disabled:opacity-30 dark:text-dusk-soft"
            >
              ›
            </button>
          </div>

          <div className="glass-soft animate-rise-in rounded-[24px] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft dark:text-dusk-soft">
              {t('reports.total')}
            </p>
            <p className="mt-1 font-display text-[34px] font-bold leading-10 tabular-nums tracking-[-0.02em] [font-stretch:110%]">
              {(report.convertedForeignCount > 0 || report.unconvertedCount > 0) && '≈ '}
              {money(report.total)}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft dark:text-dusk-soft">
              {t('reports.receipts', { count: report.count })}
            </p>
            {report.unconvertedCount > 0 && (
              <p className="mt-2 inline-flex flex-wrap items-center gap-1 rounded-full bg-cobalt-soft px-2.5 py-1 text-xs text-cobalt-deep dark:bg-cobalt-lift/15 dark:text-cobalt-lift">
                <strong>{t('reports.unconverted')}</strong>
                <span>· {t('reports.excludedUnconverted')}</span>
                {unconvertedAmounts.length > 0 && <span className="tabular-nums">{unconvertedAmounts.join(' · ')}</span>}
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
