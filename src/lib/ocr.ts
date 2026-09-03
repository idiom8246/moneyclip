import type { OcrConfig } from '../db/types'

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
  items?: Array<{ name: string; qty?: number; unitPrice?: number }>
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

const PROMPT = `Extract receipt data from this image. Reply with ONLY a JSON object (no markdown) shaped as:
{"merchant": string|null, "date": "yyyy-mm-dd"|null, "total": number|null, "currency": string|null, "items": [{"name": string, "qty": number|null, "unitPrice": number|null}]|null}.
Omit keys you cannot determine. Currency should be an ISO 4217 code.`

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
      return sanitizeReceipt(parsed)
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
  try {
    return JSON.parse(content) as ParsedReceipt
  } catch {
    // fall through to brace scan (markdown fences, prose wrappers, …)
  }
  const json = firstJsonObject(content)
  if (json) {
    try {
      return JSON.parse(json) as ParsedReceipt
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
        qty: typeof i.qty === 'number' && i.qty > 0 ? i.qty : undefined,
        unitPrice: typeof i.unitPrice === 'number' && i.unitPrice >= 0 ? i.unitPrice : undefined,
      }))
    if (items.length) out.items = items
  }
  return out
}
