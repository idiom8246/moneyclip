import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { useSetting } from '../hooks'
import { setSetting } from '../lib/settings'
import { BrandMark } from './BrandMark'
import { IconSearch, IconSettings } from './icons'

export function AppHeader() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const locale = useSetting('locale')
  const actionClass = (active = false) =>
    `flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all active:scale-95 ${
      active
        ? 'bg-cobalt-soft text-cobalt shadow-[inset_0_0_0_1px_rgb(33_72_184/10%)] dark:bg-cobalt-lift/15 dark:text-cobalt-lift'
        : 'text-ink-soft hover:bg-cobalt-soft/60 dark:text-dusk-soft dark:hover:bg-dusk-line/60'
    }`

  const toggleLocale = async () => {
    const next = locale === 'zh-TW' ? 'en' : 'zh-TW'
    await setSetting('locale', next)
    await i18n.changeLanguage(next)
  }

  return (
    <header className="glass-strong hairline-b sticky top-0 z-40 shrink-0 px-3 py-2">
      <div className="flex min-h-12 items-center gap-2">
        <Link
          to="/"
          aria-label={t('app.home')}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl focus-visible:outline-offset-1"
        >
          <BrandMark className="h-9 w-9 shrink-0 text-cobalt drop-shadow-[0_6px_12px_rgb(33_72_184/22%)]" />
          <span className="truncate font-display text-[22px] font-bold tracking-[-0.025em] [font-stretch:112%]">
            Moneyclip
          </span>
        </Link>

        <div className="flex items-center gap-0.5" aria-label={t('app.tools')}>
          <Link
            to="/search"
            aria-label={t('search.title')}
            className={actionClass(location.pathname === '/search')}
          >
            <IconSearch className="h-[18px] w-[18px]" />
          </Link>
          <button
            type="button"
            onClick={() => void toggleLocale()}
            aria-label={locale === 'zh-TW' ? t('app.switchToEnglish') : t('app.switchToChinese')}
            className={actionClass()}
          >
            {locale === 'zh-TW' ? 'EN' : '中'}
          </button>
          <Link
            to="/settings"
            aria-label={t('settings.title')}
            className={actionClass(location.pathname === '/settings')}
          >
            <IconSettings className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </div>
    </header>
  )
}
