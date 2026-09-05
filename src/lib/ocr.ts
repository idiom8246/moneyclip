import type { OcrConfig, RecordItem } from '../db/types'
import type { InvoiceDetails } from '../db/invoice'
import { isObject, sanitizeInvoice, sanitizeItemDetails } from './invoice'

/**
 * Pluggable OCR (spec §3). Default implementation targets any
 * OpenAI-compatible chat-completions endpoint with vision support.
 *
 * OCR results are ONLY ever returned to the form for user confirmation —
 * nothing here writes to the database.
 */

export interface ParsedReceipt {
  merchant?: string
  /** ISO yyyy-mm-dd */
  date?: string
  total?: number
  currency?: string
  items?: Array<Omit<RecordItem, 'id'>>
  invoice?: InvoiceDetails
}

export interface OcrProvider {
  readonly name: string
  extract(input: { image: Blob; config: OcrConfig; signal?: AbortSignal }): Promise<ParsedReceipt>
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  // 32k chunks avoid blowing the call stack on multi-MB photos.
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  // Blob.arrayBuffer() works everywhere FileReader did, without its
  // realm-sensitive quirks.
  return `data:${blob.type || 'application/octet-stream'};base64,${toBase64(await blob.arrayBuffer())}`
}

const PROMPT = `Transcribe and extract the ENTIRE receipt image including header, every line, payment blocks, footers, policies, coupons and loyalty. Reply with ONLY one JSON object:
{"merchant":string,"date":"yyyy-mm-dd","total":number,"currency":"ISO4217","items":[{"name":string,"rawName":string,"rawText":string,"qty":number,"quantityText":"decimal","unit":string,"unitPrice":number,"originalPrice":number,"lineTotal":"signed decimal","listLineTotal":"decimal","priceQuantity":"decimal","priceUnit":string,"priceBasis":"printed_unit|after_line_discounts|after_allocated_discounts|unknown","lineKind":"purchase|gift|adjustment|return|other","sku":string,"barcode":string,"barcodeScope":string,"taxMarker":string,"extra":{}}],"invoice":{"transcript":"complete text as printed, with line breaks","documentTypes":[string],"invoiceNumber":string,"country":string,"languages":[string],"dateRaw":string,"time":string,"copyType":string,"merchantDetails":{},"currencyEvidence":{"code":string,"source":"explicit_code|inferred|unknown","raw":string,"section":string},"regional":{},"totals":{"subtotal":"decimal","payable":"decimal","discounts":"signed decimal as printed","savings":"decimal","rounding":"signed decimal","tax":"decimal","change":"decimal","itemCount":"decimal"},"payments":[{"method":string,"brand":string,"network":string,"amount":"decimal","currency":string,"instrument":"as printed","balanceAfter":"decimal","gateway":{}}],"adjustments":[{"label":string,"rawText":string,"kind":string,"amount":"signed change to payable","scope":"line|group|receipt","includedInLineTotal":boolean,"scheme":{},"eligibleSubsetNote":string}],"taxBreakdown":[{}],"loyalty":[{}],"coupons":[{}],"rebates":[{}],"sections":[{}],"policies":{},"evidence":[{"path":string,"raw":string,"method":"printed|inferred|derived"}],"completeness":{"items":boolean,"payments":boolean,"adjustments":boolean},"extra":{}}}.
Omit unknown fields; never invent values, missing digits, dates or tax. Preserve masks, leading zeros, zero amounts and printed signs. Keep all additional fields in the relevant object/extra, including local invoice IDs, ROC date periods, payment references, points/stamps, expiry and return terms. A period is not a transaction date. Currency may appear in a payment block but may differ from purchase currency; record its scope. A symbol such as ¥ is ambiguous. Never infer tax from country alone.
Assign each item a unique sourceLineId string (e.g. L1). When printed evidence links an adjustment to specific items, put those sourceLineId strings in that adjustment's itemIds array; otherwise omit itemIds.
lineTotal is the printed amount AFTER line discounts, not a list amount; omit it if that basis is unknown. unitPrice and originalPrice are PER-UNIT printed prices; never put a line total there. Keep pricing basis (148 per 100 g) separate from purchased quantity. Do not derive weight from barcodes. Never allocate receipt discounts to items without printed evidence. Do not subtract discounts already included in lineTotal. Record each adjustment once: either a signed adjustment item OR invoice.adjustments, never both. A zero-priced physical gift is a gift item; a negative FREE discount is an adjustment, not another product. Issued coupons, rebates and loyalty ads are not purchased items. Payments and rounding are not discounts. Mark completeness true only when every relevant value and its amount basis is readable; otherwise false. Preserve discrepancies for review; do not repair totals.`

export function createOpenAiCompatibleProvider(): OcrProvider {
  return {
    name: 'openai-compatible',
    async extract({ image, config, signal }): Promise<ParsedReceipt> {
      const baseUrl = normalizeBaseUrl(config.baseUrl)
      if (!baseUrl || !config.model) throw new Error('ocr-not-configured')
      const dataUrl = await blobToDataUrl(image)
      const messages = [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: PROMPT },
            { type: 'image_url' as const, image_url: { url: dataUrl } },
          ],
        },
      ]
      // Many OpenAI-compatible servers (Ollama, LM Studio, vLLM, proxies)
      // reject response_format with 400 — retry once without it.
      let res = await chatRequest(baseUrl, config, messages, true, signal)
      if (res.status === 400 && !signal?.aborted) {
        res = await chatRequest(baseUrl, config, messages, false, signal)
      }
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (!res.ok) {
        const detail = await responseErrorDetail(res)
        throw new Error(`ocr-failed:${res.status}${detail ? `: ${detail}` : ''}`)
      }
      const data = (await res.json().catch(() => {
        throw new Error('ocr-unparseable-response')
      })) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('ocr-empty-response')
      const parsed = parseReceiptContent(content)
      const receipt = sanitizeReceipt(parsed)
      if (receipt.invoice?.sources) receipt.invoice.sources = receipt.invoice.sources.map((s) => ({
        ...s, extractedAt: Date.now(), provider: 'openai-compatible', model: config.model,
      }))
      return receipt
    },
  }
}

/**
 * Users routinely paste the full endpoint URL (…/v1/chat/completions or
 * …/v1/responses) instead of the base — accept both by stripping the
 * endpoint suffix, then always append /chat/completions.
 */
export function normalizeBaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/, '')
    .replace(/\/responses$/, '')
}

/**
 * Pull the server's own explanation out of an error response so the toast
 * can show WHY it failed — covers OpenAI-style {error:{message}} and
 * gateway variants like {"type":"error","error":{...}}; falls back to a
 * stripped-text snippet for HTML error pages.
 */
async function responseErrorDetail(res: Response): Promise<string> {
  try {
    const text = (await res.text()).trim()
    if (!text) return ''
    try {
      const data = JSON.parse(text) as { error?: { message?: string } | string }
      const msg = typeof data.error === 'string' ? data.error : data.error?.message
      if (msg) return msg.replace(/\s+/g, ' ').slice(0, 120)
    } catch {
      // not JSON — try the <h1> of an HTML error page
      const h1 = text.match(/<h1[^>]*>([^<]*)</)
      if (h1) return h1[1].replace(/\s+/g, ' ').trim().slice(0, 120)
    }
    return ''
  } catch {
    return ''
  }
}

async function chatRequest(
  baseUrl: string,
  config: OcrConfig,
  messages: unknown,
  withResponseFormat: boolean,
  signal?: AbortSignal,
): Promise<Response> {
  const body: Record<string, unknown> = { model: config.model, messages }
  if (withResponseFormat) body.response_format = { type: 'json_object' }
  return fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  })
}

/**
 * Map a thrown OCR error to an i18n key + detail. Network-level failures
 * (Safari "Load failed" / Chrome "Failed to fetch") almost always mean the
 * provider blocks browser (CORS) requests or the device is offline — say
 * that explicitly instead of showing the raw TypeError.
 */
export function describeOcrError(err: unknown): { key: string; detail: string } {
  const detail = (err instanceof Error ? err.message : String(err)).slice(0, 120)
  if (
    err instanceof TypeError ||
    /failed to fetch|load failed|networkerror|cancelled|aborted/i.test(detail)
  ) {
    return { key: 'form.ocrNetworkError', detail }
  }
  return { key: 'form.ocrFailedReason', detail }
}

/** Extract the receipt JSON from a model reply that ignores "JSON only". */
export function parseReceiptContent(content: string): ParsedReceipt {
  const retain = (value: unknown): ParsedReceipt => {
    if (!isObject(value)) throw new Error('ocr-unparseable-response')
    return { ...value, invoice: { ...sanitizeInvoice(value.invoice), sources: [{ rawResponse: content }] } } as ParsedReceipt
  }
  try {
    return retain(JSON.parse(content))
  } catch {
    // fall through to brace scan (markdown fences, prose wrappers, …)
  }
  const json = firstJsonObject(content)
  if (json) {
    try {
      return retain(JSON.parse(json))
    } catch {
      // fall through
    }
  }
  throw new Error('ocr-unparseable-response')
}

/** First balanced top-level {...} in `text`, string-literal aware. */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/** Drop malformed fields so bad OCR output can't poison the form. */
export function sanitizeReceipt(raw: ParsedReceipt): ParsedReceipt {
  const out: ParsedReceipt = {}
  if (!isObject(raw)) return out
  const invoice = sanitizeInvoice(raw.invoice)
  if (invoice) out.invoice = invoice
  if (typeof raw.merchant === 'string' && raw.merchant) out.merchant = raw.merchant
  if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) out.date = raw.date
  if (typeof raw.total === 'number' && Number.isFinite(raw.total) && raw.total >= 0) {
    out.total = raw.total
  }
  if (typeof raw.currency === 'string' && /^[A-Za-z]{3}$/.test(raw.currency)) {
    out.currency = raw.currency.toUpperCase()
  }
  if (Array.isArray(raw.items)) {
    const items = raw.items
      .filter((i) => i && typeof i.name === 'string' && i.name)
      .map((i) => ({
        name: i.name,
        ...sanitizeItemDetails(i as unknown as Record<string, unknown>),
        qty: typeof i.qty === 'number' && Number.isFinite(i.qty) && i.qty > 0 ? i.qty : undefined,
        unitPrice: typeof i.unitPrice === 'number' && Number.isFinite(i.unitPrice) && i.unitPrice >= 0 ? i.unitPrice : undefined,
        // Only a genuine discount counts — originalPrice below unitPrice is
        // noise, not a deal.
        originalPrice:
          typeof i.originalPrice === 'number' &&
          Number.isFinite(i.originalPrice) &&
          i.originalPrice > 0 &&
          typeof i.unitPrice === 'number' &&
          i.originalPrice > i.unitPrice
            ? i.originalPrice
            : undefined,
      }))
      .map(({ originalPrice, ...rest }) => ({ ...rest, ...(originalPrice !== undefined ? { originalPrice } : {}) }))
    if (items.length) out.items = items
  }
  return out
}
