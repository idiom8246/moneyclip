import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/ui'
import { IconX } from '../components/icons'
import { useShoppingItems } from '../hooks'
import { addShoppingItem, clearDoneShoppingItems, removeShoppingItem, toggleShoppingItem } from '../lib/shoppingList'
import { formatMoney } from '../lib/currency'

/** 購物清單 — check things off in-store, estimated total for base currency. */
export function ShoppingListPage() {
  const { t, i18n } = useTranslation()
  const items = useShoppingItems()
  const [draft, setDraft] = useState('')

  const unchecked = (items ?? []).filter((i) => !i.checked)
  const checked = (items ?? []).filter((i) => i.checked)
  // Estimated total only sums base-currency estimates — foreign ones stay
  // raw (never silently converted; pinned R4).
  const estTotal = [...unchecked, ...checked]
    .filter((i) => i.estPrice !== undefined && (!i.estCurrency || i.estCurrency === 'HKD'))
    .reduce((a, i) => a + (i.estPrice ?? 0), 0)

  const submit = () => {
    const name = draft.trim()
    if (!name) return
    void addShoppingItem({ name })
    setDraft('')
  }

  return (
    <div className="px-4 pb-10">
      <PageHeader title={t('list.title')} onBack={() => history.back()} />

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

      {(items ?? []).length === 0 ? (
        <p className="px-6 py-16 text-center text-ink-soft dark:text-dusk-soft">{t('list.empty')}</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {[...unchecked, ...checked].map((item) => (
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
                    item.checked
                      ? 'border-terracotta bg-terracotta text-paper'
                      : 'border-line dark:border-dusk-line'
                  }`}
                >
                  {item.checked ? '✓' : ''}
                </button>
                <span className={`min-w-0 flex-1 truncate text-sm ${item.checked ? 'line-through' : ''}`}>
                  {item.name}
                  {item.qty !== undefined && <span className="text-ink-soft dark:text-dusk-soft"> ×{item.qty}</span>}
                </span>
                {item.estPrice !== undefined && (
                  <span className="shrink-0 text-xs tabular-nums text-ink-soft dark:text-dusk-soft">
                    {formatMoney(item.estPrice, item.estCurrency ?? 'HKD', i18n.language)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void removeShoppingItem(item.id)}
                  aria-label={t('common.delete')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft dark:text-dusk-soft"
                >
                  <IconX className="h-4 w-4" />
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
              onClick={() => void clearDoneShoppingItems()}
              className="mt-3 min-h-11 w-full rounded-xl border border-line text-sm text-ink-soft dark:border-dusk-line dark:text-dusk-soft"
            >
              {t('list.clearDone')}
            </button>
          )}
        </>
      )}
    </div>
  )
}
