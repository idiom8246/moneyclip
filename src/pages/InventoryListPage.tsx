import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import { expiringSoon, displayStatus } from '../lib/inventory'
import { useInventoryItems, useShoppingItems } from '../hooks'
import { addShoppingItem, removeShoppingItem, toggleShoppingItem } from '../lib/shoppingList'
import { formatMoney } from '../lib/currency'
import type { InventoryItem } from '../db/types'

const STATUS_DOT: Record<string, string> = {
  unopened: 'bg-stone-400',
  opened: 'bg-terracotta',
  finished: 'bg-stone-300 dark:bg-stone-600',
  expired: 'bg-red-500',
}

function statusLabel(item: InventoryItem, t: (k: string) => string): string {
  const s = displayStatus(item)
  if (s === 'expired') return t('inventory.expiredS')
  if (s === 'finished') return t('inventory.finished')
  if (s === 'opened') return t('inventory.opened')
  return t('inventory.unopened')
}

/** 庫存 + 清單 — segmented page per the pinned nav decision. */
export function InventoryListPage() {
  const { t, i18n } = useTranslation()
  const items = useInventoryItems()
  const shopping = useShoppingItems()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'list' ? 'list' : 'stock'
  const [filter, setFilter] = useState<'all' | 'expiring' | 'opened'>('all')
  const [draft, setDraft] = useState('')

  const submit = () => {
    const name = draft.trim()
    if (!name) return
    void addShoppingItem({ name })
    setDraft('')
  }

  const visible = useMemo(() => {
    const list = items ?? []
    if (filter === 'expiring') return expiringSoon(list, 3)
    if (filter === 'opened') return list.filter((i) => i.status === 'opened')
    return list
  }, [items, filter])

  const setTab = (next: 'stock' | 'list') =>
    setSearchParams(next === 'list' ? { tab: 'list' } : {}, { replace: true })

  const checked = (shopping ?? []).filter((i) => i.checked)
  const estTotal = (shopping ?? [])
    .filter((i) => i.estPrice !== undefined && (!i.estCurrency || i.estCurrency === 'HKD'))
    .reduce((a, i) => a + (i.estPrice ?? 0), 0)

  return (
    <div className="px-4 pb-10">
      <PageHeader title={t('inventory.title')} />

      {/* segmented 庫存｜清單 */}
      <div className="mt-3 flex overflow-hidden rounded-xl border border-line dark:border-dusk-line">
        {(['stock', 'list'] as const).map((seg) => (
          <button
            key={seg}
            type="button"
            aria-pressed={tab === seg}
            onClick={() => setTab(seg)}
            className={`min-h-11 flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              tab === seg
                ? 'bg-terracotta font-semibold text-paper shadow-sm shadow-terracotta/25'
                : 'bg-transparent text-ink-soft hover:bg-terracotta-soft/50 dark:text-dusk-soft dark:hover:bg-dusk-line/50'
            }`}
          >
            {seg === 'stock' ? t('inventory.tabInventory') : t('inventory.tabList')}
          </button>
        ))}
      </div>

      {tab === 'stock' ? (
        <>          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ['all', t('common.all')],
                ['expiring', t('inventory.expiring')],
                ['opened', t('inventory.opened')],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`inline-flex min-h-11 items-center rounded-full px-3.5 py-1.5 text-sm transition-all active:scale-95 ${
                  filter === f
                    ? 'bg-terracotta-deep text-paper shadow-sm shadow-terracotta/30'
                    : 'bg-terracotta-soft/60 text-ink hover:bg-terracotta-soft dark:bg-dusk-line/60 dark:text-dusk-ink dark:hover:bg-dusk-line'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="px-6 py-16 text-center text-ink-soft dark:text-dusk-soft">{t('inventory.empty')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {visible.map((item) => {
                const status = displayStatus(item)
                return (
                  <li key={item.id}>
                    <Link
                      to={`/inventory/${item.id}`}
                      className="flex min-h-14 items-center gap-3 rounded-xl bg-paper-raised px-3 py-2 ring-1 ring-line transition-all active:scale-[0.99] dark:bg-dusk-raised dark:ring-dusk-line"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.name}</span>
                        <span className="block text-xs text-ink-soft dark:text-dusk-soft">
                          {statusLabel(item, t)}
                          {item.expiresAt && ` · ${t('inventory.expires', { date: item.expiresAt })}`}
                          {` · ×${item.qty}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={t('list.addItem')}
              aria-label={t('list.addItem')}
              className="w-full min-w-0 min-h-11 rounded-xl border border-line bg-paper-raised px-3.5 text-base text-ink focus:border-terracotta focus:outline-none dark:border-dusk-line dark:bg-dusk-raised dark:text-dusk-ink"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="min-h-11 shrink-0 rounded-xl bg-terracotta px-4 text-sm font-semibold text-paper disabled:opacity-40"
            >
              {t('common.add')}
            </button>
          </div>

          {(shopping ?? []).length === 0 ? (
            <p className="px-6 py-16 text-center text-ink-soft dark:text-dusk-soft">{t('list.empty')}</p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {[...(shopping ?? [])].sort((a, b) => a.checked - b.checked).map((item) => (
                  <li
                    key={item.id}
                    className={`flex min-h-12 items-center gap-3 rounded-xl bg-paper-raised px-3 ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line ${
                      item.checked ? 'opacity-50' : ''
                    }`}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.checked ? 'true' : 'false'}
                      aria-label={item.name}
                      onClick={() => void toggleShoppingItem(item.id)}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        item.checked ? 'border-terracotta bg-terracotta text-paper' : 'border-line dark:border-dusk-line'
                      }`}
                    >
                      {item.checked ? '✓' : ''}
                    </button>
                    <span className={`min-w-0 flex-1 truncate text-sm ${item.checked ? 'line-through' : ''}`}>
                      {item.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeShoppingItem(item.id)}
                      aria-label={t('common.delete')}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft dark:text-dusk-soft"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-ink-soft dark:text-dusk-soft">{t('list.estTotal')}</span>
                <span className="text-lg font-semibold tabular-nums">{formatMoney(estTotal, 'HKD', i18n.language)}</span>
              </div>
              {checked.length > 0 && (
                <button
                  type="button"
                  onClick={() => void checked.forEach((i) => void removeShoppingItem(i.id))}
                  className="mt-3 min-h-11 w-full rounded-xl border border-line text-sm text-ink-soft dark:border-dusk-line dark:text-dusk-soft"
                >
                  {t('list.clearDone')}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
