import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { InsightsBlock } from '../components/InsightsBlock'
import { RecordCard } from '../components/RecordCard'
import { Chip, PageHeader } from '../components/ui'
import { IconBookmark } from '../components/icons'
import { useAllTags, useCategories, usePagedList, useRecords, useSetSearchParam, useSetting } from '../hooks'
import { searchRecords, categoryDisplayName, type SortKey } from '../lib/search'
import { SAVE_REASONS, type SaveReason } from '../db/types'

export function CollectionPage({ mode = 'invoices' }: { mode?: 'invoices' | 'saved' }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const setParam = useSetSearchParam()
  const records = useRecords()
  const categories = useCategories() ?? []
  const allTags = useAllTags()
  const defaultCurrency = useSetting('defaultCurrency')

  const [sort, setSort] = useState<SortKey>('createdAt')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const isSaved = mode === 'saved'
  const favoriteOnly = isSaved || searchParams.get('fav') === '1'
  const categoryFilter = searchParams.get('cat') ?? null
  const reasonFilter = searchParams.get('reason') as SaveReason | null
  const tagFilter = searchParams.get('tag') ?? null

  const visible = useMemo(
    () =>
      searchRecords(records ?? [], categories, '', {
        favoriteOnly,
        categoryId: categoryFilter,
        saveReason: reasonFilter,
        tag: tagFilter,
      }, sort),
    [records, categories, sort, favoriteOnly, categoryFilter, reasonFilter, tagFilter],
  )
  const { visible: paged, hasMore, loadMore } = usePagedList(visible)
  const selectedCategory = categories.find((c) => c.id === categoryFilter)
  const filterCount =
    Number(!isSaved && favoriteOnly) + Number(Boolean(categoryFilter)) + Number(Boolean(reasonFilter)) + Number(Boolean(tagFilter))
  const hasNarrowingFilters = Boolean(categoryFilter || reasonFilter || tagFilter || (!isSaved && favoriteOnly))
  const clearFilters = () => setSearchParams({}, { replace: true })

  return (
    <div className="px-4 pb-4">
      <PageHeader title={isSaved ? t('nav.collection') : t('nav.invoices')} />

      {!isSaved && (records?.length ?? 0) > 0 && (
        <InsightsBlock records={records ?? []} categories={categories} />
      )}

      {(records?.length ?? 0) > 0 && (
        <>
          <div className="-mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip active={!hasNarrowingFilters} onClick={clearFilters} className="shrink-0">
              {t('common.all')}
            </Chip>
            {!isSaved && favoriteOnly && (
              <Chip active onClick={() => setParam('fav', null)} className="shrink-0">
                <IconBookmark filled className="h-3.5 w-3.5" /> {t('collection.favorites')}
              </Chip>
            )}
            {selectedCategory && (
              <Chip active onClick={() => setParam('cat', null)} className="shrink-0">
                {selectedCategory.icon} {categoryDisplayName(selectedCategory, i18n.language)}
              </Chip>
            )}
            {reasonFilter && (
              <Chip active onClick={() => setParam('reason', null)} className="shrink-0">
                {t(`reasons.${reasonFilter}`)}
              </Chip>
            )}
            {tagFilter && (
              <Chip active onClick={() => setParam('tag', null)} className="shrink-0">#{tagFilter}</Chip>
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all active:scale-95 ${
                filtersOpen || filterCount > 0
                  ? 'bg-cobalt-soft text-cobalt-deep dark:bg-cobalt-lift/15 dark:text-cobalt-lift'
                  : 'glass-soft text-ink dark:text-dusk-ink'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              {t('collection.moreFilters')}
              {filterCount > 0 && <span className="tabular-nums">{filterCount}</span>}
            </button>
          </div>

          {filtersOpen && (
            <section className="glass-soft animate-rise-in mt-2 space-y-4 rounded-[20px] p-4" aria-label={t('collection.moreFilters')}>
              {!isSaved && (
                <div>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft dark:text-dusk-soft">
                    {t('collection.savedFilter')}
                  </h2>
                  <Chip active={favoriteOnly} onClick={() => setParam('fav', favoriteOnly ? null : '1')}>
                    <IconBookmark filled={favoriteOnly} className="h-3.5 w-3.5" /> {t('collection.favorites')}
                  </Chip>
                </div>
              )}
              <div>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft dark:text-dusk-soft">
                  {t('collection.filterByCategory')}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <Chip key={c.id} active={categoryFilter === c.id}
                      onClick={() => setParam('cat', categoryFilter === c.id ? null : c.id)}>
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
                    <Chip key={r} active={reasonFilter === r}
                      onClick={() => setParam('reason', reasonFilter === r ? null : r)}>
                      {t(`reasons.${r}`)}
                    </Chip>
                  ))}
                </div>
              </div>
              {allTags.length > 0 && (
                <div>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft dark:text-dusk-soft">
                    {t('collection.filterByTag')}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {allTags.slice(0, 12).map((tag) => (
                      <Chip key={tag} active={tagFilter === tag}
                        onClick={() => setParam('tag', tagFilter === tag ? null : tag)}>
                        #{tag}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="mt-2 flex justify-end">
            <label className="text-sm text-ink-soft dark:text-dusk-soft">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="min-h-11 rounded-lg bg-transparent px-2 text-sm"
                aria-label={t('collection.sort.label')}
              >
                <option value="createdAt">{t('collection.sort.createdAt')}</option>
                <option value="date">{t('collection.sort.date')}</option>
                <option value="priceDesc">{t('collection.sort.priceDesc')}</option>
                <option value="priceAsc">{t('collection.sort.priceAsc')}</option>
              </select>
            </label>
          </div>
        </>
      )}

      <div className="mt-4 space-y-3">
        {records && visible.length === 0 ? (
          <EmptyState
            kind={isSaved ? 'saved' : 'invoices'}
            title={
              hasNarrowingFilters
                ? t('collection.noFilteredTitle')
                : isSaved
                  ? t('collection.savedEmptyTitle')
                  : t('collection.emptyTitle')
            }
            body={
              hasNarrowingFilters
                ? t('collection.noFilteredBody')
                : isSaved
                  ? t('collection.savedEmptyBody')
                  : t('collection.empty')
            }
            action={
              <button
                type="button"
                onClick={() => hasNarrowingFilters ? clearFilters() : navigate(isSaved ? '/' : '/add')}
                className="btn-cobalt min-h-12 rounded-2xl px-6 py-3 text-base font-semibold transition-transform active:scale-95 hover:brightness-110"
              >
                {hasNarrowingFilters
                  ? t('collection.clearFilters')
                  : isSaved
                    ? t('collection.browseInvoices')
                    : t('collection.emptyCta')}
              </button>
            }
          />
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
