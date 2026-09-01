import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { RecordCard } from '../components/RecordCard'
import { Chip, Field, fieldClass } from '../components/ui'
import { IconSearch } from '../components/icons'
import { useCategories, useRecords, useSetting } from '../hooks'
import { searchRecords, categoryDisplayName } from '../lib/search'
import { SAVE_REASONS, type SaveReason } from '../db/types'

const DEBOUNCE_MS = 200

export function SearchPage() {
  const { t, i18n } = useTranslation()
  const records = useRecords()
  const categories = useCategories() ?? []
  const defaultCurrency = useSetting('defaultCurrency')
  const [searchParams, setSearchParams] = useSearchParams()

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

  const setParam = (key: string, value: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })
  }

  const results = useMemo(
    () =>
      searchRecords(records ?? [], categories, query, {
        includeArchived, favoriteOnly, categoryId, saveReason, dateFrom, dateTo,
      }),
    [records, categories, query, includeArchived, favoriteOnly, categoryId, saveReason, dateFrom, dateTo],
  )

  const hasFilters = includeArchived || favoriteOnly || !!categoryId || !!saveReason || !!dateFrom || !!dateTo
  const started = query.trim().length > 0 || hasFilters

  return (
    <div className="px-4">
      <h1 className="py-4 text-2xl font-bold">{t('search.title')}</h1>

      <div className="relative">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft dark:text-dusk-soft" />
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
        <Field label={t('search.dateFrom')}>
          <input type="date" value={dateFrom ?? ''} onChange={(e) => setParam('from', e.target.value || null)} className={fieldClass} />
        </Field>
        <Field label={t('search.dateTo')}>
          <input type="date" value={dateTo ?? ''} onChange={(e) => setParam('to', e.target.value || null)} className={fieldClass} />
        </Field>
      </div>

      {!started ? (
        <p className="px-2 py-16 text-center text-ink-soft dark:text-dusk-soft">{t('search.initial')}</p>
      ) : results.length === 0 ? (
        <p className="px-6 py-16 text-center text-ink-soft dark:text-dusk-soft">{t('search.noResults')}</p>
      ) : (
        <>
          <p className="mt-4 text-xs text-ink-soft dark:text-dusk-soft">
            {t('search.results', { count: results.length })}
          </p>
          <div className="mt-2 space-y-3">
            {results.map((rec) => (
              <RecordCard key={rec.id} record={rec} categories={categories} defaultCurrency={defaultCurrency} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
