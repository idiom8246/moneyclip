import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../src/i18n'
import App from '../src/App'
import { db } from '../src/db/db'
import { createRecord } from '../src/lib/records'
import { ToastProvider } from '../src/components/Toast'

beforeEach(async () => {
  cleanup()
  await db.open()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  window.location.hash = '#/'
})
afterEach(() => cleanup())
const boot = () => render(<ToastProvider><App /></ToastProvider>)

describe('invoice and item views over one record', () => {
  it('opens invoice details, switches to items, and preserves both after editing', async () => {
    const rec = await createRecord({ title: 'Wellcome receipt', price: 10, currency: 'HKD',
      invoice: { transcript: '會員 **90706\nRRN 0012345', invoiceNumber: 'INV-123',
        payments: [{ brand: 'Octopus', amount: '10.00', balanceAfter: '30.90' }] },
      items: [{ id: 'line-a', name: 'Lemon tea', qty: 2, unitPrice: 7.5, lineTotal: '10.00', rawText: 'LEMON $10/2', priceBasis: 'after_line_discounts' }],
    })
    window.location.hash = `#/record/${rec.id}?tab=invoice`
    const user = userEvent.setup()
    boot()
    expect(await screen.findByRole('tab', { name: '發票' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('INV-123')).toBeInTheDocument()
    expect(screen.getByText('Octopus')).toBeInTheDocument()
    await user.click(screen.getByText('收據原文'))
    expect(screen.getByText(/RRN 0012345/)).toBeVisible()
    await user.click(screen.getByRole('tab', { name: '物品' }))
    expect(screen.getByRole('link', { name: 'Lemon tea' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: '編輯' }))
    const title = await screen.findByDisplayValue('Wellcome receipt')
    await user.clear(title); await user.type(title, 'Updated receipt')
    const quantity = screen.getByDisplayValue('2')
    await user.clear(quantity); await user.type(quantity, '3')
    await user.click(screen.getByText('儲存'))
    await waitFor(async () => expect((await db.records.get(rec.id))?.title).toBe('Updated receipt'))
    await screen.findByRole('tab', { name: '物品' })
    expect(await db.records.count()).toBe(1)
    expect((await db.records.get(rec.id))?.invoice?.transcript).toContain('0012345')
    expect((await db.records.get(rec.id))?.items?.[0]).toMatchObject({ id: 'line-a', lineTotal: '10.00' })
  })

  it('filters invoices without copying journal records into another store', async () => {
    await createRecord({ title: 'Remember this café' })
    await createRecord({ title: 'Actual invoice', invoice: { invoiceNumber: 'A-002' } })
    window.location.hash = '#/invoices'
    boot()
    expect(await screen.findByText('Actual invoice')).toBeInTheDocument()
    expect(screen.queryByText('Remember this café')).not.toBeInTheDocument()
    expect(await db.records.count()).toBe(2)
  })
})
