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
  extract(input: { image: Blob; config: OcrConfig }): Promise<ParsedReceipt>
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('image-read-failed'))
    reader.readAsDataURL(blob)
  })
}

const PROMPT = `Extract receipt data from this image. Reply with ONLY a JSON object (no markdown) shaped as:
{"merchant": string|null, "date": "yyyy-mm-dd"|null, "total": number|null, "currency": string|null, "items": [{"name": string, "qty": number|null, "unitPrice": number|null}]|null}.
Omit keys you cannot determine. Currency should be an ISO 4217 code.`

export function createOpenAiCompatibleProvider(): OcrProvider {
  return {
    name: 'openai-compatible',
    async extract({ image, config }): Promise<ParsedReceipt> {
      const baseUrl = config.baseUrl.replace(/\/+$/, '')
      if (!baseUrl || !config.model) throw new Error('ocr-not-configured')
      const dataUrl = await blobToDataUrl(image)
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: PROMPT },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
          response_format: { type: 'json_object' },
        }),
      })
      if (!res.ok) throw new Error(`ocr-failed:${res.status}`)
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('ocr-empty-response')
      const parsed = JSON.parse(content) as ParsedReceipt
      return sanitizeReceipt(parsed)
    },
  }
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
