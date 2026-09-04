import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/ui'
import { expiringSoon, displayStatus } from '../lib/inventory'
import { useInventoryItems, useShoppingItems } from '../hooks'
import { addShoppingItem, removeShoppingItem, toggleShoppingItem } from '../lib/shoppingList'
import { formatMoney } from '../lib/currency'
import type { InventoryItem } from '../db/types'

const STATUS_DOT: Record<string, string> = {
  unopened: 'bg-cobalt/35 dark:bg-cobalt-lift/35',
  opened: 'bg-cobalt dark:bg-cobalt-lift',
  finished: 'bg-line dark:bg-dusk-line',
  expired: 'bg-signal-500',
}

function statusLabel(item: InventoryItem, t: (k: string) => string): string {
  const s = displayStatus(item)
  if (s === 'expired') return t('inventory.expiredS')
  if (s === 'finished') return t('inventory.finished')
  if (s === 'opened') return t('inventory.opened')
  return t('inventory.unopened')
}

function expiryUrgency(
  item: InventoryItem,
  t: (k: string, options?: Record<string, number>) => string,
): string | null {
  if (!item.expiresAt || item.status === 'finished' || item.status === 'expired') return null
  const [y, m, d] = item.expiresAt.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (days < 0 || days > 3) return null
  if (days === 0) return t('inventory.dueToday')
  if (days === 1) return t('inventory.dueTomorrow')
  return t('inventory.dueWithin', { count: days })
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
      <div className="glass-soft mt-3 flex gap-1 rounded-xl p-1">
        {(['stock', 'list'] as const).map((seg) => (
          <button
            key={seg}
            type="button"
            aria-pressed={tab === seg}
            onClick={() => setTab(seg)}
            className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-sm transition-all active:scale-[0.98] ${
              tab === seg
                ? 'btn-cobalt font-semibold'
                : 'text-ink-soft hover:bg-paper-raised/50 dark:text-dusk-soft dark:hover:bg-dusk-raised/60'
            }`}
          >
            {seg === 'stock' ? t('inventory.tabInventory') : t('inventory.tabList')}
          </button>
        ))}
      </div>

      {tab === 'stock' ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
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
                    ? 'btn-cobalt font-medium'
                    : 'glass-soft text-ink hover:brightness-[1.03] dark:text-dusk-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              kind="inventory"
              title={t('inventory.emptyTitle')}
              body={t('inventory.empty')}
              compact
              action={<Link to="/add" className="btn-cobalt inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold">{t('collection.emptyCta')}</Link>}
            />
          ) : (
            <ul className="mt-3 space-y-2">
              {visible.map((item) => {
                const status = displayStatus(item)
                const urgency = expiryUrgency(item, t)
                return (
                  <li key={item.id}>
                    <Link
                      to={`/inventory/${item.id}`}
                      className="glass-soft flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 transition-all active:scale-[0.99]"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${urgency ? 'bg-signal-500' : STATUS_DOT[status]}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.name}</span>
                        <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-xs text-ink-soft dark:text-dusk-soft">
                            {statusLabel(item, t)}
                            {item.expiresAt && ` · ${t('inventory.expires', { date: item.expiresAt })}`}
                            {` · ×${item.qty}`}
                          </span>
                          {urgency && (
                            <span className="shrink-0 rounded-full border border-signal-300 px-1.5 py-0.5 text-[11px] font-semibold text-signal-600 dark:border-signal-900 dark:text-signal-300">
                              {urgency}
                            </span>
                          )}
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
              className="glass-soft w-full min-w-0 min-h-11 rounded-xl px-3.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-cobalt/25 dark:text-dusk-ink"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="btn-cobalt min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-all active:scale-[0.97] disabled:opacity-40"
            >
              {t('common.add')}
            </button>
          </div>

          {(shopping ?? []).length === 0 ? (
            <EmptyState kind="list" title={t('list.emptyTitle')} body={t('list.empty')} compact />
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {[...(shopping ?? [])].sort((a, b) => a.checked - b.checked).map((item) => (
                  <li
                    key={item.id}
                    className={`glass-soft flex min-h-12 items-center gap-3 rounded-xl px-3 ${
                      item.checked ? 'opacity-50' : ''
                    }`}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.checked ? 'true' : 'false'}
                      aria-label={item.name}
                      onClick={() => void toggleShoppingItem(item.id)}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all ${
                        item.checked ? 'btn-cobalt' : 'shadow-[inset_0_0_0_1.5px_var(--hairline)]'
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
                <span className="font-display text-lg font-bold tabular-nums">{formatMoney(estTotal, 'HKD', i18n.language)}</span>
              </div>
              {checked.length > 0 && (
                <button
                  type="button"
                  onClick={() => void checked.forEach((i) => void removeShoppingItem(i.id))}
                  className="glass-soft mt-3 min-h-11 w-full rounded-xl text-sm text-ink-soft transition-all active:scale-[0.99] dark:text-dusk-soft"
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
