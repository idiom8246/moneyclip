import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Category, ConsumptionRecord } from '../db/types'
import { formatMoney } from '../lib/currency'
import { joinMerchantDate } from '../lib/format'
import { effectivePrice } from '../lib/records'
import { categoryDisplayName } from '../lib/search'
import { useAttachments } from '../hooks'
import { useEffect, useState } from 'react'
import { blobUrl, releaseBlobUrl } from '../lib/images'

export function RecordCard({
  record,
  categories,
  defaultCurrency,
}: {
  record: ConsumptionRecord
  categories: Category[]
  defaultCurrency: string
}) {
  const { t, i18n } = useTranslation()
  const attachments = useAttachments(record.id)
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    const blob = attachments?.[0]?.thumbBlob
    if (!blob) return
    const url = blobUrl(blob)
    setThumb(url)
    return () => releaseBlobUrl(url)
  }, [attachments])

  const price = effectivePrice(record)
  const category = categories.find((c) => c.id === record.categoryId)

  return (
    <Link
      to={`/record/${record.id}`}
      className="flex gap-3 rounded-2xl bg-paper-raised p-3 shadow-sm ring-1 ring-line transition-transform active:scale-[0.99] dark:bg-dusk-raised dark:ring-dusk-line"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-terracotta-soft/50 dark:bg-dusk-line/50">
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl" aria-hidden>
            {category?.icon ?? '🗂️'}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-lg font-semibold leading-6">{record.title}</h3>
          {price !== undefined && (
            <span className="shrink-0 text-sm font-semibold text-ink-soft dark:text-dusk-soft">
              {formatMoney(price, record.currency ?? defaultCurrency, i18n.language)}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-ink-soft dark:text-dusk-soft">
          {joinMerchantDate(record) || '\u00A0'}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {record.favorite && <span aria-label={t('collection.favorites')} title={t('collection.favorites')}>★</span>}
          {record.saveReason && (
            <span className="rounded-full bg-terracotta-soft px-2 py-0.5 text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink">
              {t(`reasons.${record.saveReason}`)}
            </span>
          )}
          {category && (
            <span className="text-ink-soft dark:text-dusk-soft">
              {category.icon} {categoryDisplayName(category, i18n.language)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
