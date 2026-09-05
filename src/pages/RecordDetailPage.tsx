import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import { IconStar, IconTrash, IconArchive } from '../components/icons'
import { useAttachments, useCategories, useRateSource, useRecord, useSetting } from '../hooks'
import { convert, formatMoney } from '../lib/currency'
import { joinMerchantDate } from '../lib/format'
import { blobUrl, releaseBlobUrl } from '../lib/images'
import { deleteRecord, effectivePrice, setArchived, toggleFavorite } from '../lib/records'
import { InvoiceDetails } from '../components/InvoiceDetails'
import { ItemDetails } from '../components/ItemDetails'
import { addFromItem } from '../lib/inventory'
import { useToast } from '../components/Toast'
import { categoryDisplayName } from '../lib/search'
import { getSetting, setSetting } from '../lib/settings'

export function RecordDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'invoice' ? 'invoice' : 'items'
  const navigate = useNavigate()
  const record = useRecord(id)
  const categories = useCategories() ?? []
  const attachments = useAttachments(id)
  const defaultCurrency = useSetting('defaultCurrency')
  const rateSource = useRateSource()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([])

  // Spec §5.4: track recently viewed records.
  const recordId = record?.id
  useEffect(() => {
    if (!recordId) return
    void (async () => {
      const prev = await getSetting('recentViewed')
      const next = [recordId, ...prev.filter((x) => x !== recordId)].slice(0, 8)
      await setSetting('recentViewed', next)
    })()
  }, [recordId])

  useEffect(() => {
    if (!attachments) return
    const urls = attachments.map((a) => blobUrl(a.thumbBlob))
    setThumbs(urls)
    return () => urls.forEach(releaseBlobUrl)
  }, [attachments])

  const price = record ? effectivePrice(record) : undefined
  const currency = record?.currency ?? defaultCurrency
  const toast = useToast()
  const trackItem = (name: string, barcode?: string) => {
    if (!record) return
    void addFromItem(
      { name, barcode, categoryId: record.categoryId, sourceRecordId: record.id, sourceItemName: name },
    ).then((added) => {
      if (added) toast(t('inventory.added'))
    })
  }

  const converted = useMemo(() => {
    if (!record || price === undefined) return null
    if (currency.toUpperCase() === defaultCurrency.toUpperCase()) return null
    return convert(price, currency, defaultCurrency, rateSource)
  }, [record, price, currency, defaultCurrency, rateSource])

  if (record === undefined) return null
  const category = categories.find((c) => c.id === record.categoryId)

  const openLightbox = async (index: number) => {
    const att = attachments?.[index]
    if (!att) return
    const url = blobUrl(att.blob)
    setLightbox(url)
  }

  const onDelete = async () => {
    await deleteRecord(record.id)
    navigate('/', { replace: true })
  }

  return (
    <div className="px-4 pb-10">
      <PageHeader title={record.title} onBack={() => navigate(-1)} />

      {thumbs.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {thumbs.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => void openLightbox(i)}
              className="shrink-0 overflow-hidden rounded-2xl focus-visible:outline-terracotta"
              aria-label={`${t('form.photos')} ${i + 1}`}
            >
              <img src={src} alt="" className="h-56 w-auto object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold leading-tight">{record.title}</h2>
          {record.status === 'archived' && (
            <span className="mt-1 inline-block rounded-full bg-terracotta-soft px-2 py-0.5 text-xs text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink">
              {t('detail.archived')}
            </span>
          )}
        </div>
        {price !== undefined && (
          <div className="text-right">
            <p className="text-xl font-bold tabular-nums">{formatMoney(price, currency, i18n.language)}</p>
            {converted !== null ? (
              <p className="text-sm text-ink-soft dark:text-dusk-soft">
                {t('detail.approxConverted', { amount: formatMoney(Math.round(converted), defaultCurrency, i18n.language) })}
              </p>
            ) : currency.toUpperCase() !== defaultCurrency.toUpperCase() ? (
              <p className="text-xs text-ink-soft/70 dark:text-dusk-soft/70">({t('common.unconverted')})</p>
            ) : null}
          </div>
        )}
      </div>

      <p className="mt-1 text-sm text-ink-soft dark:text-dusk-soft">
        {record.merchant ? (
          <>
            <Link
              to={`/store/${encodeURIComponent(record.merchant)}`}
              className="underline decoration-line decoration-1 underline-offset-2 active:opacity-70 dark:decoration-dusk-line"
            >
              {record.merchant}
            </Link>
            {record.date && ` · ${record.date}`}
          </>
        ) : (
          joinMerchantDate(record)
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {record.saveReason && (
          <span className="rounded-full bg-terracotta-soft px-3 py-1 text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink">
            {t(`reasons.${record.saveReason}`)}
          </span>
        )}
        {category && (
          <span className="rounded-full bg-terracotta-soft px-3 py-1 text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink">
            {category.icon} {categoryDisplayName(category, i18n.language)}
          </span>
        )}
        {record.tags.map((tag) => (
          <span key={tag} className="rounded-full border border-line px-3 py-1 text-ink-soft dark:border-dusk-line dark:text-dusk-soft">
            #{tag}
          </span>
        ))}
      </div>

      <div role="tablist" aria-label={t('invoice.views')} className="mt-5 grid grid-cols-2 border-b border-line dark:border-dusk-line">
        {(['items', 'invoice'] as const).map((value) => <button
          key={value} id={`record-tab-${value}`} type="button" role="tab" aria-selected={tab === value}
          aria-controls={`record-panel-${value}`} tabIndex={tab === value ? 0 : -1}
          onClick={() => setParams({ tab: value }, { replace: true })}
          onKeyDown={(event) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
              event.preventDefault()
              const next = event.key === 'Home' ? 'items' : event.key === 'End' ? 'invoice' : value === 'items' ? 'invoice' : 'items'
              setParams({ tab: next }, { replace: true })
              document.getElementById(`record-tab-${next}`)?.focus()
            }
          }}
          className={`min-h-12 border-b-2 px-3 font-medium ${tab === value ? 'border-terracotta text-terracotta-deep dark:text-dusk-ink' : 'border-transparent text-ink dark:text-dusk-soft'}`}
        >{t(value === 'invoice' ? 'invoice.tab' : 'invoice.itemsTab')}</button>)}
      </div>
      <div id={`record-panel-${tab}`} role="tabpanel" aria-labelledby={`record-tab-${tab}`}>
        {tab === 'invoice' ? <InvoiceDetails record={record} onOpenSource={(attachmentId) => {
          const index = attachments?.findIndex((a) => a.id === attachmentId) ?? -1
          if (index >= 0) void openLightbox(index)
          else toast(t('invoice.sourceMissing'))
        }} /> : <ItemDetails items={record.items ?? []} currency={currency} onTrack={(item) => trackItem(item.name, item.barcode)} />}
      </div>

      {record.note && (
        <section className="mt-5">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft dark:text-dusk-soft">{t('detail.note')}</h3>
          <p className="whitespace-pre-wrap rounded-2xl bg-paper-raised p-4 shadow-sm shadow-ink/[0.04] ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line dark:shadow-none">
            {record.note}
          </p>
        </section>
      )}

      <p className="mt-5 text-xs text-ink-soft/70 dark:text-dusk-soft/70">
        {t('detail.createdAt', { date: new Date(record.createdAt).toLocaleDateString(i18n.language) })}
        {' · '}
        {t('detail.updatedAt', { date: new Date(record.updatedAt).toLocaleDateString(i18n.language) })}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          to={`/record/${record.id}/edit`}
          className="flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-b from-terracotta to-terracotta-deep px-4 py-2.5 font-semibold text-paper shadow-md shadow-terracotta/25 transition-all hover:brightness-105 active:scale-[0.98]"
        >
          {t('common.edit')}
        </Link>
        <button
          type="button"
          onClick={() => void toggleFavorite(record.id)}
          aria-pressed={record.favorite}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-paper-raised px-4 py-2.5 transition-all active:scale-[0.98] dark:border-dusk-line dark:bg-dusk-raised"
        >
          <IconStar filled={record.favorite} className={record.favorite ? 'h-5 w-5 text-terracotta' : 'h-5 w-5'} />
          {t('collection.favorites')}
        </button>
        <button
          type="button"
          onClick={() => void setArchived(record.id, record.status !== 'archived')}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-paper-raised px-4 py-2.5 transition-all active:scale-[0.98] dark:border-dusk-line dark:bg-dusk-raised"
        >
          <IconArchive className="h-5 w-5" />
          {record.status === 'archived' ? t('detail.unarchive') : t('detail.archive')}
        </button>
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-red-300 px-4 py-2.5 text-red-600 transition-all hover:bg-red-50 active:scale-[0.98] dark:border-red-900 dark:hover:bg-red-950/40"
          >
            <IconTrash className="h-4 w-4" /> {t('common.delete')}
          </button>
        ) : (
          <div className="col-span-2 rounded-2xl border border-red-300 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/30">
            <p className="font-semibold">{t('detail.deleteTitle')}</p>
            <p className="mt-0.5 text-sm text-ink-soft dark:text-dusk-soft">{t('detail.deleteBody')}</p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => void onDelete()}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white shadow-md shadow-red-600/25 transition-all active:scale-[0.98]"
              >
                {t('common.confirm')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-xl border border-line px-4 py-2.5 transition-all active:scale-[0.98] dark:border-dusk-line"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {lightbox && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => {
            releaseBlobUrl(lightbox)
            setLightbox(null)
          }}
          aria-label={t('common.close')}
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        </button>
      )}
    </div>
  )
}
