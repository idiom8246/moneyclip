import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../src/i18n'
import App from '../src/App'
import { db } from '../src/db/db'
import { seedDefaultCategories } from '../src/db/seed'
import { DEFAULT_SETTINGS } from '../src/db/types'
import { ToastProvider } from '../src/components/Toast'

function renderApp() {
  return render(
    <ToastProvider>
      <App />
    </ToastProvider>,
  )
}

async function bootDb() {
  // Close the singleton first so pending liveQueries can't reject with
  // DatabaseClosedError when the DB is deleted underneath them.
  await db.close()
  await db.delete()
  await db.open()
  await seedDefaultCategories(db)
}

async function openAddPage(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('link', { name: '新增' }))
  await screen.findByPlaceholderText('這是什麼?')
}

describe('R4: default currency', () => {
  it('ships HKD in DEFAULT_SETTINGS', () => {
    expect(DEFAULT_SETTINGS.defaultCurrency).toBe('HKD')
  })

  it('new-record currency select defaults to HKD when user never set one', async () => {
    await bootDb()
    const user = userEvent.setup()
    renderApp()
    await openAddPage(user)
    const currency = screen.getByLabelText('幣別') as HTMLSelectElement
    expect(currency.value).toBe('HKD')
  })
})

describe('R2: settings reachable', () => {
  it('Search page header has a settings link', async () => {
    await bootDb()
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('link', { name: '搜尋' }))
    expect(await screen.findByRole('link', { name: '設定' })).toBeInTheDocument()
  })
})

describe('R3: record form sections', () => {
  it('starts manual entry with exactly one empty item row', async () => {
    await bootDb()
    const user = userEvent.setup()
    renderApp()
    await openAddPage(user)
    expect(screen.getAllByLabelText('品項名稱')).toHaveLength(1)
  })

  it('加入項目 appends a row; unnamed rows are not saved', async () => {
    await bootDb()
    const user = userEvent.setup()
    renderApp()
    await openAddPage(user)
    await user.type(screen.getByPlaceholderText('這是什麼?'), '測試發票')
    await user.type(screen.getByLabelText('品項名稱'), '洋芋片')
    await user.click(screen.getByText('加入項目'))
    expect(screen.getAllByLabelText('品項名稱')).toHaveLength(2)
    await user.click(screen.getByText('儲存'))
    await screen.findAllByText('測試發票')
    const rec = (await db.records.toArray())[0]
    expect(rec.items).toHaveLength(1)
    expect(rec.items![0].name).toBe('洋芋片')
  })

  it('renders both sections plus common fields on one page', async () => {
    await bootDb()
    const user = userEvent.setup()
    renderApp()
    await openAddPage(user)
    expect(screen.getByText('掃描/上載')).toBeInTheDocument()
    expect(screen.getByText('發票相片')).toBeInTheDocument()
    expect(screen.getByText('條碼')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /掃條碼/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /從照片辨識/ })).toBeInTheDocument()
    expect(screen.getByText('手動輸入')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('這是什麼?')).toBeInTheDocument()
    expect(screen.getByLabelText('日期')).toBeInTheDocument()
    expect(screen.getByLabelText('商家')).toBeInTheDocument()
  })
})
