import { describe, expect, it } from 'vitest'
import { sanitizeReceipt, parseReceiptContent } from '../src/lib/ocr'
import { itemsAutoTotal } from '../src/lib/records'
import { recordMatchesQuery } from '../src/lib/search'
import { itemKey, priceHistory } from '../src/lib/analytics'
import type { ConsumptionRecord } from '../src/db/types'
import { invoiceIssues, itemUnitPrice, itemLineTotal, mergeInvoiceEvidence, bindInvoiceItems } from '../src/lib/invoice'
import { exportJSON, importJSON } from '../src/lib/exportImport'
import { createRecord, addAttachment, updateRecord } from '../src/lib/records'
import { freshDb } from './helpers'

// Synthetic fixtures illustrating the supplied receipt descriptions, not verified OCR ground truth.
const record = (patch: Partial<ConsumptionRecord> = {}): ConsumptionRecord => ({
  id: 'receipt', title: 'Groceries', tags: [], favorite: false, status: 'active',
  createdAt: 1, updatedAt: 1, currency: 'HKD', ...patch,
})

describe('invoice evidence checks and backups', () => {
  it('flags the supplied 7-Eleven mismatch without rewriting printed amounts', () => {
    const rec = record({ items: [
      { id: 'a', name: 'Tea', lineTotal: '120.00' },
      { id: 'b', name: 'Coffee', lineTotal: '48.00' },
      { id: 'c', name: 'Ice cream', lineTotal: '99.00' },
    ], invoice: { totals: { payable: '189.60', discounts: '-170.40' },
      completeness: { items: true, adjustments: true },
      adjustments: [{ scope: 'receipt', amount: '-47.80' }],
    } })
    expect(invoiceIssues(rec)).toContainEqual({ code: 'lines', expected: '189.60', actual: '219.20' })
    expect(rec.invoice?.totals?.discounts).toBe('-170.40')
  })

  it('checks split tenders net of change, skips incomplete or mixed-currency payments', () => {
    const rec = record({ invoice: { totals: { payable: '98.91', change: '0.09' }, completeness: { payments: true },
      payments: [{ amount: '36.79' }, { amount: '62.21' }],
    } })
    expect(invoiceIssues(rec)).toEqual([])
    rec.invoice!.payments![1].amount = '62.12'
    expect(invoiceIssues(rec)).toContainEqual({ code: 'payments', expected: '98.91', actual: '98.82' })
    rec.invoice!.payments![1].currency = 'CNY'
    expect(invoiceIssues(rec)).toEqual([])
    rec.invoice!.completeness!.payments = false
    expect(invoiceIssues(rec)).toEqual([])
  })

  it('keeps per-100g quotes separate from the purchased quantity and price', () => {
    const weighed = { id: 'a', name: 'Beef', qty: 176, unit: 'g', unitPrice: 148, priceQuantity: '100', priceUnit: 'g' }
    expect(Number(itemLineTotal(weighed))).toBe(260.48)
    expect(itemUnitPrice(weighed)).toBe(1.48)
    expect(itemUnitPrice({ ...weighed, unit: 'kg' })).toBeUndefined()
    expect(itemUnitPrice({ ...weighed, lineTotal: '260.40' })).toBeCloseTo(1.47954545)
  })

  it('does not invent a unit price when quantity or the price basis is unknown', () => {
    expect(itemUnitPrice({ id: 'a', name: 'Tea', lineTotal: '120.00' })).toBeUndefined()
    expect(itemUnitPrice({ id: 'a', name: 'Tea', qty: 24, lineTotal: '120.00', priceBasis: 'unknown' })).toBeUndefined()
  })

  it('retains recognition history while combining pages conservatively', () => {
    const result = mergeInvoiceEvidence({ transcript: 'Page one', invoiceNumber: 'USER-CORRECTED',
      sources: [{ id: 'old', rawResponse: '{"first":1}' }], completeness: { payments: true },
    }, { transcript: 'Page two', invoiceNumber: 'OCR-GUESS', payments: [{ amount: '52.00', brand: 'AlipayHK' }],
      sources: [{ rawResponse: '{"second":2}' }],
    }, { id: 'new', attachmentId: 'photo-two' })
    expect(result.invoiceNumber).toBe('USER-CORRECTED')
    expect(result.transcript).toBe('Page one\n\nPage two')
    expect(result.sources?.[1]).toEqual({ id: 'new', attachmentId: 'photo-two', rawResponse: '{"second":2}' })
    expect(result.completeness?.payments).toBe(false)
  })

  it('round-trips full invoice evidence and original PNG bytes in the existing database', async () => {
    const db = await freshDb()
    const restored = await freshDb()
    try {
      const rec = await createRecord({ title: 'Invoice', invoice: { transcript: '會員 **90706', regional: { randomNumber: '0059' } },
        items: [{ id: 'line-a', name: 'Tea', qty: 2, unit: 'bottle', lineTotal: '10.00' }],
      }, db)
      await addAttachment(rec.id, new Blob(['original-png'], { type: 'image/png' }), new Blob(['thumb'], { type: 'image/jpeg' }), db)
      await updateRecord(rec.id, { title: 'Edited' }, db)
      const bundle = await exportJSON(db, { includeImages: true })
      await importJSON(restored, JSON.parse(JSON.stringify(bundle)))
      expect(await restored.records.count()).toBe(1)
      expect(await restored.records.get(rec.id)).toMatchObject({ title: 'Edited', invoice: { transcript: '會員 **90706', regional: { randomNumber: '0059' } },
        items: [{ id: 'line-a', lineTotal: '10.00' }],
      })
      const image = (await restored.attachments.toArray())[0].blob
      expect(await image.text()).toBe('original-png')
      expect(image.type).toBe('image/png')
      expect(restored.tables.some((table) => table.name === 'invoices')).toBe(false)
    } finally { await db.delete(); await restored.delete() }
  })
})

describe('full invoice extraction', () => {
  it('retains transcript, printed zero, masked payment and local metadata', () => {
    const result = sanitizeReceipt({
      merchant: 'Wellcome', total: 328, currency: 'HKD',
      invoice: {
        transcript: '抹零 0.00\n八達通 328.00\n會員 **90706',
        totals: { payable: '328.00', rounding: '0.00', discounts: '-0.00' },
        payments: [{ method: 'stored_value', brand: 'Octopus', amount: '328.00', instrument: '**90706', balanceAfter: '30.90' }],
        loyalty: [{ program: 'yuu', stampsEarned: 5 }],
        regional: { randomNumber: '0059', invoicePeriod: '103年03–04月' },
      },
    } as never) as any
    expect(result.invoice.transcript).toContain('**90706')
    expect(result.invoice.totals).toEqual({ payable: '328.00', rounding: '0.00', discounts: '-0.00' })
    expect(result.invoice.payments[0].balanceAfter).toBe('30.90')
    expect(result.invoice.regional.randomNumber).toBe('0059')
  })

  it('retains raw provider content including unmodeled fields', () => {
    const raw = '{"merchant":"JHC","unmodeled":{"masked":"58******0249070"},"items":[]}'
    const result = parseReceiptContent(raw) as any
    expect(result.invoice.sources[0].rawResponse).toBe(raw)
  })

  it('preserves fractional quantity and signed line totals without making adjustments into purchases', () => {
    const result = sanitizeReceipt({ items: [
      { name: '大葱', qty: 0.544, unit: 'kg', unitPrice: 7.19, lineTotal: '3.91', quantityText: '0.544' },
      { name: 'FREE CALBEE', lineKind: 'adjustment', lineTotal: '-25.90' },
      { name: 'Gift', lineKind: 'gift', qty: 1, lineTotal: '0.00' },
    ] } as never) as any
    expect(result.items[0]).toMatchObject({ unit: 'kg', lineTotal: '3.91', quantityText: '0.544' })
    expect(result.items[1]).toMatchObject({ lineKind: 'adjustment', lineTotal: '-25.90' })
    expect(result.items[2].lineTotal).toBe('0.00')
  })

  it('does not let non-finite item values enter prices or quantities', () => {
    const result = sanitizeReceipt({ items: [{ name: 'bad', qty: Infinity, unitPrice: Infinity }] })
    expect(result.items?.[0].qty).toBeUndefined()
    expect(result.items?.[0].unitPrice).toBeUndefined()
  })
})

describe('shared invoice and item consumers', () => {
  it('maps extraction-local line references to canonical saved item IDs', () => {
    const receipt = sanitizeReceipt({ items: [{ name: 'tea', sourceLineId: 'L1' }],
      invoice: { adjustments: [{ itemIds: ['L1'], amount: '-2' }] } })
    const items = receipt.items!.map((item) => ({ ...item, id: 'saved-1' }))
    expect(bindInvoiceItems(receipt.invoice, items)?.adjustments?.[0].itemIds).toEqual(['saved-1'])
    const first = mergeInvoiceEvidence(undefined, bindInvoiceItems(receipt.invoice, items), { id: 'first' })
    const second = mergeInvoiceEvidence(first, bindInvoiceItems(receipt.invoice, items.map((item) => ({ ...item, id: 'new-id' }))), { id: 'second' })
    expect(second.adjustments).toHaveLength(1)
    expect(second.adjustments?.[0].itemIds).toEqual(['saved-1'])
  })
  it('does not label a per-gram quote as a per-kilogram price', () => {
    expect(itemUnitPrice({ id: 'a', name: 'beef', unit: 'kg', priceUnit: 'g', unitPrice: 2 })).toBeUndefined()
  })

  it('retains identical split payments but does not duplicate reordered observations', () => {
    const incoming = { payments: [{ method: 'cash', amount: '5' }, { method: 'cash', amount: '5' }] }
    const first = mergeInvoiceEvidence(undefined, incoming, { id: 'first' })
    expect(first.payments).toHaveLength(2)
    const second = mergeInvoiceEvidence(first, { payments: [{ amount: '5', method: 'cash' }] }, { id: 'second' })
    expect(second.payments).toHaveLength(2)
  })
  it('sums printed line amounts with exact decimal arithmetic', () => {
    expect(itemsAutoTotal([
      { id: 'a', name: 'a', qty: 24, unitPrice: 7.5, lineTotal: '120.00' },
      { id: 'b', name: 'b', qty: 0.544, unitPrice: 7.19, lineTotal: '3.91' },
    ] as never)).toBe(123.91)
    expect(itemsAutoTotal([{ id: 'a', name: 'a', unitPrice: 0.1 }, { id: 'b', name: 'b', unitPrice: 0.2 }])).toBe(0.3)
  })

  it('searches printed invoice references and item identifiers', () => {
    const rec = record({ invoice: { transcript: 'Approval KAR1774-850', payments: [{ instrument: '**9372' }] },
      items: [{ id: 'a', name: 'beef', barcode: '4901680883515', sku: '00125091' }],
    } as never)
    for (const query of ['KAR1774-850', '**9372', '4901680883515', '00125091']) {
      expect(recordMatchesQuery(rec, query), query).toBe(true)
    }
  })

  it('uses after-line-discount price in dossiers and excludes negative adjustment rows', () => {
    const dossier = priceHistory([record({ items: [
      { id: 'a', name: 'Tea', qty: 24, unitPrice: 7.5, lineTotal: '120.00', priceBasis: 'after_line_discounts' },
      { id: 'b', name: 'Tea', lineKind: 'adjustment', lineTotal: '-60.00' },
    ] } as never)], 'n:tea', 'HKD', { manual: {}, cached: {} } as never)
    expect(dossier.count).toBe(1)
    expect(dossier.purchases[0].unitPrice).toBe(5)
  })

  it('does not treat a store barcode as a global product identity', () => {
    expect(itemKey({ id: 'a', name: 'Beef', barcode: '2025511000002' })).not.toBe('bc:2025511000002')
    expect(itemKey({ id: 'a', name: 'Beef', barcode: '4901680883515' })).toBe('bc:4901680883515')
  })
})
