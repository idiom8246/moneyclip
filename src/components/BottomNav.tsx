import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { IconBasket, IconChart, IconGrid, IconPlus, IconSearch } from './icons'

/**
 * Bottom 5-key nav (2.0 amendment to spec §5):
 * Collection | Inventory | [+] Add | Search | Reports. The shopping list
 * lives inside Inventory as a segmented toggle.
 */
export function BottomNav() {
  const { t } = useTranslation()
  const item = (active: boolean) =>
    `flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1 text-[11px] font-medium transition-all active:scale-95 ${
      active ? 'bg-terracotta-soft/70 text-terracotta dark:bg-dusk-line' : 'text-ink-soft dark:text-dusk-soft'
    }`

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-md"
    >
      <div className="rounded-3xl bg-paper-raised/85 shadow-xl shadow-ink/10 ring-1 ring-line backdrop-blur-xl dark:bg-dusk-raised/85 dark:shadow-black/40 dark:ring-dusk-line">
        <div className="grid grid-cols-5 items-center px-2 pb-1.5 pt-2">
          <NavLink to="/" end className={({ isActive }) => item(isActive)}>
            <IconGrid className="h-5 w-5" />
            <span>{t('nav.collection')}</span>
          </NavLink>

          <NavLink to="/inventory" className={({ isActive }) => item(isActive)}>
            <IconBasket className="h-5 w-5" />
            <span>{t('nav.inventory')}</span>
          </NavLink>

          <NavLink
            to="/add"
            aria-label={t('nav.add')}
            className="mx-auto -mt-9 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-terracotta to-terracotta-deep text-paper shadow-lg shadow-terracotta/40 ring-4 ring-paper/80 transition-transform active:scale-90 dark:ring-dusk/80"
          >
            <IconPlus className="h-7 w-7" strokeWidth={2.2} />
          </NavLink>

          <NavLink to="/search" className={({ isActive }) => item(isActive)}>
            <IconSearch className="h-5 w-5" />
            <span>{t('nav.search')}</span>
          </NavLink>

          <NavLink to="/reports" className={({ isActive }) => item(isActive)}>
            <IconChart className="h-5 w-5" />
            <span>{t('nav.reports')}</span>
          </NavLink>
        </div>
      </div>
    </nav>
  )
}
