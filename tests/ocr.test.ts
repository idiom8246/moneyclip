import { describe, expect, it } from 'vitest'
import { sanitizeReceipt } from '../src/lib/ocr'

describe('sanitizeReceipt', () => {
  it('keeps well-formed fields only', () => {
    const out = sanitizeReceipt({
      merchant: 'えき弁',
      date: '2026-07-03',
      total: 1230,
      currency: 'jpy',
      items: [
        { name: '幕の内弁当', qty: 1, unitPrice: 1230 },
        { name: '' },
        { name: 'bad', qty: -2, unitPrice: Number.NaN } as never,
      ],
      // junk fields dropped:
      // @ts-expect-error intentionally malformed
      title: 'x',
    })
    expect(out).toEqual({
      merchant: 'えき弁',
      date: '2026-07-03',
      total: 1230,
      currency: 'JPY',
      // name-only items are valid (barcoded items without price, etc.)
      items: [
        { name: '幕の内弁当', qty: 1, unitPrice: 1230 },
        { name: 'bad' },
      ],
    })
  })

  it('rejects malformed date / negative totals / bad currency', () => {
    expect(
      sanitizeReceipt({ date: 'July 3', total: -5, currency: 'JPYY', merchant: '' }),
    ).toEqual({})
  })
})
