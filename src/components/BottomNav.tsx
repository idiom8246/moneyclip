import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { IconBasket, IconBookmark, IconChart, IconPlus, IconReceipt } from './icons'

/**
 * Liquid-glass bottom nav (5-key, spec §5 amendment):
 * Invoices | Inventory | [+] Add | Saved | Reports.
 * One optical capsule — deep blur + saturation, specular top edge, soft
 * offset shadow — floating over the page. The active key sits in a small
 * cobalt-tinted lens; the add key is a raised cobalt puck notched into
 * the capsule. The shopping list lives inside Inventory as a toggle.
 */
export function BottomNav() {
  const { t } = useTranslation()
  const item = (active: boolean) =>
    `flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1 text-[11px] font-medium transition-all duration-300 active:scale-95 ${
      active
        ? 'bg-cobalt-soft/80 text-cobalt shadow-[inset_0_1px_0_rgb(255_255_255/65%),inset_0_0_0_1px_rgb(255_255_255/30%)] dark:bg-cobalt-lift/15 dark:text-cobalt-lift dark:shadow-[inset_0_1px_0_rgb(255_255_255/10%)]'
        : 'text-ink-soft dark:text-dusk-soft'
    }`

  return (
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
      <div className="pointer-events-auto mx-auto max-w-[440px] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="glass-strong animate-rise-in rounded-[26px] px-1.5 pb-1 pt-1.5">
          <div className="grid grid-cols-5 items-center">
            <NavLink to="/" end className={({ isActive }) => item(isActive)}>
              <IconReceipt className="h-5 w-5" />
              <span>{t('nav.invoices')}</span>
            </NavLink>

            <NavLink to="/inventory" className={({ isActive }) => item(isActive)}>
              <IconBasket className="h-5 w-5" />
              <span>{t('nav.inventory')}</span>
            </NavLink>

            <NavLink
              to="/add"
              aria-label={t('nav.add')}
              className="mx-auto -mt-8 flex h-14 w-14 items-center justify-center rounded-full btn-cobalt ring-4 ring-paper/80 transition-transform duration-200 active:scale-90 dark:ring-dusk/80"
            >
              <IconPlus className="h-7 w-7" strokeWidth={2.2} />
            </NavLink>

            <NavLink to="/saved" className={({ isActive }) => item(isActive)}>
              <IconBookmark className="h-5 w-5" />
              <span>{t('nav.collection')}</span>
            </NavLink>

            <NavLink to="/reports" className={({ isActive }) => item(isActive)}>
              <IconChart className="h-5 w-5" />
              <span>{t('nav.reports')}</span>
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  )
}
