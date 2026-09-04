import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
  await db.close()
  await db.delete()
  await db.open()
  await seedDefaultCategories(db)
}

describe('phase 2/3: nav + shopping list', () => {
  it('bottom nav has 5 keys; Search lives in the sticky app header', async () => {
    await bootDb()
    renderApp()
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: '發票' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: '收藏' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: '庫存' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: '新增' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: '報表' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: '搜尋' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '搜尋' })).toBeInTheDocument()
  })

  it('adds, checks and clears list items via the 庫存 page toggle', async () => {
    await bootDb()
    const user = userEvent.setup()
    renderApp()
    await user.click(await screen.findByRole('link', { name: '庫存' }))
    await user.click(await screen.findByRole('button', { name: '清單' }))

    await user.type(screen.getByLabelText('加入要買的項目⋯⋯'), '日本薯仔')
    await user.click(screen.getByRole('button', { name: '新增' }))
    expect(await screen.findByText('日本薯仔')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: '日本薯仔' }))
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: '日本薯仔' })).toHaveAttribute('aria-checked', 'true'),
    )

    await user.click(screen.getByRole('button', { name: '清除已勾選' }))
    await waitFor(() => expect(screen.queryByText('日本薯仔')).not.toBeInTheDocument())
  })
})
