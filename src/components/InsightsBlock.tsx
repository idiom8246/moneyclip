import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import type { Category, ConsumptionRecord } from '../db/types'
import { computeMonthInsight, formatMoney, TRIP_TAG_PREFIX } from '../lib/currency'
import { categoryDisplayName } from '../lib/search'
import { expiringSoon } from '../lib/inventory'
import { useInventoryItems, useRateSource, useSetting } from '../hooks'
import { IconChevronDown } from './icons'

/**
 * Collapsible Insights — calm, text-first, not a dashboard (spec §5.1).
 */
export function InsightsBlock({
  records,
  categories,
}: {
  records: ConsumptionRecord[]
  categories: Category[]
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  // Collapsed by default: a journal you read, not a dashboard you scan.
  // Remember the visitor's choice for next launch.
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('mc.insights') === 'open'
    } catch {
      return false
    }
  })
  const toggle = () =>
    setOpen((o) => {
      try {
        localStorage.setItem('mc.insights', o ? 'closed' : 'open')
      } catch {
        /* private mode — state stays in-memory */
      }
      return !o
    })
  const defaultCurrency = useSetting('defaultCurrency')
  const rateSource = useRateSource()
  // Local calendar month (record dates are local yyyy-mm-dd, spec §5.1 本月).
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const insight = useMemo(
    () => computeMonthInsight(records, month, defaultCurrency, rateSource),
    [records, month, defaultCurrency, rateSource],
  )
  const inventoryItems = useInventoryItems()
  const expiring = useMemo(() => expiringSoon(inventoryItems ?? [], 3), [inventoryItems])

  const hasContent =
    insight.total > 0 || insight.topCategories.length > 0 || insight.tripTotals.length > 0

  return (
    <section className="rounded-2xl bg-paper-raised p-4 shadow-sm shadow-ink/[0.04] ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line dark:shadow-none" aria-label={t('collection.insights.title')}>
      <h2 className="sr-only">{t('collection.insights.title')}</h2>
      {expiring.length > 0 && (
        <Link
          to="/inventory"
          role="status"
          className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-terracotta-soft px-3 py-2 text-xs text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink"
        >
          <span className="min-w-0 truncate">
            ⏳ {t('inventory.expiringSoon', { count: expiring.length })}:{' '}
            {expiring.map((i) => i.name).join('、')}
          </span>
          <span className="shrink-0 tabular-nums">{expiring[0]?.expiresAt}</span>
        </Link>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? t('collection.insights.collapse') : t('collection.insights.expand')}
        className="flex w-full min-h-11 items-center justify-between"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft dark:text-dusk-soft">
          {t('collection.insights.thisMonth')}
        </span>
        <span className="flex items-center gap-2">
          <strong className="text-2xl font-bold tracking-tight tabular-nums">
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
          {rateSource.cache && (
            <p className="text-xs text-ink-soft/70 dark:text-dusk-soft/70">
              {t('collection.insights.ratesAsOf', {
                date: new Date(rateSource.cache.fetchedAt).toISOString().slice(0, 10),
              })}
            </p>
          )}

          {!hasContent && (
            <p className="text-ink-soft dark:text-dusk-soft">{t('collection.insights.none')}</p>
          )}

          {insight.topCategories.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-dusk-soft">
                {t('collection.insights.topCategories')}
              </h3>
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
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-soft dark:text-dusk-soft">
                {t('collection.insights.trips')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {insight.tripTotals.map(({ tag, total }) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => navigate(`/trip/${encodeURIComponent(tag)}`)}
                    className="rounded-full bg-terracotta-soft px-3 py-1 text-xs text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink"
                  >
                    {tag.replace(new RegExp(`^${TRIP_TAG_PREFIX}`), '')} · {formatMoney(Math.round(total), defaultCurrency, i18n.language)}
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
