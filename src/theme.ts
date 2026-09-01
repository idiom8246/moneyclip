import type { AppSettings } from './db/types'

type Theme = AppSettings['theme']

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function apply(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function applyTheme(theme: Theme) {
  if (theme === 'system') {
    apply(media().matches ? 'dark' : 'light')
  } else {
    apply(theme)
  }
}

/** Attach a live listener for system theme changes; returns cleanup. */
export function watchSystemTheme(getTheme: () => Theme): () => void {
  const mq = media()
  const onChange = () => {
    if (getTheme() === 'system') applyTheme('system')
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
