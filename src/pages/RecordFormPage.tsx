import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { TagInput } from '../components/TagInput'
import { useToast } from '../components/Toast'
import { Chip, Field, GhostButton, PageHeader, PrimaryButton, fieldClass } from '../components/ui'
import { IconCamera, IconScan, IconSparkle, IconX } from '../components/icons'
import { useAllTags, useCategories, useRecord, useSetting } from '../hooks'
import { blobUrl, processImageFile, releaseBlobUrl } from '../lib/images'
import { createOpenAiCompatibleProvider } from '../lib/ocr'
import { lookupProduct } from '../lib/products'
import {
  addAttachment,
  createRecord,
  deleteAttachment,
  itemsAutoTotal,
  updateRecord,
} from '../lib/records'
import { categoryDisplayName } from '../lib/search'
import { uid } from '../lib/uid'
import { COMMON_CURRENCIES } from '../lib/currency'
import { SAVE_REASONS, type RecordItem, type SaveReason } from '../db/types'
import { db } from '../db/db'

interface StagedPhoto {
  key: string
  /** existing attachment id (edit mode) */
  attachmentId?: string
  blob: Blob
  thumbBlob: Blob
  preview: string
}

export function RecordFormPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const existing = useRecord(id)
  const categories = useCategories() ?? []
  const allTags = useAllTags()
  const defaultCurrency = useSetting('defaultCurrency')
  const ocrConfig = useSetting('ocrConfig')
  const toast = useToast()

  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [date, setDate] = useState('')
  const [merchant, setMerchant] = useState('')
  const [saveReason, setSaveReason] = useState<SaveReason | undefined>()
  const [categoryId, setCategoryId] = useState<string>('')
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [items, setItems] = useState<RecordItem[]>([])
  const [itemsOpen, setItemsOpen] = useState(false)
  const [photos, setPhotos] = useState<StagedPhoto[]>([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrFilled, setOcrFilled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [hydrated, setHydrated] = useState(false)

  // Edit mode: hydrate once when the record arrives.
  useEffect(() => {
    if (!isEdit || hydrated || !existing) return
    setTitle(existing.title)
    setPrice(existing.price !== undefined ? String(existing.price) : '')
    setCurrency(existing.currency ?? defaultCurrency)
    setDate(existing.date ?? '')
    setMerchant(existing.merchant ?? '')
    setSaveReason(existing.saveReason)
    setCategoryId(existing.categoryId ?? '')
    setTags(existing.tags)
    setNote(existing.note ?? '')
    const its = existing.items ?? []
    setItems(its)
    if (its.length) setItemsOpen(true)
    void (async () => {
      const atts = await db.attachments.where('recordId').equals(existing.id).toArray()
      setPhotos(
        atts.map((a) => ({
          key: a.id,
          attachmentId: a.id,
          blob: a.blob,
          thumbBlob: a.thumbBlob,
          preview: blobUrl(a.thumbBlob),
        })),
      )
    })()
    setHydrated(true)
  }, [isEdit, hydrated, existing, defaultCurrency])

  useEffect(() => {
    if (!isEdit) setCurrency(defaultCurrency)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCurrency])

  // Release previews on unmount
  useEffect(
    () => () => photos.forEach((p) => releaseBlobUrl(p.preview)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const autoTotal = useMemo(() => itemsAutoTotal(items), [items])

  const onPickFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    for (const file of files) {
      try {
        const processed = await processImageFile(file)
        setPhotos((prev) => [
          ...prev,
          {
            key: uid(),
            blob: processed.blob,
            thumbBlob: processed.thumbBlob,
            preview: blobUrl(processed.thumbBlob),
          },
        ])
      } catch {
        // Spec §8: failed image never discards the others / the form.
        toast(t('barcode.cameraError'))
      }
    }
  }

  const removePhoto = (key: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key)
      if (target?.attachmentId) {
        setRemovedAttachmentIds((ids) => [...ids, target.attachmentId!])
      }
      if (target) releaseBlobUrl(target.preview)
      return prev.filter((p) => p.key !== key)
    })
  }

  const onScanResult = async (code: string) => {
    setScanning(false)
    const product = await lookupProduct(code)
    const name = product ? (product.brand ? `${product.brand} ${product.name}` : product.name) : ''
    setItems((prev) => [...prev, { id: uid(), name, barcode: code }])
    setItemsOpen(true)
    toast(product ? t('barcode.found', { name }) : t('barcode.notFound'))
  }

  const runOcr = async () => {
    if (!ocrConfig.baseUrl || !ocrConfig.model) {
      toast(t('form.ocrNotConfigured'))
      navigate('/settings')
      return
    }
    const photo = photos[0]
    if (!photo) return
    setOcrBusy(true)
    try {
      const provider = createOpenAiCompatibleProvider()
      const receipt = await provider.extract({ image: photo.blob, config: ocrConfig })
      // Only fill fields the user hasn't touched (spec §6.2 — never overwrite).
      if (!merchant && receipt.merchant) setMerchant(receipt.merchant)
      if (!date && receipt.date) setDate(receipt.date)
      if (!price && receipt.total !== undefined) setPrice(String(receipt.total))
      if (receipt.currency) setCurrency(receipt.currency)
      if (receipt.items?.length && items.length === 0) {
        setItems(receipt.items.map((i) => ({ id: uid(), ...i })))
        setItemsOpen(true)
      }
      setOcrFilled(true)
    } catch {
      toast(t('form.ocrFailed'))
    } finally {
      setOcrBusy(false)
    }
  }

  const onSave = async () => {
    if (!title.trim()) {
      setTitleError(true)
      return
    }
    setSaving(true)
    const payload = {
      title: title.trim(),
      price: price ? Number(price) : undefined,
      currency: currency || undefined,
      date: date || undefined,
      merchant: merchant.trim() || undefined,
      saveReason,
      categoryId: categoryId || null,
      tags,
      note: note.trim() || undefined,
      items: items.filter((i) => i.name.trim()),
    }
    try {
      let recordId: string
      if (isEdit && id) {
        await updateRecord(id, payload)
        recordId = id
        for (const attId of removedAttachmentIds) await deleteAttachment(attId)
      } else {
        recordId = (await createRecord(payload)).id
      }
      for (const photo of photos) {
        if (!photo.attachmentId) {
          await addAttachment(recordId, photo.blob, photo.thumbBlob)
        }
      }
      navigate(`/record/${recordId}`, { replace: true })
    } catch (err) {
      // Spec §8: quota errors get an explicit message; form state is preserved.
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        toast(t('form.saveErrorQuota'))
      } else {
        toast(String(err instanceof Error ? err.message : err))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4">
      <PageHeader
        title={isEdit ? t('form.editRecord') : t('form.newRecord')}
        onBack={() => navigate(-1)}
        action={
          <PrimaryButton onClick={onSave} disabled={saving} className="min-h-10 px-5">
            {t('common.save')}
          </PrimaryButton>
        }
      />

      <div className="space-y-5 pb-8">
        {/* 1. Photos row */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft dark:text-dusk-soft">
            {t('form.photos')}
          </span>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {photos.map((p) => (
              <div key={p.key} className="relative h-24 w-24 shrink-0">
                <img src={p.preview} alt={t('form.photos')} className="h-24 w-24 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(p.key)}
                  aria-label={t('common.delete')}
                  className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper dark:bg-dusk-line dark:text-dusk-ink"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label={t('form.addPhoto')}
              className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-ink-soft dark:border-dusk-line dark:text-dusk-soft"
            >
              <IconCamera />
              <span className="text-xs">{t('form.addPhoto')}</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              capture={undefined}
              className="hidden"
              onChange={onPickFiles}
            />
          </div>
        </div>

        {/* 2. Title (only required field) */}
        <Field label={`${t('form.title')} *`}>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setTitleError(false)
            }}
            placeholder={t('form.titlePlaceholder')}
            required
            aria-invalid={titleError}
            className={`${fieldClass} text-lg font-semibold ${titleError ? '!border-red-500' : ''}`}
          />
          {titleError && <p className="mt-1 text-sm text-red-600">{t('form.titleRequired')}</p>}
        </Field>

        {/* 3. Price + currency */}
        <div className="flex gap-3">
          <Field label={t('form.price')}>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder={autoTotal !== undefined ? String(autoTotal) : undefined}
              className={fieldClass}
            />
          </Field>
          <Field label={t('form.currency')}>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={fieldClass}>
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              {!COMMON_CURRENCIES.includes(currency as never) && currency && (
                <option value={currency}>{currency}</option>
              )}
            </select>
          </Field>
        </div>
        {autoTotal !== undefined && (
          <p className="-mt-3 text-xs text-ink-soft dark:text-dusk-soft">
            {t('form.itemsTotal', { amount: autoTotal })}
          </p>
        )}

        {/* 4. Date + merchant */}
        <div className="flex gap-3">
          <Field label={t('form.date')}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </Field>
          <Field label={t('form.merchant')}>
            <input value={merchant} onChange={(e) => setMerchant(e.target.value)} className={fieldClass} />
          </Field>
        </div>

        {/* 5. Reason chips */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft dark:text-dusk-soft">
            {t('form.reason')}
          </span>
          <div className="flex flex-wrap gap-2">
            {SAVE_REASONS.map((r) => (
              <Chip key={r} active={saveReason === r}
                onClick={() => setSaveReason(saveReason === r ? undefined : r)}>
                {t(`reasons.${r}`)}
              </Chip>
            ))}
          </div>
        </div>

        {/* 6. Category + tags */}
        <Field label={t('form.category')}>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldClass}>
            <option value="">{t('form.noCategory')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {categoryDisplayName(c, i18n.language)}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft dark:text-dusk-soft">
            {t('form.tags')}
          </span>
          <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
        </div>

        {/* 7. Note */}
        <Field label={t('form.note')}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('form.notePlaceholder')}
            rows={3}
            className={`${fieldClass} resize-y`}
          />
        </Field>

        {/* 8. Collapsible items editor */}
        <div className="rounded-xl border border-line dark:border-dusk-line">
          <button
            type="button"
            onClick={() => setItemsOpen((o) => !o)}
            aria-expanded={itemsOpen}
            className="flex min-h-11 w-full items-center justify-between px-3.5 text-sm font-medium"
          >
            <span>{t('form.items')} {items.length > 0 && `(${items.length})`}</span>
            <span className="text-ink-soft dark:text-dusk-soft">
              {itemsOpen ? t('form.itemsHide') : t('form.itemsShow')}
            </span>
          </button>
          {itemsOpen && (
            <div className="space-y-3 border-t border-line p-3 dark:border-dusk-line">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg bg-paper p-2.5 ring-1 ring-line dark:bg-dusk dark:ring-dusk-line">
                  <div className="flex items-center gap-2">
                    <input
                      value={item.name}
                      onChange={(e) =>
                        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, name: e.target.value } : x)))
                      }
                      placeholder={t('form.itemName')}
                      aria-label={t('form.itemName')}
                      className={`${fieldClass} min-h-10 text-sm`}
                    />
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                      aria-label={t('common.delete')}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:bg-terracotta-soft/60 dark:text-dusk-soft dark:hover:bg-dusk-line/60"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <input
                      value={item.qty ?? ''}
                      onChange={(e) =>
                        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, qty: e.target.value ? Number(e.target.value) : undefined } : x)))
                      }
                      placeholder={t('form.qty')}
                      inputMode="numeric"
                      aria-label={t('form.qty')}
                      className={`${fieldClass} min-h-10 text-sm`}
                    />
                    <input
                      value={item.unitPrice ?? ''}
                      onChange={(e) =>
                        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, unitPrice: e.target.value ? Number(e.target.value) : undefined } : x)))
                      }
                      placeholder={t('form.unitPrice')}
                      inputMode="decimal"
                      aria-label={t('form.unitPrice')}
                      className={`${fieldClass} min-h-10 text-sm`}
                    />
                    <input
                      value={item.barcode ?? ''}
                      onChange={(e) =>
                        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, barcode: e.target.value || undefined } : x)))
                      }
                      placeholder={t('form.barcode')}
                      inputMode="numeric"
                      aria-label={t('form.barcode')}
                      className={`${fieldClass} min-h-10 text-sm`}
                    />
                  </div>
                </div>
              ))}
              <GhostButton type="button" onClick={() => setItems((p) => [...p, { id: uid(), name: '' }])} className="w-full">
                {t('form.addItem')}
              </GhostButton>
            </div>
          )}
        </div>

        {/* Tool buttons: barcode + OCR */}
        <div className="flex gap-3">
          <GhostButton type="button" onClick={() => setScanning(true)} className="flex-1">
            <IconScan className="h-5 w-5" /> {t('form.scanBarcode')}
          </GhostButton>
          <GhostButton
            type="button"
            onClick={() => void runOcr()}
            disabled={photos.length === 0 || ocrBusy}
            className="flex-1"
          >
            <IconSparkle className="h-5 w-5" />
            {ocrBusy ? t('form.ocrWorking') : t('form.ocr')}
          </GhostButton>
        </div>
        {ocrFilled && (
          <p role="status" className="rounded-xl bg-terracotta-soft px-3 py-2 text-sm text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink">
            ✦ {t('form.ocrFilled')}
          </p>
        )}
      </div>

      {scanning && <BarcodeScanner onResult={(code) => void onScanResult(code)} onClose={() => setScanning(false)} />}
    </div>
  )
}
