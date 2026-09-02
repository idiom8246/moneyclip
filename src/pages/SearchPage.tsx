import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { RecordCard } from '../components/RecordCard'
import { Chip, Field, fieldClass } from '../components/ui'
import { IconSearch, IconSettings } from '../components/icons'
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
  const [searchParams] = useSearchParams()
  const setParam = useSetSearchParam()

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
      <header className="sticky top-0 z-30 -mx-4 flex min-h-14 items-center justify-between border-b border-line/60 bg-paper/85 px-4 py-2 backdrop-blur-xl dark:border-dusk-line/60 dark:bg-dusk/85">
        <h1 className="text-2xl font-bold tracking-tight">{t('search.title')}</h1>
        <Link
          to="/settings"
          aria-label={t('settings.title')}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-terracotta-soft/60 active:scale-95 dark:text-dusk-soft dark:hover:bg-dusk-line/60"
        >
          <IconSettings />
        </Link>
      </header>

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

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip active={favoriteOnly} onClick={() => setParam('fav', favoriteOnly ? null : '1')}>
          ★ {t('search.favoriteOnly')}
        </Chip>
        <Chip active={includeArchived} onClick={() => setParam('arch', includeArchived ? null : '1')}>
          {t('search.includeArchived')}
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={categoryId === c.id}
            onClick={() => setParam('cat', categoryId === c.id ? null : c.id)}>
            {c.icon} {categoryDisplayName(c, i18n.language)}
          </Chip>
        ))}
        {SAVE_REASONS.map((r) => (
          <Chip key={r} active={saveReason === r}
            onClick={() => setParam('reason', saveReason === r ? null : r)}>
            {t(`reasons.${r}`)}
          </Chip>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label={t('search.dateFrom')} className="min-w-0">
          <input type="date" value={dateFrom ?? ''} onChange={(e) => setParam('from', e.target.value || null)} className={fieldClass} />
        </Field>
        <Field label={t('search.dateTo')} className="min-w-0">
          <input type="date" value={dateTo ?? ''} onChange={(e) => setParam('to', e.target.value || null)} className={fieldClass} />
        </Field>
      </div>

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
          <section aria-label={t('search.recentViewed')}>
            <h2 className="mb-2 text-sm font-semibold text-ink-soft dark:text-dusk-soft">
              {t('search.recentViewed')}
            </h2>
            <RecentViewed byId={byId} />
          </section>
          <p className="px-2 pt-4 text-center text-ink-soft dark:text-dusk-soft">{t('search.initial')}</p>
        </div>
      ) : results.length === 0 ? (
        <p className="px-6 py-16 text-center text-ink-soft dark:text-dusk-soft">{t('search.noResults')}</p>
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
                className="min-h-11 w-full rounded-xl border border-line py-2.5 text-sm text-ink-soft dark:border-dusk-line dark:text-dusk-soft"
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
  const viewed = useLiveQuery(() => db.settings.get('recentViewed'), [])?.value as string[] | undefined
  if (!viewed?.length) return null
  const rows = viewed
    .map((id) => byId.get(id))
    .filter((r): r is ConsumptionRecord => Boolean(r))
    .slice(0, 5)
  if (!rows.length) return null
  return (
    <ul className="space-y-1">
      {rows.map((rec) => (
        <li key={rec.id}>
          <Link
            to={`/record/${rec.id}`}
            className="flex min-h-11 items-baseline gap-2 rounded-xl px-2 py-2 text-sm hover:bg-terracotta-soft/50 dark:hover:bg-dusk-line/50"
          >
            <span className="truncate text-ink dark:text-dusk-ink">{rec.title}</span>
            <span className="shrink-0 text-xs text-ink-soft dark:text-dusk-soft">{rec.date ?? ''}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
