import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean)
  let crumbs: Crumb[]

  if (pathname === '/') crumbs = [{ label: t('nav.invoices') }]
  else if (pathname === '/saved') crumbs = [{ label: t('nav.collection') }]
  else if (pathname === '/search') crumbs = [{ label: t('search.title') }]
  else if (pathname === '/settings') crumbs = [{ label: t('settings.title') }]
  else if (pathname === '/add') {
    crumbs = [{ label: t('nav.invoices'), to: '/' }, { label: t('form.newRecord') }]
  } else if (parts[0] === 'record') {
    crumbs = [
      { label: t('nav.invoices'), to: '/' },
      ...(parts[2] === 'edit'
        ? [{ label: t('breadcrumbs.record'), to: `/record/${parts[1]}` }, { label: t('common.edit') }]
        : [{ label: t('breadcrumbs.record') }]),
    ]
  } else if (parts[0] === 'inventory') {
    crumbs = parts[1]
      ? [{ label: t('nav.inventory'), to: '/inventory' }, { label: t('breadcrumbs.item') }]
      : [{ label: t('nav.inventory') }]
  } else if (parts[0] === 'product') {
    crumbs = [{ label: t('nav.invoices'), to: '/' }, { label: t('dossier.title') }]
  } else if (parts[0] === 'store') {
    crumbs = [{ label: t('nav.invoices'), to: '/' }, { label: t('store.title') }]
  } else if (parts[0] === 'trip') {
    crumbs = [{ label: t('nav.reports'), to: '/reports' }, { label: t('breadcrumbs.trip') }]
  } else if (pathname === '/reports') crumbs = [{ label: t('nav.reports') }]
  else crumbs = [{ label: t('app.home') }]

  return (
    <nav aria-label={t('breadcrumbs.label')} className="px-4 pt-2.5">
      <ol className="flex min-h-7 items-center gap-1 overflow-hidden text-xs text-ink-soft dark:text-dusk-soft">
        {crumbs.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-45" aria-hidden />}
            {crumb.to ? (
              <Link
                to={crumb.to}
                className="truncate rounded-md px-1 py-1 underline decoration-line underline-offset-4 dark:decoration-dusk-line"
              >
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate px-1 py-1 font-medium text-ink dark:text-dusk-ink">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
