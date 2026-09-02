import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

describe('integration: full record lifecycle (spec §11 acceptance)', () => {
  it('create → list → detail → edit → favorite → archive → search → delete', async () => {
    await bootDb()
    const user = userEvent.setup()
    renderApp()

    // Empty state visible in a fresh app
    expect(await screen.findByText('值得留的,再放進來。')).toBeInTheDocument()

    // → Add (only title required, then enrich)
    await user.click(screen.getByText('新增第一筆'))
    await user.type(await screen.findByPlaceholderText('這是什麼?'), '一蘭拉麵')
    await user.type(screen.getByLabelText('商家'), 'Ichiran')
    await user.click(screen.getByText('已購'))
    await user.click(screen.getByText('儲存'))

    // → Detail shows the record
    expect(await screen.findAllByText('一蘭拉麵')).not.toHaveLength(0)
    // merchant line joins with the defaulted date: "Ichiran · yyyy-mm-dd"
    expect(screen.getAllByText(/Ichiran/).length).toBeGreaterThan(0)

    // → Edit: change the title
    await user.click(screen.getByText('編輯'))
    const titleInput = await screen.findByDisplayValue('一蘭拉麵')
    await user.clear(titleInput)
    await user.type(titleInput, '一蘭拉麵 博多店')
    await user.click(screen.getByText('儲存'))
    expect(await screen.findAllByText('一蘭拉麵 博多店')).not.toHaveLength(0)

    // → Favorite + archive
    await user.click(screen.getByRole('button', { name: '最愛' }))
    await waitFor(async () =>
      expect((await db.records.toArray())[0].favorite).toBe(true),
    )
    await user.click(screen.getByRole('button', { name: '封存' }))
    await waitFor(async () =>
      expect((await db.records.toArray())[0].status).toBe('archived'),
    )

    // → Search: hidden by default (archived), visible with 含封存
    await user.click(screen.getByRole('link', { name: /搜尋/ }))
    const searchBox = await screen.findByPlaceholderText('標題、商家、備註、標籤⋯⋯')
    await user.type(searchBox, '拉麵')
    await waitFor(() =>
      expect(screen.getByText('找不到。換個關鍵字,或移除部分篩選。')).toBeInTheDocument(),
    )
    await user.click(screen.getByText('含封存'))
    const card = await screen.findByText('一蘭拉麵 博多店')
    await user.click(card)

    // → Delete with two-step confirm
    await user.click(await screen.findByRole('button', { name: '刪除' }))
    await user.click(await screen.findByRole('button', { name: '確認' }))
    await waitFor(async () => expect(await db.records.count()).toBe(0))
  })

  it('data persists across app remounts (重開 App 資料仍在)', async () => {
    await bootDb()
    const first = renderApp()
    expect(await screen.findByText('值得留的,再放進來。')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByText('新增第一筆'))
    await user.type(await screen.findByPlaceholderText('這是什麼?'), '紀念品')
    await user.click(screen.getByText('儲存'))
    expect(await screen.findAllByText('紀念品')).not.toHaveLength(0)
    first.unmount()

    // "Reopen" the app — a fresh render tree over the same IndexedDB.
    renderApp()
    expect((await screen.findAllByText('紀念品')).length).toBeGreaterThan(0)
  })
})
