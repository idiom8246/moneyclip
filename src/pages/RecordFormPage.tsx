import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { Pencil } from 'lucide-react'
import { TagInput } from '../components/TagInput'
import { useToast } from '../components/Toast'
import { Chip, DisclosureCard, Field, GhostButton, PageHeader, PrimaryButton, SectionCard, fieldClass } from '../components/ui'
import { IconCamera, IconScan, IconSparkle, IconX } from '../components/icons'
import { useAllTags, useCategories, useRecord, useSetting } from '../hooks'
import { blobUrl, processImageFile, releaseBlobUrl } from '../lib/images'
import { createOpenAiCompatibleProvider, describeOcrError } from '../lib/ocr'
import { clearFormDraft, isDraftMeaningful, loadFormDraft, saveFormDraft } from '../lib/drafts'
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
import { COMMON_CURRENCIES, isCommonCurrency } from '../lib/currency'
import { SAVE_REASONS, type RecordItem, type SaveReason } from '../db/types'
import { db } from '../db/db'
import type { InvoiceDetails } from '../db/invoice'
import { InvoiceDetails as InvoiceView, InvoiceReview } from '../components/InvoiceDetails'
import { bindInvoiceItems, isRestrictedBarcode, mergeInvoiceEvidence } from '../lib/invoice'

interface StagedPhoto {
  key: string
  /** existing attachment id (edit mode) */
  attachmentId?: string
  blob: Blob
  thumbBlob: Blob
  preview: string
}

/** Local yyyy-mm-dd for today — a journal assumes today, not blank. */
function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  const [date, setDate] = useState(localToday())
  const [merchant, setMerchant] = useState('')
  const [saveReason, setSaveReason] = useState<SaveReason | undefined>()
  const [categoryId, setCategoryId] = useState<string>('')
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  // Manual entry always shows at least one blank row; unnamed rows are
  // dropped on save (see onSave).
  const [items, setItems] = useState<RecordItem[]>([{ id: uid(), name: '' }])
  const [invoice, setInvoice] = useState<InvoiceDetails>()
  const [pendingItems, setPendingItems] = useState<RecordItem[]>([])
  const [ocrPhotoKey, setOcrPhotoKey] = useState('')
  const dateTouched = useRef(false)
  const currentItems = useRef(items)
  currentItems.current = items
  const [photos, setPhotos] = useState<StagedPhoto[]>([])
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [ocrBusy, setOcrBusy] = useState(false)
  const ocrAbort = useRef<AbortController | null>(null)
  const [ocrFilled, setOcrFilled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [hydrated, setHydrated] = useState(false)
  // Tracks manual price edits so the items auto-sum can pre-fill without
  // fighting the user (spec §4: 自動加總,仍可手動覆寫).
  const priceTouched = useRef(false)
  // Draft lifecycle: restore once on mount, then debounce-persist changes.
  const draftRestored = useRef(false)
  const draftTimer = useRef<number>()

  const updateItem = (itemId: string, patch: Partial<RecordItem>) =>
    setItems((prev) => prev.map((x) => (x.id === itemId ? {
      ...x, ...patch,
      // A manual quantity/price edit invalidates a formerly derived snapshot.
      ...(['qty', 'unitPrice', 'lineTotal', 'quantityText', 'priceQuantity', 'priceUnit', 'unit', 'priceBasis', 'lineKind'].some((key) => key in patch)
        ? { baseUnitPrice: undefined } : {}),
      ...('qty' in patch ? { quantityText: undefined } : {}),
    } : x)))

  // Edit mode: hydrate once when the record arrives.
  useEffect(() => {
    if (!isEdit || hydrated || !existing) return
    setTitle(existing.title)
    setPrice(existing.price !== undefined ? String(existing.price) : '')
    // A stored price is user data — don't let auto-sum clobber it.
    priceTouched.current = existing.price !== undefined
    setCurrency(existing.currency ?? defaultCurrency)
    setDate(existing.date ?? '')
    dateTouched.current = Boolean(existing.date)
    setInvoice(existing.invoice)
    setMerchant(existing.merchant ?? '')
    setSaveReason(existing.saveReason)
    setCategoryId(existing.categoryId ?? '')
    setTags(existing.tags)
    setNote(existing.note ?? '')
    const its = existing.items ?? []
    setItems(its.length ? its : [{ id: uid(), name: '' }])
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
    if (!isEdit && !draftRestored.current) setCurrency(defaultCurrency)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCurrency])

  // New-record mode: restore an unsaved draft once (kill-the-tab safety).
  useEffect(() => {
    if (isEdit) {
      draftRestored.current = true
      return
    }
    let cancelled = false
    void (async () => {
      const draft = await loadFormDraft(db)
      if (cancelled || draftRestored.current) return
      draftRestored.current = true
      if (!draft || !isDraftMeaningful(draft)) return
      setTitle(draft.title)
      setPrice(draft.price)
      setCurrency(draft.currency || defaultCurrency)
      setDate(draft.date || localToday())
      dateTouched.current = draft.dateTouched ?? Boolean(draft.date)
      setInvoice(draft.invoice)
      setMerchant(draft.merchant)
      setSaveReason(draft.saveReason)
      setCategoryId(draft.categoryId ?? '')
      setTags(draft.tags)
      setNote(draft.note)
      setItems(draft.items.length ? draft.items : [{ id: uid(), name: '' }])
      if (draft.photos.length) {
        setPhotos(
          draft.photos.map((p) => ({
            key: p.key,
            blob: p.blob,
            thumbBlob: p.thumbBlob,
            preview: blobUrl(p.thumbBlob),
          })),
        )
      }
      priceTouched.current = Boolean(draft.price)
      toast(t('form.draftRestored'))
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit])

  // Debounce-persist the working draft so an interrupted session survives.
  useEffect(() => {
    if (isEdit || saving || !draftRestored.current) return
    window.clearTimeout(draftTimer.current)
    draftTimer.current = window.setTimeout(() => {
      void saveFormDraft(
        {
          title,
          price,
          currency,
          date,
          dateTouched: dateTouched.current,
          merchant,
          saveReason,
          categoryId,
          tags,
          note,
          items,
          invoice,
          photos: photos.map((p) => ({ key: p.key, blob: p.blob, thumbBlob: p.thumbBlob })),
        },
        db,
      )
    }, 600)
    return () => window.clearTimeout(draftTimer.current)
  }, [isEdit, saving, title, price, currency, date, merchant, saveReason, categoryId, tags, note, items, invoice, photos])

  // Release previews on unmount
  useEffect(
    () => () => photos.forEach((p) => releaseBlobUrl(p.preview)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const autoTotal = useMemo(() => itemsAutoTotal(items), [items])

  // Auto-sum pre-fill: only while the user hasn't hand-edited the price.
  useEffect(() => {
    if (autoTotal !== undefined && !priceTouched.current) setPrice(String(autoTotal))
  }, [autoTotal])

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
        // Spec §8: a failed image never discards the others / the form —
        // and say what actually failed (not the camera).
        toast(t('form.imageProcessFailed'))
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
    const product = isRestrictedBarcode(code) ? null : await lookupProduct(code)
    const name = product ? (product.brand ? `${product.brand} ${product.name}` : product.name) : ''
    // Fill the blank default row first; only append when every row is in use.
    setItems((prev) => {
      const i = prev.findIndex(
        (x) => !x.name.trim() && x.barcode === undefined && x.qty === undefined && x.unitPrice === undefined,
      )
      if (i >= 0) return prev.map((x, idx) => (idx === i ? { ...x, name, barcode: code } : x))
      return [...prev, { id: uid(), name, barcode: code }]
    })
    toast(product ? t('barcode.found', { name }) : t('barcode.notFound'))
  }

  const runOcr = async () => {
    if (!ocrConfig.baseUrl || !ocrConfig.model) {
      toast(t('form.ocrNotConfigured'))
      navigate('/settings')
      return
    }
    const photo = photos.find((p) => p.key === ocrPhotoKey) ?? photos[0]
    if (!photo) return
    setOcrBusy(true)
    const controller = new AbortController()
    ocrAbort.current = controller
    try {
      const provider = createOpenAiCompatibleProvider()
      const receipt = await provider.extract({ image: photo.blob, config: ocrConfig, signal: controller.signal })
      // Only fill fields the user hasn't touched (spec §6.2 — never overwrite).
      if (receipt.merchant) setMerchant((prev) => prev || receipt.merchant!)
      if (!dateTouched.current && receipt.date) setDate(receipt.date)
      const fillsTotal = !priceTouched.current && receipt.total !== undefined
      if (fillsTotal) {
        setPrice(String(receipt.total))
        priceTouched.current = true
      }
      // Currency rides along only when we filled the total (its currency),
      // never overwriting a user-entered amount's currency.
      if (receipt.currency && fillsTotal) setCurrency(receipt.currency)
      const sourceId = uid()
      const extractedItems = (receipt.items ?? []).map((i) => ({ ...i, id: uid(), sourceId }))
      if (extractedItems.length && !currentItems.current.some((i) => i.name.trim())) setItems(extractedItems)
      else setPendingItems(extractedItems)
      setInvoice((prev) => mergeInvoiceEvidence(prev, bindInvoiceItems(receipt.invoice, extractedItems), {
        id: sourceId, attachmentId: photo.attachmentId ?? photo.key,
      }))
      setOcrFilled(true)
    } catch (err) {
      // User-initiated cancel: form untouched, no failure noise.
      if (controller.signal.aborted) return
      // Spec §6.2: never lose the user's form state — surface WHY it failed
      // (401/400/404/CORS) so config mistakes are self-diagnosable.
      const { key, detail } = describeOcrError(err)
      toast(t(key, { reason: detail }))
    } finally {
      setOcrBusy(false)
      ocrAbort.current = null
    }
  }

  const onSave = async () => {
    if (!title.trim()) {
      setTitleError(true)
      return
    }
    setSaving(true)
    window.clearTimeout(draftTimer.current)
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
      invoice,
    }
    try {
      let recordId = id ?? ''
      await db.transaction('rw', [db.records, db.attachments, db.drafts], async () => {
        if (isEdit && id) {
          await updateRecord(id, payload)
          for (const attId of removedAttachmentIds) await deleteAttachment(attId)
        } else {
          recordId = (await createRecord(payload)).id
        }
        const mapping = new Map<string, string>()
        for (const photo of photos) {
          if (!photo.attachmentId) {
            const attachment = await addAttachment(recordId, photo.blob, photo.thumbBlob)
            mapping.set(photo.key, attachment.id)
          }
        }
        if (invoice) await updateRecord(recordId, { invoice: { ...invoice,
          adjustments: invoice.adjustments?.map((adjustment) => ({ ...adjustment,
            itemIds: Array.isArray(adjustment.itemIds) ? adjustment.itemIds.filter((itemId) => payload.items.some((item) => item.id === itemId)) : undefined,
          })),
          sources: invoice.sources?.map((source) => ({
          ...source, attachmentId: mapping.get(source.attachmentId ?? '') ?? source.attachmentId,
        })) } })
        if (!isEdit) await clearFormDraft(db)
      })
      navigate(`/record/${recordId}`, { replace: true })
      toast(t('form.saved'), {
        label: t('inventory.addToInventory'),
        onClick: () => navigate(`/record/${recordId}`),
      })
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
      />

      <div className="space-y-5 pb-8">
        {/* Section A: 掃描/上載 — two obvious sub-options side by side */}
        <SectionCard title={t('form.sectionCapture')} icon={<IconCamera />}>
          <div className="grid grid-cols-2 gap-3">
            {/* (i) 發票相片: photo picker strip + OCR */}
            <div className="min-w-0 rounded-xl border border-line p-3 dark:border-dusk-line">
              <span className="mb-2 block text-sm font-medium">{t('form.photoOcr')}</span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((p) => (
                  <div key={p.key} className="relative h-20 w-20 shrink-0">
                    <img src={p.preview} alt={t('form.photoOcr')} className="h-20 w-20 rounded-xl object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(p.key)}
                      aria-label={t('common.delete')}
                      className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-ink/90 text-paper dark:bg-dusk-line dark:text-dusk-ink"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  aria-label={t('form.addPhoto')}
                  className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-ink-soft dark:border-dusk-line dark:text-dusk-soft"
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
              {photos.length > 1 && <label className="mt-2 block text-sm">
                {t('invoice.photoToRead')}
                <select aria-label={t('invoice.photoToRead')} value={ocrPhotoKey || photos[0]?.key} onChange={(e) => setOcrPhotoKey(e.target.value)} className={fieldClass}>
                  {photos.map((p, i) => <option key={p.key} value={p.key}>{t('invoice.photo', { count: i + 1 })}</option>)}
                </select>
              </label>}
              {ocrBusy ? (
                <GhostButton
                  type="button"
                  onClick={() => ocrAbort.current?.abort()}
                  className="mt-2 w-full whitespace-nowrap"
                >
                  {t('common.cancel')}
                </GhostButton>
              ) : (
                <GhostButton
                  type="button"
                  onClick={() => void runOcr()}
                  disabled={photos.length === 0}
                  className="mt-2 w-full whitespace-nowrap"
                >
                  <IconSparkle className="h-5 w-5" />
                  {t('form.ocr')}
                </GhostButton>
              )}
            </div>
            {/* (ii) 條碼 */}
            <div className="flex min-w-0 flex-col rounded-xl border border-line p-3 dark:border-dusk-line">
              <span className="mb-2 block text-sm font-medium">{t('form.barcodeOption')}</span>
              <p className="text-xs text-ink-soft dark:text-dusk-soft">{t('barcode.scanning')}</p>
              <GhostButton
                type="button"
                onClick={() => setScanning(true)}
                className="mt-auto w-full whitespace-nowrap"
              >
                <IconScan className="h-5 w-5" /> {t('form.scanBarcode')}
              </GhostButton>
            </div>
          </div>
          {ocrFilled && (
            <p role="status" className="mt-3 rounded-xl bg-terracotta-soft px-3 py-2 text-sm text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink">
              ✦ {t('form.ocrFilled')}
            </p>
          )}
        </SectionCard>

        {!!pendingItems.length && <section className="rounded-xl border border-line p-3 dark:border-dusk-line">
          <p className="text-sm">{t('invoice.existingItemsKept')}</p>
          <GhostButton type="button" onClick={() => {
            setItems((prev) => [...prev.filter((i) => i.name.trim()), ...pendingItems])
            setPendingItems([])
          }}>{t('invoice.appendItems', { count: pendingItems.length })}</GhostButton>
          <GhostButton type="button" onClick={() => setPendingItems([])}>{t('common.cancel')}</GhostButton>
        </section>}

        {/* Section B: 手動輸入 — one empty item row by default; user appends rows */}
        <DisclosureCard title={t('form.manualEntry')} icon={<Pencil className="h-4 w-4" strokeWidth={1.8} />} defaultOpen>
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg bg-paper p-2.5 ring-1 ring-line dark:bg-dusk dark:ring-dusk-line">
                <div className="flex items-center gap-2">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
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
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    value={item.qty ?? ''}
                    onChange={(e) => updateItem(item.id, { qty: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={t('form.qty')}
                    inputMode="decimal"
                    aria-label={t('form.qty')}
                    className={`${fieldClass} min-h-10 text-sm`}
                  />
                  <input
                    value={item.unitPrice ?? ''}
                    onChange={(e) => updateItem(item.id, { unitPrice: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={t('form.unitPrice')}
                    inputMode="decimal"
                    aria-label={t('form.unitPrice')}
                    className={`${fieldClass} min-h-10 text-sm`}
                  />
                  <input
                    value={item.originalPrice ?? ''}
                    onChange={(e) => updateItem(item.id, { originalPrice: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder={t('form.originalPrice')}
                    inputMode="decimal"
                    aria-label={`${t('form.originalPrice')}（${t('common.optional')}）`}
                    className={`${fieldClass} min-h-10 text-sm`}
                  />
                  <input
                    value={item.barcode ?? ''}
                    onChange={(e) => updateItem(item.id, { barcode: e.target.value || undefined })}
                    placeholder={t('form.barcode')}
                    inputMode="numeric"
                    aria-label={t('form.barcode')}
                    className={`${fieldClass} min-h-10 text-sm`}
                  />
                </div>
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer content-center text-sm">{t('invoice.itemDetails')}</summary>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={t('invoice.fields.unit')}><input value={item.unit ?? ''} onChange={(e) => updateItem(item.id, { unit: e.target.value || undefined })} className={fieldClass} /></Field>
                    <Field label={t('invoice.fields.lineTotal')}><input inputMode="decimal" value={item.lineTotal ?? ''} onChange={(e) => updateItem(item.id, { lineTotal: e.target.value || undefined })} className={fieldClass} /></Field>
                    <Field label={t('invoice.fields.sku')}><input value={item.sku ?? ''} onChange={(e) => updateItem(item.id, { sku: e.target.value || undefined })} className={fieldClass} /></Field>
                    <Field label={t('invoice.fields.lineKind')}><select value={item.lineKind ?? 'purchase'} onChange={(e) => updateItem(item.id, { lineKind: e.target.value as RecordItem['lineKind'] })} className={fieldClass}>
                      {['purchase', 'gift', 'adjustment', 'return', 'other'].map((kind) => <option key={kind} value={kind}>{t(`invoice.kinds.${kind}`)}</option>)}
                    </select></Field>
                  </div>
                  {item.rawText && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.rawText}</p>}
                </details>
              </div>
            ))}
            <GhostButton type="button" onClick={() => setItems((p) => [...p, { id: uid(), name: '' }])} className="w-full">
              {t('form.addItem')}
            </GhostButton>
          </div>
        </DisclosureCard>

        {/* Title (only required field) */}
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

        {/* Price + currency */}
        <div className="flex gap-3">
          <Field label={t('form.price')} className="min-w-0 flex-1">
            <input
              value={price}
              onChange={(e) => {
                setPrice(e.target.value)
                priceTouched.current = true
              }}
              inputMode="decimal"
              placeholder={autoTotal !== undefined ? String(autoTotal) : undefined}
              className={fieldClass}
            />
          </Field>
          <Field label={t('form.currency')} className="min-w-0 flex-1">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={fieldClass}>
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              {!isCommonCurrency(currency) && currency && (
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

        {/* Date + merchant */}
        <div className="flex gap-3">
          <Field label={t('form.date')} className="min-w-0 flex-1">
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); dateTouched.current = true }} className={fieldClass} />
          </Field>
          <Field label={t('form.merchant')} className="min-w-0 flex-1">
            <input value={merchant} onChange={(e) => setMerchant(e.target.value)} className={fieldClass} />
          </Field>
        </div>

        <DisclosureCard title={t('invoice.tab')}>
          <div className="space-y-3">
            <Field label={t('invoice.fields.invoiceNumber')}><input value={invoice?.invoiceNumber ?? ''} onChange={(e) => setInvoice((prev) => ({ ...prev, invoiceNumber: e.target.value }))} className={fieldClass} /></Field>
            <Field label={t('invoice.transcript')}><textarea rows={5} value={invoice?.transcript ?? ''} onChange={(e) => setInvoice((prev) => ({ ...prev, transcript: e.target.value }))} className={fieldClass} /></Field>
            {invoice && <InvoiceView record={{ id: 'draft', title, items, invoice, currency, tags, favorite: false, status: 'active', createdAt: 0, updatedAt: 0 }} />}
          </div>
        </DisclosureCard>
        <InvoiceReview record={{ invoice, items, currency }} />

        {/* Reason chips stay in the main flow — it is the soul of a journal entry */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-soft dark:text-dusk-soft">
            {t('form.reason')}
          </span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('form.reason')}>
            {SAVE_REASONS.map((r) => (
              <Chip key={r} active={saveReason === r}
                onClick={() => setSaveReason(saveReason === r ? undefined : r)}>
                {t(`reasons.${r}`)}
              </Chip>
            ))}
          </div>
        </div>

        {/* Progressive disclosure: secondary detail groups */}
        <DisclosureCard title={t('form.moreDetails')} icon={<IconSparkle className="h-4 w-4" strokeWidth={1.8} />}>
          <div className="space-y-5">
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
            <Field label={t('form.note')}>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('form.notePlaceholder')}
                rows={3}
                className={`${fieldClass} resize-y`}
              />
            </Field>
          </div>
        </DisclosureCard>
      </div>

      {/* Sticky thumb-zone save — the primary action lives where thumbs are */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-20 -mx-4 mt-4 border-t border-line/60 bg-paper/90 px-4 py-3 backdrop-blur-xl dark:border-dusk-line/60 dark:bg-dusk/90">
        <PrimaryButton onClick={onSave} disabled={saving} className="min-h-12 w-full text-base">
          {saving ? t('form.saving') : t('common.save')}
        </PrimaryButton>
      </div>

      {scanning && <BarcodeScanner onResult={(code) => void onScanResult(code)} onClose={() => setScanning(false)} />}
    </div>
  )
}
