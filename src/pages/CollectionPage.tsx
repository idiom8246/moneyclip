import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { InsightsBlock } from '../components/InsightsBlock'
import { RecordCard } from '../components/RecordCard'
import { Chip } from '../components/ui'
import { IconSettings } from '../components/icons'
import { useAllTags, useCategories, usePagedList, useRecords, useSetSearchParam, useSetting } from '../hooks'
import { searchRecords, categoryDisplayName, type SortKey } from '../lib/search'
import { SAVE_REASONS, type SaveReason } from '../db/types'

export function CollectionPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const setParam = useSetSearchParam()

  const records = useRecords()
  const categories = useCategories() ?? []
  const allTags = useAllTags()
  const defaultCurrency = useSetting('defaultCurrency')

  const [sort, setSort] = useState<SortKey>('createdAt')
  const favoriteOnly = searchParams.get('fav') === '1'
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

  return (
    <div className="px-4 pb-4">
      <header className="flex min-h-14 items-center justify-between py-2">
        <h1 className="text-2xl font-bold tracking-tight">{t('collection.title')}</h1>
        <Link
          to="/settings"
          aria-label={t('settings.title')}
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-terracotta-soft/60 dark:text-dusk-soft dark:hover:bg-dusk-line/60"
        >
          <IconSettings />
        </Link>
      </header>

      {(records?.length ?? 0) > 0 && (
        <InsightsBlock
          records={records ?? []}
          categories={categories}
          onTripClick={(tag) => setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.set('tag', tag)
            return next
          }, { replace: true })}
        />
      )}

      {(records?.length ?? 0) > 0 && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip active={!favoriteOnly && !categoryFilter && !reasonFilter && !tagFilter}
              onClick={() => setSearchParams({}, { replace: true })}>
              {t('common.all')}
            </Chip>
            <Chip active={favoriteOnly} onClick={() => setParam('fav', favoriteOnly ? null : '1')}>
              ★ {t('collection.favorites')}
            </Chip>
            {categories.map((c) => (
              <Chip key={c.id} active={categoryFilter === c.id}
                onClick={() => setParam('cat', categoryFilter === c.id ? null : c.id)}>
                {c.icon} {categoryDisplayName(c, i18n.language)}
              </Chip>
            ))}
            {SAVE_REASONS.map((r) => (
              <Chip key={r} active={reasonFilter === r}
                onClick={() => setParam('reason', reasonFilter === r ? null : r)}>
                {t(`reasons.${r}`)}
              </Chip>
            ))}
            {allTags.slice(0, 12).map((tag) => (
              <Chip key={tag} active={tagFilter === tag}
                onClick={() => setParam('tag', tagFilter === tag ? null : tag)}>
                #{tag}
              </Chip>
            ))}
          </div>

          <div className="mt-3 flex justify-end">
            <label className="text-sm text-ink-soft dark:text-dusk-soft">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="min-h-9 rounded-lg bg-transparent px-2 text-sm"
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
        {records && visible.length === 0 && records.length === 0 ? (
          <div className="flex flex-col items-center gap-6 px-6 py-20 text-center">
            <p className="text-lg text-ink-soft dark:text-dusk-soft">{t('collection.empty')}</p>
            <button
              type="button"
              onClick={() => navigate('/add')}
              className="min-h-12 rounded-2xl bg-terracotta px-6 py-3 font-semibold text-paper shadow-lg shadow-terracotta/25 transition-transform active:scale-95"
            >
              {t('collection.emptyCta')}
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  )
}
