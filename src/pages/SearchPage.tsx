import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { RecordCard } from '../components/RecordCard'
import { Chip, Field, PageHeader, fieldClass } from '../components/ui'
import { IconBookmark, IconSearch } from '../components/icons'
import {
  useCategories, usePagedList, useRecentSearches, useRecords, useSetSearchParam, useSetting,
} from '../hooks'
import { searchRecords, categoryDisplayName } from '../lib/search'
import { getSetting, setSetting } from '../lib/settings'
import { db } from '../db/db'
import { SAVE_REASONS, type ConsumptionRecord, type SaveReason } from '../db/types'

const DEBOUNCE_MS = 200

export function SearchPage() {
  const { t, i18n } = useTranslation()
  const records = useRecords()
  const categories = useCategories() ?? []
  const defaultCurrency = useSetting('defaultCurrency')
  const recentSearches = useRecentSearches()
  const [searchParams, setSearchParams] = useSearchParams()
  const setParam = useSetSearchParam()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [input, setInput] = useState(searchParams.get('q') ?? '')
  const [query, setQuery] = useState(input)
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input])

  const includeArchived = searchParams.get('arch') === '1'
  const favoriteOnly = searchParams.get('fav') === '1'
  const categoryId = searchParams.get('cat') ?? undefined
  const saveReason = (searchParams.get('reason') as SaveReason | null) ?? undefined
  const dateFrom = searchParams.get('from') ?? undefined
  const dateTo = searchParams.get('to') ?? undefined

  const results = useMemo(
    () =>
      searchRecords(records ?? [], categories, query, {
        includeArchived, favoriteOnly, categoryId, saveReason, dateFrom, dateTo,
      }),
    [records, categories, query, includeArchived, favoriteOnly, categoryId, saveReason, dateFrom, dateTo],
  )
  const { visible: paged, hasMore, loadMore } = usePagedList(results)

  const hasFilters = includeArchived || favoriteOnly || !!categoryId || !!saveReason || !!dateFrom || !!dateTo
  const advancedFilterCount = Number(Boolean(categoryId)) + Number(Boolean(saveReason)) + Number(Boolean(dateFrom)) + Number(Boolean(dateTo))
  const started = query.trim().length > 0 || hasFilters

  /** Spec §5.4: remember successful searches (Enter or result click). */
  const commitSearch = async (raw: string) => {
    const q = raw.trim()
    if (!q) return
    const prev = await getSetting('recentSearches')
    await setSetting('recentSearches', [q, ...prev.filter((x) => x !== q)].slice(0, 5))
  }

  const byId = useMemo(() => new Map((records ?? []).map((r) => [r.id, r])), [records])

  return (
    <div className="px-4">
      <PageHeader title={t('search.title')} />

      <div className="relative mt-3">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft dark:text-dusk-soft" />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void commitSearch(input)}
          placeholder={t('search.placeholder')}
          autoFocus
          aria-label={t('search.title')}
          className={`${fieldClass} pl-11`}
        />
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip active={favoriteOnly} onClick={() => setParam('fav', favoriteOnly ? null : '1')} className="shrink-0">
          <IconBookmark filled={favoriteOnly} className="h-3.5 w-3.5" /> {t('search.favoriteOnly')}
        </Chip>
        <Chip active={includeArchived} onClick={() => setParam('arch', includeArchived ? null : '1')} className="shrink-0">
          {t('search.includeArchived')}
        </Chip>
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all active:scale-95 ${
            filtersOpen || advancedFilterCount > 0
              ? 'bg-cobalt-soft text-cobalt-deep dark:bg-cobalt-lift/15 dark:text-cobalt-lift'
              : 'glass-soft text-ink dark:text-dusk-ink'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {t('collection.moreFilters')}
          {advancedFilterCount > 0 && <span className="tabular-nums">{advancedFilterCount}</span>}
        </button>
      </div>

      {filtersOpen && (
        <section className="glass-soft animate-rise-in mt-2 space-y-4 rounded-[20px] p-4" aria-label={t('collection.moreFilters')}>
          <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft dark:text-dusk-soft">
              {t('collection.filterByCategory')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Chip key={c.id} active={categoryId === c.id}
                  onClick={() => setParam('cat', categoryId === c.id ? null : c.id)}>
                  {c.icon} {categoryDisplayName(c, i18n.language)}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft dark:text-dusk-soft">
              {t('collection.filterByReason')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {SAVE_REASONS.map((r) => (
                <Chip key={r} active={saveReason === r}
                  onClick={() => setParam('reason', saveReason === r ? null : r)}>
                  {t(`reasons.${r}`)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('search.dateFrom')} className="min-w-0">
              <input type="date" value={dateFrom ?? ''} onChange={(e) => setParam('from', e.target.value || null)} className={fieldClass} />
            </Field>
            <Field label={t('search.dateTo')} className="min-w-0">
              <input type="date" value={dateTo ?? ''} onChange={(e) => setParam('to', e.target.value || null)} className={fieldClass} />
            </Field>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setSearchParams({}, { replace: true })}
              className="min-h-11 text-sm font-medium text-cobalt dark:text-cobalt-lift"
            >
              {t('collection.clearFilters')}
            </button>
          )}
        </section>
      )}

      {!started ? (
        <div className="space-y-6 py-8">
          {recentSearches.length > 0 && (
            <section aria-label={t('search.recentSearches')}>
              <h2 className="mb-2 text-sm font-semibold text-ink-soft dark:text-dusk-soft">
                {t('search.recentSearches')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((q) => (
                  <Chip key={q} onClick={() => setInput(q)}>#{q}</Chip>
                ))}
              </div>
            </section>
          )}
          <RecentViewed byId={byId} />
          <EmptyState kind="search" title={t('search.initialTitle')} body={t('search.initial')} compact />
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          kind="search"
          title={t('search.noResultsTitle')}
          body={t('search.noResults')}
          action={
            <button
              type="button"
              onClick={() => {
                setInput('')
                setSearchParams({}, { replace: true })
              }}
              className="btn-cobalt min-h-11 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              {t('collection.clearFilters')}
            </button>
          }
        />
      ) : (
        <>
          <p className="mt-4 text-xs text-ink-soft dark:text-dusk-soft">
            {t('search.results', { count: results.length })}
          </p>
          <div className="mt-2 space-y-3" onClick={() => void commitSearch(input)}>
            {paged.map((rec) => (
              <RecordCard key={rec.id} record={rec} categories={categories} defaultCurrency={defaultCurrency} />
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                className="glass-soft min-h-11 w-full rounded-xl py-2.5 text-sm text-ink-soft dark:text-dusk-soft"
              >
                {t('collection.loadMore')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function RecentViewed({ byId }: { byId: Map<string, ConsumptionRecord> }) {
  const { t } = useTranslation()
  const viewed = useLiveQuery(() => db.settings.get('recentViewed'), [])?.value as string[] | undefined
  if (!viewed?.length) return null
  const rows = viewed
    .map((id) => byId.get(id))
    .filter((r): r is ConsumptionRecord => Boolean(r))
    .slice(0, 5)
  if (!rows.length) return null
  return (
    <section aria-label={t('search.recentViewed')}>
      <h2 className="mb-2 text-sm font-semibold text-ink-soft dark:text-dusk-soft">{t('search.recentViewed')}</h2>
      <ul className="space-y-1">
        {rows.map((rec) => (
          <li key={rec.id}>
            <Link
              to={`/record/${rec.id}`}
              className="flex min-h-11 items-baseline gap-2 rounded-xl px-2 py-2 text-sm hover:bg-cobalt-soft/50 dark:hover:bg-dusk-line/50"
            >
              <span className="truncate text-ink dark:text-dusk-ink">{rec.title}</span>
              <span className="shrink-0 text-xs text-ink-soft dark:text-dusk-soft">{rec.date ?? ''}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
