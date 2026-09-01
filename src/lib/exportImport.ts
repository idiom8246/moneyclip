import type {
  Attachment,
  Category,
  ConsumptionRecord,
} from '../db/types'
import type { MoneyclipDB } from '../db/db'

/**
 * Export / import per spec §5.6.
 * JSON: full fidelity (records incl. items/tags/note/saveReason, categories,
 * attachment metadata + optional base64 images).
 * CSV: flat fields; items serialized; category resolved to name.
 */

export interface ExportBundle {
  version: 1
  exportedAt: string
  records: ConsumptionRecord[]
  categories: Category[]
  attachments?: Array<Omit<Attachment, 'blob' | 'thumbBlob'> & { blobBase64?: string; thumbBase64?: string }>
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBlob(base64: string, type = 'image/jpeg'): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function exportJSON(
  db: MoneyclipDB,
  opts: { includeImages?: boolean } = {},
): Promise<ExportBundle> {
  const [records, categories, attachments] = await Promise.all([
    db.records.toArray(),
    db.categories.toArray(),
    db.attachments.toArray(),
  ])
  const bundle: ExportBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    records,
    categories,
  }
  if (opts.includeImages) {
    bundle.attachments = await Promise.all(
      attachments.map(async (a) => ({
        ...a,
        blobBase64: await blobToBase64(a.blob),
        thumbBase64: await blobToBase64(a.thumbBlob),
        blob: undefined as never,
        thumbBlob: undefined as never,
      })),
    )
  }
  return bundle
}

function csvEscape(value: unknown): string {
  const s = value === undefined || value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const CSV_HEADERS = [
  'title', 'price', 'currency', 'date', 'merchant', 'category',
  'tags', 'saveReason', 'favorite', 'status', 'note', 'items', 'createdAt',
]

export function exportCSV(
  records: ConsumptionRecord[],
  categories: Category[],
): string {
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const rows = records.map((r) =>
    [
      r.title,
      r.price,
      r.currency,
      r.date,
      r.merchant,
      r.categoryId ? (catName.get(r.categoryId) ?? '') : '',
      r.tags.join(';'),
      r.saveReason,
      r.favorite ? 'true' : 'false',
      r.status,
      r.note,
      r.items?.map((i) => `${i.name}${i.qty ? ` x${i.qty}` : ''}${i.unitPrice !== undefined ? ` @${i.unitPrice}` : ''}`).join('; '),
      new Date(r.createdAt).toISOString(),
    ]
      .map(csvEscape)
      .join(','),
  )
  return [CSV_HEADERS.join(','), ...rows].join('\n')
}

export function downloadTextFile(filename: string, text: string, mime = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface ImportResult {
  records: number
  categories: number
  errors: string[]
}

function isValidRecord(r: unknown): r is ConsumptionRecord {
  const o = r as ConsumptionRecord
  return !!o && typeof o.id === 'string' && typeof o.title === 'string' &&
    typeof o.createdAt === 'number' && typeof o.updatedAt === 'number' &&
    Array.isArray(o.tags)
}

/** Import a JSON bundle. Records with existing ids are overwritten (idempotent re-import). */
export async function importJSON(
  db: MoneyclipDB,
  bundle: ExportBundle,
): Promise<ImportResult> {
  if (!bundle || bundle.version !== 1 || !Array.isArray(bundle.records)) {
    throw new Error('invalid-export-bundle')
  }
  const errors: string[] = []
  const records = bundle.records.filter((r) => {
    const ok = isValidRecord(r)
    if (!ok) errors.push(`skipped invalid record: ${(r as { title?: string })?.title ?? '?'}`)
    return ok
  })
  const categories = (bundle.categories ?? []).filter(
    (c): c is Category => !!c && typeof c.id === 'string' && typeof c.name === 'string',
  )
  await db.transaction('rw', db.records, db.categories, db.attachments, async () => {
    await db.categories.bulkPut(categories)
    await db.records.bulkPut(records)
    if (bundle.attachments) {
      const restored = bundle.attachments
        .filter((a) => a.blobBase64 && a.thumbBase64 && a.recordId)
        .map((a) => ({
          id: a.id,
          recordId: a.recordId,
          createdAt: a.createdAt,
          blob: base64ToBlob(a.blobBase64!),
          thumbBlob: base64ToBlob(a.thumbBase64!),
        }))
      await db.attachments.bulkPut(restored)
    }
  })
  return { records: records.length, categories: categories.length, errors }
}
