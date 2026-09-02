import type { RecordItem, SaveReason } from '../db/types'

/**
 * Unsaved add-form draft (spec §6.2 spirit: never lose the user's work).
 * One row, key 'current'. Photos keep their staged blobs so a killed tab
 * restores everything, not just text.
 */
export interface FormDraft {
  title: string
  price: string
  currency: string
  date: string
  merchant: string
  saveReason?: SaveReason
  categoryId: string
  tags: string[]
  note: string
  items: RecordItem[]
  photos: Array<{ key: string; blob: Blob; thumbBlob: Blob }>
  updatedAt: number
}

export const DRAFT_KEY = 'current'

export async function saveFormDraft(
  draft: Omit<FormDraft, 'updatedAt'>,
  database: { drafts: { put: (row: FormDraft & { id: string }) => Promise<unknown> } },
): Promise<void> {
  await database.drafts.put({ id: DRAFT_KEY, ...draft, updatedAt: Date.now() })
}

export async function loadFormDraft(
  database: { drafts: { get: (key: string) => Promise<(FormDraft & { id: string }) | undefined> } },
): Promise<FormDraft | undefined> {
  const row = await database.drafts.get(DRAFT_KEY)
  if (!row) return undefined
  const { id: _id, ...draft } = row
  return draft
}

export async function clearFormDraft(database: {
  drafts: { delete: (key: string) => Promise<void> }
}): Promise<void> {
  await database.drafts.delete(DRAFT_KEY)
}

/** A draft is only worth restoring if the user actually entered something. */
export function isDraftMeaningful(draft: FormDraft): boolean {
  return Boolean(
    draft.title.trim() ||
      draft.merchant.trim() ||
      draft.note.trim() ||
      draft.price ||
      draft.photos.length > 0 ||
      draft.items.some((i) => i.name.trim() || i.barcode),
  )
}
