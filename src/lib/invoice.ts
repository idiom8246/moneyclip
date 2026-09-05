import type { InvoiceDetails, InvoiceEntry, InvoiceSource, JsonValue } from '../db/invoice'
import type { ConsumptionRecord, RecordItem } from '../db/types'
import { decimal, decimalDivide, decimalMultiply, decimalNegate, decimalSum } from './decimal'

export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Only plain, finite JSON enters persisted extensions. Never recover masked identifiers. */
function jsonValue(value: unknown, depth = 0): JsonValue | undefined {
  if (depth > 20) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (Array.isArray(value)) return value.map((v) => jsonValue(v, depth + 1)).filter((v): v is JsonValue => v !== undefined)
  if (isObject(value)) return Object.fromEntries(Object.entries(value)
    .filter(([k]) => !['__proto__', 'constructor', 'prototype'].includes(k))
    .map(([k, v]) => [k, jsonValue(v, depth + 1)])
    .filter(([, v]) => v !== undefined)) as { [key: string]: JsonValue }
  return undefined
}

const stringFields = ['transcript', 'invoiceNumber', 'country', 'dateRaw', 'time', 'copyType'] as const
const entryFields = ['merchantDetails', 'currencyEvidence', 'regional', 'policies', 'extra'] as const
const arrayFields = ['payments', 'adjustments', 'taxBreakdown', 'loyalty', 'coupons', 'rebates', 'sections'] as const

export function sanitizeInvoice(raw: unknown): InvoiceDetails | undefined {
  if (!isObject(raw)) return undefined
  const out: InvoiceDetails = { schemaVersion: 1 }
  for (const key of stringFields) if (typeof raw[key] === 'string') out[key] = raw[key]
  for (const key of ['documentTypes', 'languages'] as const) {
    if (Array.isArray(raw[key])) out[key] = raw[key].filter((v): v is string => typeof v === 'string')
  }
  for (const key of entryFields) if (isObject(raw[key])) out[key] = jsonValue(raw[key]) as InvoiceEntry
  for (const key of arrayFields) {
    if (Array.isArray(raw[key])) {
      // These extensible entries are also displayed generically; arithmetic guards every field.
      out[key] = raw[key].filter(isObject).map((v) => jsonValue(v) as InvoiceEntry)
    }
  }
  if (isObject(raw.totals)) {
    out.totals = {}
    for (const key of ['subtotal', 'payable', 'discounts', 'savings', 'rounding', 'tax', 'change', 'itemCount'] as const) {
      const value = decimal(raw.totals[key])
      if (value !== undefined) out.totals[key] = value
    }
  }
  if (isObject(raw.completeness)) out.completeness = Object.fromEntries(
    ['items', 'payments', 'adjustments'].filter((k) => typeof raw.completeness === 'object' && typeof (raw.completeness as Record<string, unknown>)[k] === 'boolean')
      .map((k) => [k, (raw.completeness as Record<string, unknown>)[k]]),
  )
  if (Array.isArray(raw.sources)) out.sources = raw.sources.filter(isObject)
    .filter((v) => typeof v.rawResponse === 'string').map((v) => ({
      rawResponse: v.rawResponse as string,
      ...(typeof v.id === 'string' ? { id: v.id } : {}),
      ...(typeof v.attachmentId === 'string' ? { attachmentId: v.attachmentId } : {}),
      ...(typeof v.provider === 'string' ? { provider: v.provider } : {}),
      ...(typeof v.model === 'string' ? { model: v.model } : {}),
      ...(typeof v.extractedAt === 'number' && Number.isFinite(v.extractedAt) ? { extractedAt: v.extractedAt } : {}),
    }))
  if (Array.isArray(raw.evidence)) out.evidence = raw.evidence.filter(isObject)
    .filter((v) => typeof v.path === 'string' && typeof v.raw === 'string')
    .map((v) => jsonValue(v) as unknown as NonNullable<InvoiceDetails['evidence']>[number])
  const known = new Set<string>([...stringFields, ...entryFields, ...arrayFields, 'schemaVersion', 'documentTypes', 'languages', 'totals', 'completeness', 'sources', 'evidence'])
  const extra = Object.fromEntries(Object.entries(raw).filter(([k]) => !known.has(k)))
  if (Object.keys(extra).length) out.extra = { ...out.extra, ...jsonValue(extra) as InvoiceEntry }
  return out
}

export function sanitizeItemDetails(raw: Record<string, unknown>): Partial<RecordItem> {
  const out: Partial<RecordItem> = {}
  for (const key of ['rawName', 'rawText', 'sourceId', 'sourceLineId', 'sku', 'barcode', 'barcodeScope', 'unit', 'priceUnit', 'taxMarker'] as const) {
    if (typeof raw[key] === 'string') out[key] = raw[key]
  }
  for (const key of ['lineTotal', 'listLineTotal', 'quantityText', 'priceQuantity'] as const) {
    const value = decimal(raw[key])
    if (value !== undefined) out[key] = value
  }
  if (['purchase', 'gift', 'adjustment', 'return', 'other'].includes(String(raw.lineKind))) out.lineKind = raw.lineKind as RecordItem['lineKind']
  if (['printed_unit', 'after_line_discounts', 'after_allocated_discounts', 'unknown'].includes(String(raw.priceBasis))) out.priceBasis = raw.priceBasis as RecordItem['priceBasis']
  if (Array.isArray(raw.identifiers)) out.identifiers = raw.identifiers.filter(isObject)
    .filter((v) => typeof v.value === 'string' && ['gtin', 'store_sku', 'restricted', 'other'].includes(String(v.kind)))
    .map((v) => ({ kind: v.kind as 'gtin', value: v.value as string, ...(typeof v.scope === 'string' ? { scope: v.scope } : {}) }))
  if (isObject(raw.extra)) out.extra = jsonValue(raw.extra) as InvoiceEntry
  if (Array.isArray(raw.evidence)) out.evidence = sanitizeInvoice({ evidence: raw.evidence })?.evidence
  return out
}

export function isPurchaseItem(item: RecordItem): boolean {
  return (!item.lineKind || item.lineKind === 'purchase' || item.lineKind === 'gift') &&
    (decimal(item.lineTotal) === undefined || Number(item.lineTotal) >= 0)
}

export function itemLineTotal(item: RecordItem): string | undefined {
  const printed = decimal(item.lineTotal)
  if (printed !== undefined) return printed
  const price = decimal(item.unitPrice)
  const qty = decimal(item.quantityText) ?? decimal(item.qty ?? 1)
  if (price === undefined || qty === undefined) return undefined
  if (item.priceUnit && item.unit && item.priceUnit !== item.unit) return undefined
  const total = decimalMultiply(price, qty)
  return item.priceQuantity ? decimalDivide(total, decimal(item.priceQuantity) ?? '0') : total
}

export function itemUnitPrice(item: RecordItem): number | undefined {
  if (!isPurchaseItem(item) || item.priceBasis === 'unknown') return undefined
  const total = decimal(item.lineTotal)
  const qty = decimal(item.quantityText) ?? decimal(item.qty)
  if (total !== undefined && qty !== undefined && Number(qty) > 0) return Number(decimalDivide(total, qty))
  if (total !== undefined) return undefined
  if (item.priceUnit && item.unit && item.priceUnit !== item.unit) return undefined
  const price = decimal(item.unitPrice)
  if (price === undefined) return undefined
  const derived = item.priceQuantity ? decimalDivide(price, decimal(item.priceQuantity) ?? '0') : price
  return derived === undefined ? undefined : Number(derived)
}

export function isRestrictedBarcode(code?: string): boolean {
  return !!code && /^(?:2\d{12}|02\d{11})$/.test(code)
}

/** One product identity for all views; unscoped local numbers fall back to the item name. */
export function productKey(item: RecordItem): string {
  const unit = item.unit?.trim().toLowerCase()
  const unitSuffix = unit && !['pc', 'pcs', 'piece', 'each'].includes(unit) ? `|unit:${unit}` : ''
  let key: string
  if (item.barcode && !isRestrictedBarcode(item.barcode) && !item.barcodeScope) key = `bc:${item.barcode}`
  else if ((item.sku || item.barcode) && item.barcodeScope) key = `local:${JSON.stringify([item.barcodeScope, item.sku ?? item.barcode])}`
  else key = `n:${item.name.trim().toLowerCase().replace(/\s+/g, ' ')}`
  return key + unitSuffix
}

export interface InvoiceIssue { code: 'payments' | 'lines' | 'unallocated' | 'incomplete'; expected?: string; actual?: string }

/** Evidence checks only: never infer an eligible subset or replace a printed total. */
export function invoiceIssues(record: Pick<ConsumptionRecord, 'invoice' | 'items' | 'currency'>): InvoiceIssue[] {
  const invoice = record.invoice
  if (!invoice) return []
  const issues: InvoiceIssue[] = []
  const payable = decimal(invoice.totals?.payable)
  const payments = invoice.payments ?? []
  if (payable !== undefined && invoice.completeness?.payments && payments.length &&
    payments.every((p) => decimal(p.amount) !== undefined && (!p.currency || p.currency === record.currency))) {
    const sum = decimalSum([...payments.map((p) => decimal(p.amount)!), decimalNegate(decimal(invoice.totals?.change) ?? '0')])
    if (Number(decimalSum([sum, decimalNegate(payable)])) !== 0) issues.push({ code: 'payments', expected: payable, actual: sum })
  }
  const adjustments = invoice.adjustments ?? []
  if (adjustments.some((a) => a.scope === 'receipt' && (!Array.isArray(a.itemIds) || !a.itemIds.length))) issues.push({ code: 'unallocated' })
  const items = record.items ?? []
  if (payable !== undefined && invoice.completeness?.items && invoice.completeness?.adjustments && items.length &&
    items.every((i) => decimal(i.lineTotal) !== undefined) &&
    adjustments.every((a) => a.includedInLineTotal === true || decimal(a.amount) !== undefined)) {
    const sum = decimalSum([...items.map((i) => i.lineTotal!),
      ...adjustments.filter((a) => a.includedInLineTotal !== true).map((a) => decimal(a.amount)!),
      decimal(invoice.totals?.rounding) ?? '0'])
    if (Number(decimalSum([sum, decimalNegate(payable)])) !== 0) issues.push({ code: 'lines', expected: payable, actual: sum })
  }
  return issues
}

/** Search values, not JSON keys or provider implementation details. */
export function invoiceSearchText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(invoiceSearchText).join(' ')
  if (isObject(value)) return Object.entries(value).filter(([k]) => !['sources', 'rawResponse'].includes(k)).map(([, v]) => invoiceSearchText(v)).join(' ')
  return ''
}

/** Preserve previous observations and fill gaps; raw source responses retain all conflicts. */
export function mergeInvoiceEvidence(previous: InvoiceDetails | undefined, incoming: InvoiceDetails | undefined,
  source: Pick<InvoiceSource, 'id' | 'attachmentId'>): InvoiceDetails {
  const next = sanitizeInvoice(incoming) ?? { schemaVersion: 1 as const }
  const merged: InvoiceDetails = { ...next, ...previous }
  for (const key of [...entryFields, 'totals'] as const) {
    if (previous?.[key] || next[key]) merged[key] = { ...next[key], ...previous?.[key] }
  }
  for (const key of arrayFields) {
    if (previous?.[key] || next[key]) {
      // Multiset union: preserve repeated rows within one observation, while
      // matching equivalent rows across observations regardless of key order.
      const entries = [...previous?.[key] ?? []]
      const identityOf = (entry: InvoiceEntry) => canonicalJson(key === 'adjustments' && Array.isArray(entry.sourceItemIds)
        ? { ...entry, itemIds: entry.sourceItemIds } : entry)
      const counts = new Map<string, number>()
      for (const entry of entries) {
        const identity = identityOf(entry)
        counts.set(identity, (counts.get(identity) ?? 0) + 1)
      }
      for (const entry of next[key] ?? []) {
        const identity = identityOf(entry)
        const count = counts.get(identity) ?? 0
        if (count) counts.set(identity, count - 1)
        else entries.push(entry)
      }
      merged[key] = entries
    }
  }
  for (const key of ['documentTypes', 'languages'] as const) {
    if (previous?.[key] || next[key]) merged[key] = [...new Set([...previous?.[key] ?? [], ...next[key] ?? []])]
  }
  const texts = [previous?.transcript, next.transcript].filter((v): v is string => !!v)
  if (texts.length) merged.transcript = [...new Set(texts)].join('\n\n')
  merged.sources = [...previous?.sources ?? [], ...(next.sources ?? []).map((s) => ({ ...s, ...source }))]
  merged.evidence = [...previous?.evidence ?? [], ...(next.evidence ?? []).map((e) => ({ ...e, sourceId: source.id }))]
  // Combining pages/observations may contain overlap. Do not assert a reconciled full invoice.
  if (previous) merged.completeness = { items: false, payments: false, adjustments: false }
  return merged
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isObject(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

/** Bind only unambiguous references from this extraction; retain printed refs for review. */
export function bindInvoiceItems(invoice: InvoiceDetails | undefined, items: RecordItem[]): InvoiceDetails | undefined {
  if (!invoice) return undefined
  return { ...invoice, adjustments: invoice.adjustments?.map((adjustment) => ({
    ...adjustment,
    sourceItemIds: adjustment.itemIds,
    itemIds: Array.isArray(adjustment.itemIds) ? adjustment.itemIds.flatMap((ref) => {
      const matches = items.filter((item) => item.sourceLineId === ref)
      return matches.length === 1 ? [matches[0].id] : []
    }) : undefined,
  })) }
}
