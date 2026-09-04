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
import { IconBookmark, IconReceipt } from './icons'

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
      className="group flex gap-3 rounded-[20px] glass-soft p-3 transition-all hover:shadow-[var(--glass-shadow)] active:scale-[0.99]"
    >
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl text-cobalt/50 dark:text-cobalt-lift/40 ${
        thumb ? 'bg-[#f1eee4] p-1 dark:bg-dusk-line/80' : 'bg-cobalt-soft/50 dark:bg-cobalt-lift/10'
      }`}>
        {thumb ? (
          <img src={thumb} alt="" className="receipt-photo h-full w-full rounded-[9px] object-cover" loading="lazy" />
        ) : (
          <IconReceipt className="h-7 w-7" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-semibold leading-6 tracking-tight">{record.title}</h3>
          {price !== undefined && (
            <span className="shrink-0 rounded-lg bg-paper-raised/70 px-1.5 py-0.5 text-sm font-semibold tabular-nums text-ink shadow-[inset_0_0_0_1px_var(--hairline)] dark:bg-dusk/70 dark:text-dusk-ink">
              {formatMoney(price, record.currency ?? defaultCurrency, i18n.language)}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-ink-soft dark:text-dusk-soft">
          {joinMerchantDate(record) || ' '}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {record.favorite && (
            <span className="text-cobalt dark:text-cobalt-lift" aria-label={t('collection.favorites')} title={t('collection.favorites')}>
              <IconBookmark filled className="h-3.5 w-3.5" />
            </span>
          )}
          {record.saveReason && (
            <span className="rounded-full bg-cobalt-soft px-2 py-0.5 font-medium text-cobalt-deep dark:bg-cobalt-lift/15 dark:text-cobalt-lift">
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
