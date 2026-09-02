import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../src/i18n'
import App from '../src/App'
import { db } from '../src/db/db'
import { seedDefaultCategories } from '../src/db/seed'
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

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('draft persistence (kill-the-tab safety)', () => {
  it('restores an unsaved draft on remount, clears it on save', async () => {
    await bootDb()
    const user = userEvent.setup()
    const first = renderApp()
    await openAddPage(user)

    await user.type(screen.getByPlaceholderText('這是什麼?'), '草稿測試')
    await user.type(screen.getByLabelText('商家'), '誠品')
    // wait out the 600ms draft debounce
    await new Promise((r) => setTimeout(r, 800))
    first.unmount()

    const second = renderApp()
    await user.click(await screen.findByRole('link', { name: '新增' }))
    expect(await screen.findByDisplayValue('草稿測試')).toBeInTheDocument()
    expect(screen.getByDisplayValue('誠品')).toBeInTheDocument()
    expect(await screen.findByText('已回復上次未完成的草稿')).toBeInTheDocument()

    // saving clears the draft
    await user.click(screen.getByText('儲存'))
    expect(await screen.findAllByText('草稿測試')).not.toHaveLength(0)
    expect(await screen.findByText('已儲存')).toBeInTheDocument()
    second.unmount()
    const third = renderApp()
    await user.click(await screen.findByRole('link', { name: '新增' }))
    await screen.findByPlaceholderText('這是什麼?')
    expect(screen.queryByDisplayValue('草稿測試')).not.toBeInTheDocument()
    third.unmount()
  })

  it('defaults the record date to today', async () => {
    await bootDb()
    const user = userEvent.setup()
    renderApp()
    await openAddPage(user)
    expect((screen.getByLabelText('日期') as HTMLInputElement).value).toBe(localToday())
  })
})

describe('settings progressive disclosure + in-app dialogs', () => {
  it('collapses sections; rename runs in a real dialog (no window.prompt)', async () => {
    await bootDb()
    const user = userEvent.setup()
    renderApp()
    // land on Collection first (hash may persist from a previous test)
    await user.click(await screen.findByRole('link', { name: '收藏' }))
    await user.click(await screen.findByRole('link', { name: '設定' }))

    // collapsed by default: the section header is visible, its body is not
    expect(screen.getByText('分類管理')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('分類名稱')).not.toBeInTheDocument()

    await user.click(screen.getByText('分類管理'))
    expect(screen.getByPlaceholderText('分類名稱')).toBeInTheDocument()

    await user.click(screen.getAllByText('改名')[0])
    const dialog = screen.getByRole('dialog', { name: '改名' })
    const input = within(dialog).getByLabelText('分類名稱')
    await user.clear(input)
    await user.type(input, '自家烘焙')
    await user.click(within(dialog).getByRole('button', { name: '確認' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByText(/自家烘焙/)).toBeInTheDocument()
  })

  it('shows an inline error for an invalid custom currency instead of silently dropping it', async () => {
    await bootDb()
    const user = userEvent.setup()
    renderApp()
    // land on Collection first (hash may persist from a previous test)
    await user.click(await screen.findByRole('link', { name: '收藏' }))
    await user.click(await screen.findByRole('link', { name: '設定' }))

    await user.click(screen.getByText('預設幣別'))
    await user.selectOptions(screen.getByLabelText('預設幣別'), 'CUSTOM')
    const input = screen.getByLabelText('自訂幣別(三碼貨幣代碼)')
    await user.type(input, 'XX')
    await user.tab() // blur
    expect(await screen.findByText('請輸入三碼貨幣代碼(例如 USD)')).toBeInTheDocument()
    expect(input).toBeInTheDocument() // field stays open for correction
  })
})
