import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { createOpenAiCompatibleProvider, describeOcrError } from '../src/lib/ocr'
import type { OcrConfig } from '../src/db/types'

/**
 * Feedback loop for the "辨識失敗" bug: drives the real extract() code path
 * against a local OpenAI-compatible endpoint playing back the response
 * shapes real servers return.
 */

let server: http.Server
let baseUrl = ''
let handler: http.RequestListener = () => {}
const seenBodies: string[] = []

function chatReply(content: string, status = 200, contentType = 'application/json') {
  return (req: http.IncomingMessage, res: http.ServerResponse) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      seenBodies.push(raw)
      res.writeHead(status, { 'content-type': contentType })
      res.end(
        status === 200
          ? JSON.stringify({ choices: [{ message: { content } }] })
          : JSON.stringify({ error: { message: 'unsupported parameter: response_format' } }),
      )
    })
  }
}

const receipt = {
  merchant: '全家',
  date: '2026-09-01',
  total: 195,
  currency: 'TWD',
  items: [{ name: '咖啡', qty: 1, unitPrice: 60 }],
}

async function extract(baseUrlOverride?: string) {
  const config: OcrConfig = {
    baseUrl: baseUrlOverride ?? baseUrl,
    apiKey: 'test-key',
    model: 'vision-model',
  }
  // setup.ts swaps globalThis.Blob for Node's Blob (fake-indexeddb needs
  // arrayBuffer), but jsdom's FileReader only accepts jsdom Blobs — the
  // browser app always uses native Blobs, so mirror that here.
  const JsdumBlob = (globalThis as { window: { Blob: typeof Blob } }).window.Blob
  return createOpenAiCompatibleProvider().extract({
    image: new JsdumBlob(['fake-image-bytes'], { type: 'image/png' }),
    config,
  })
}

beforeAll(async () => {
  server = http.createServer((req, res) => handler(req, res))
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      baseUrl = `http://127.0.0.1:${port}/v1`
      resolve()
    })
  })
})

afterEach(() => {
  seenBodies.length = 0
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

describe('openai-compatible OCR provider (real-world endpoint shapes)', () => {
  it('parses a clean JSON reply', async () => {
    handler = chatReply(JSON.stringify(receipt))
    await expect(extract()).resolves.toMatchObject({ merchant: '全家', total: 195 })
  })

  it('parses JSON wrapped in markdown fences (common model habit)', async () => {
    handler = chatReply('```json\n' + JSON.stringify(receipt) + '\n```')
    await expect(extract()).resolves.toMatchObject({ merchant: '全家', total: 195 })
  })

  it('parses JSON embedded in prose (model ignores "JSON only" prompt)', async () => {
    handler = chatReply('Here is the extracted data:\n' + JSON.stringify(receipt) + '\nHope this helps!')
    await expect(extract()).resolves.toMatchObject({ merchant: '全家' })
  })

  it('retries without response_format when the endpoint rejects it (400)', async () => {
    handler = (req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        seenBodies.push(raw)
        if (raw.includes('"response_format"')) {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: { message: 'response_format is not supported' } }))
        } else {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(receipt) } }] }))
        }
      })
    }
    await expect(extract()).resolves.toMatchObject({ total: 195 })
    expect(seenBodies).toHaveLength(2)
    expect(JSON.parse(seenBodies[1]).response_format).toBeUndefined()
  })

  it('includes the server error description on 401 (OpenAI-style body)', async () => {
    handler = (_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'invalid api key' } }))
    }
    await expect(extract()).rejects.toThrow(/401.*invalid api key/)
  })

  it('includes the server error description on 401 (gateway-style body)', async () => {
    handler = (_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ type: 'error', error: { type: 'AuthError', message: 'Invalid API key.' } }))
    }
    await expect(extract()).rejects.toThrow(/401.*Invalid API key/)
  })

  it('extracts <h1> from HTML error pages (404 double-path misconfig)', async () => {
    handler = (_req, res) => {
      res.writeHead(404, { 'content-type': 'text/html' })
      res.end('<html><body><h1>404 - Page Not Found</h1></body></html>')
    }
    await expect(extract()).rejects.toThrow(/404.*Page Not Found/)
  })

  it('accepts a full endpoint URL as Base URL (…/v1/chat/completions)', async () => {
    // Reproduces the user config: full endpoint pasted as Base URL. The
    // server only answers the correct single path — a double append 404s.
    handler = (req, res) => {
      if (req.url !== '/v1/chat/completions') {
        res.writeHead(404, { 'content-type': 'text/html' })
        res.end('<html><body><h1>404 - Page Not Found</h1></body></html>')
        return
      }
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        seenBodies.push(raw)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(receipt) } }] }))
      })
    }
    const origin = baseUrl.replace(/\/v1$/, '')
    await expect(extract(`${origin}/v1/chat/completions`)).resolves.toMatchObject({ total: 195 })
  })

  it('accepts a /responses endpoint URL as Base URL (gateway hosts both routes)', async () => {
    handler = (req, res) => {
      if (req.url !== '/v1/chat/completions') {
        res.writeHead(404, { 'content-type': 'text/html' })
        res.end('<html><body><h1>404 - Page Not Found</h1></body></html>')
        return
      }
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        seenBodies.push(raw)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(receipt) } }] }))
      })
    }
    const origin = baseUrl.replace(/\/v1$/, '')
    await expect(extract(`${origin}/v1/responses`)).resolves.toMatchObject({ total: 195 })
  })

  it('throws a specific error when a proxy returns a 200 HTML page', async () => {
    handler = chatReply('<html>login required</html>')
    await expect(extract()).rejects.toThrow(/ocr-unparseable-response/)
  })
})

describe('describeOcrError mapping', () => {
  it('maps Safari/Chrome network failures to the CORS/offline message', () => {
    expect(describeOcrError(new TypeError('Load failed')).key).toBe('form.ocrNetworkError')
    expect(describeOcrError(new TypeError('Failed to fetch')).key).toBe('form.ocrNetworkError')
  })

  it('keeps HTTP-level errors on the generic reason key', () => {
    const mapped = describeOcrError(new Error('ocr-failed:401: Invalid API key.'))
    expect(mapped.key).toBe('form.ocrFailedReason')
    expect(mapped.detail).toBe('ocr-failed:401: Invalid API key.')
  })
})
