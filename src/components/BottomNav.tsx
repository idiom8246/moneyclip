import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { IconGrid, IconPlus, IconSearch } from './icons'

/** Bottom 3-key nav: Collection | [+] Add (center, raised) | Search (spec §5). */
export function BottomNav() {
  const { t } = useTranslation()
  const item = 'flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 text-xs'

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-paper-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-dusk-line dark:bg-dusk-raised/95"
      aria-label="Main"
    >
      <div className="grid grid-cols-3 items-end px-6 pt-1.5">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `${item} ${isActive ? 'text-terracotta' : 'text-ink-soft dark:text-dusk-soft'}`
          }
        >
          <IconGrid />
          <span>{t('nav.collection')}</span>
        </NavLink>

        <NavLink
          to="/add"
          aria-label={t('nav.add')}
          className="mx-auto -mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-terracotta text-paper shadow-lg shadow-terracotta/30 transition-transform active:scale-95"
        >
          <IconPlus className="h-7 w-7" strokeWidth={2.2} />
        </NavLink>

        <NavLink
          to="/search"
          className={({ isActive }) =>
            `${item} ${isActive ? 'text-terracotta' : 'text-ink-soft dark:text-dusk-soft'}`
          }
        >
          <IconSearch />
          <span>{t('nav.search')}</span>
        </NavLink>
      </div>
    </nav>
  )
}
