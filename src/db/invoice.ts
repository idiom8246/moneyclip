/** Decimal strings preserve printed precision/signs; no binary floating-point reconciliation. */
export type Decimal = string
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export interface InvoiceEntry { [key: string]: JsonValue | undefined }

export interface FieldEvidence {
  path: string
  raw: string
  sourceId?: string
  method?: 'printed' | 'inferred' | 'derived' | 'user'
  confidence?: number
}

export interface InvoiceSource {
  id?: string
  attachmentId?: string
  extractedAt?: number
  provider?: string
  model?: string
  rawResponse: string
}

export interface InvoiceAdjustment extends InvoiceEntry {
  id?: string
  kind?: string
  label?: string
  /** Signed change to amount due. Preserve the original label/sign in rawText. */
  amount?: Decimal
  scope?: 'line' | 'group' | 'receipt'
  itemIds?: string[]
  /** Already reflected in the associated lineTotal: never subtract again. */
  includedInLineTotal?: boolean
}

export interface InvoicePayment extends InvoiceEntry {
  method?: string
  brand?: string
  network?: string
  amount?: Decimal
  currency?: string
  instrument?: string
  balanceAfter?: Decimal
}

/** Embedded in records. Items exist only in ConsumptionRecord.items. */
export interface InvoiceDetails {
  schemaVersion?: 1
  transcript?: string
  documentTypes?: string[]
  invoiceNumber?: string
  country?: string
  languages?: string[]
  dateRaw?: string
  time?: string
  copyType?: string
  merchantDetails?: InvoiceEntry
  currencyEvidence?: InvoiceEntry
  regional?: InvoiceEntry
  totals?: Partial<Record<'subtotal' | 'payable' | 'discounts' | 'savings' | 'rounding' | 'tax' | 'change' | 'itemCount', Decimal>>
  payments?: InvoicePayment[]
  adjustments?: InvoiceAdjustment[]
  taxBreakdown?: InvoiceEntry[]
  loyalty?: InvoiceEntry[]
  coupons?: InvoiceEntry[]
  rebates?: InvoiceEntry[]
  sections?: InvoiceEntry[]
  policies?: InvoiceEntry
  /** Explicit completeness is required for reconciliation, never assumed from a short list. */
  completeness?: { items?: boolean; payments?: boolean; adjustments?: boolean }
  evidence?: FieldEvidence[]
  sources?: InvoiceSource[]
  extra?: InvoiceEntry
}

export interface ItemIdentifier {
  kind: 'gtin' | 'store_sku' | 'restricted' | 'other'
  value: string
  scope?: string
}

export interface InvoiceItemDetails {
  /** Extraction-local reference; never used as the canonical database item ID. */
  sourceLineId?: string
  rawName?: string
  rawText?: string
  sourceId?: string
  sku?: string
  barcodeScope?: string
  identifiers?: ItemIdentifier[]
  quantityText?: Decimal
  unit?: string
  /** The unitPrice is quoted per priceQuantity of priceUnit (e.g. 100 g). */
  priceQuantity?: Decimal
  priceUnit?: string
  /** Printed amount after line discounts, before any unallocated receipt adjustment. */
  lineTotal?: Decimal
  listLineTotal?: Decimal
  lineKind?: 'purchase' | 'gift' | 'adjustment' | 'return' | 'other'
  priceBasis?: 'printed_unit' | 'after_line_discounts' | 'after_allocated_discounts' | 'unknown'
  taxMarker?: string
  evidence?: FieldEvidence[]
  extra?: InvoiceEntry
}
