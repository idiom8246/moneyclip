import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Category, ConsumptionRecord } from '../db/types'
import { computeMonthInsight, formatMoney } from '../lib/currency'
import { categoryDisplayName } from '../lib/search'
import { useRates, useSetting } from '../hooks'
import { IconChevronDown } from './icons'

/**
 * Collapsible Insights — calm, text-first, not a dashboard (spec §5.1).
 */
export function InsightsBlock({
  records,
  categories,
  onTripClick,
}: {
  records: ConsumptionRecord[]
  categories: Category[]
  onTripClick: (tag: string) => void
}) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(true)
  const defaultCurrency = useSetting('defaultCurrency')
  const manualRates = useSetting('manualRates')
  const rateCache = useRates(defaultCurrency)

  const month = new Date().toISOString().slice(0, 7)
  const insight = useMemo(
    () =>
      computeMonthInsight(records, month, defaultCurrency, {
        manualRates,
        cache: rateCache ?? null,
      }),
    [records, month, defaultCurrency, manualRates, rateCache],
  )

  const hasContent =
    insight.total > 0 || insight.topCategories.length > 0 || insight.tripTotals.length > 0

  return (
    <section className="rounded-2xl bg-paper-raised p-4 ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line" aria-label={t('collection.insights.title')}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t('collection.insights.collapse') : t('collection.insights.expand')}
        className="flex w-full min-h-11 items-center justify-between"
      >
        <span className="text-sm font-semibold text-ink-soft dark:text-dusk-soft">
          {t('collection.insights.thisMonth')}
        </span>
        <span className="flex items-center gap-2">
          <strong className="text-2xl font-bold tracking-tight">
            {formatMoney(Math.round(insight.total), defaultCurrency, i18n.language)}
          </strong>
          <IconChevronDown className={`h-4 w-4 text-ink-soft transition-transform dark:text-dusk-soft ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm">
          {Object.keys(insight.foreignAmounts).length > 0 && (
            <p className="text-xs text-ink-soft dark:text-dusk-soft">
              {Object.entries(insight.foreignAmounts)
                .map(([cur, amt]) => formatMoney(amt, cur, i18n.language))
                .join(' · ')}
              {insight.hadUnconverted && ` (${t('common.unconverted')})`}
            </p>
          )}
          {rateCache && (
            <p className="text-xs text-ink-soft/70 dark:text-dusk-soft/70">
              {t('collection.insights.ratesAsOf', {
                date: new Date(rateCache.fetchedAt).toISOString().slice(0, 10),
              })}
            </p>
          )}

          {!hasContent && (
            <p className="text-ink-soft dark:text-dusk-soft">{t('collection.insights.none')}</p>
          )}

          {insight.topCategories.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-dusk-soft">
                {t('collection.insights.topCategories')}
              </h4>
              <ul className="space-y-1">
                {insight.topCategories.map(({ categoryId, total }) => {
                  const cat = categories.find((c) => c.id === categoryId)
                  const bar = Math.max(6, (total / Math.max(1, insight.topCategories[0].total)) * 100)
                  return (
                    <li key={categoryId ?? 'none'} className="flex items-center gap-2">
                      <span className="w-20 truncate">
                        {cat ? `${cat.icon ?? ''} ${categoryDisplayName(cat, i18n.language)}` : '—'}
                      </span>
                      <span className="h-1.5 rounded-full bg-terracotta/70" style={{ width: `${bar * 0.5}%` }} aria-hidden />
                      <span className="text-xs text-ink-soft dark:text-dusk-soft">
                        {formatMoney(Math.round(total), defaultCurrency, i18n.language)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {insight.tripTotals.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-dusk-soft">
                {t('collection.insights.trips')}
              </h4>
              <div className="flex flex-wrap gap-2">
                {insight.tripTotals.map(({ tag, total }) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onTripClick(tag)}
                    className="rounded-full bg-terracotta-soft px-3 py-1 text-xs text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink"
                  >
                    {tag.replace(/^trip:/, '')} · {formatMoney(Math.round(total), defaultCurrency, i18n.language)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
