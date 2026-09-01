import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import { IconStar, IconTrash } from '../components/icons'
import { useAttachments, useCategories, useRateSource, useRecord, useSetting } from '../hooks'
import { convert, formatMoney } from '../lib/currency'
import { joinMerchantDate } from '../lib/format'
import { blobUrl, releaseBlobUrl } from '../lib/images'
import { deleteRecord, effectivePrice, setArchived, toggleFavorite } from '../lib/records'
import { categoryDisplayName } from '../lib/search'
import { getSetting, setSetting } from '../lib/settings'

export function RecordDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
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
        {joinMerchantDate(record)}
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

      {record.items && record.items.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-ink-soft dark:text-dusk-soft">
            {t('detail.items')}
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {record.items.map((item) => (
                <tr key={item.id} className="border-b border-line/70 last:border-0 dark:border-dusk-line/70">
                  <td className="py-2 pr-2">{item.name}</td>
                  <td className="py-2 pr-2 text-right text-ink-soft dark:text-dusk-soft">
                    {item.qty ?? 1} × {item.unitPrice ?? '—'}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {item.unitPrice !== undefined ? (item.qty ?? 1) * item.unitPrice : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {record.note && (
        <section className="mt-5">
          <h3 className="mb-1 text-sm font-semibold text-ink-soft dark:text-dusk-soft">{t('detail.note')}</h3>
          <p className="whitespace-pre-wrap rounded-2xl bg-paper-raised p-4 ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line">
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
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 transition-all active:scale-[0.98] dark:border-dusk-line"
        >
          <IconStar filled={record.favorite} className={record.favorite ? 'h-5 w-5 text-terracotta' : 'h-5 w-5'} />
          {t('collection.favorites')}
        </button>
        <button
          type="button"
          onClick={() => void setArchived(record.id, record.status !== 'archived')}
          className="flex min-h-12 items-center justify-center rounded-xl border border-line px-4 py-2.5 transition-all active:scale-[0.98] dark:border-dusk-line"
        >
          {record.status === 'archived' ? t('detail.unarchive') : t('detail.archive')}
        </button>
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-red-300 px-4 py-2.5 text-red-600 dark:border-red-900"
          >
            <IconTrash className="h-4 w-4" /> {t('common.delete')}
          </button>
        ) : (
          <div className="col-span-2 rounded-xl border border-red-300 p-4 dark:border-red-900">
            <p className="font-medium">{t('detail.deleteTitle')}</p>
            <p className="mt-0.5 text-sm text-ink-soft dark:text-dusk-soft">{t('detail.deleteBody')}</p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => void onDelete()}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white"
              >
                {t('common.confirm')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-xl border border-line px-4 py-2.5 dark:border-dusk-line"
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
