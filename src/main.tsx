import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './i18n'
import i18n from './i18n'
import { db } from './db/db'
import { seedDefaultCategories } from './db/seed'
import { getSetting } from './lib/settings'
import { applyTheme, watchSystemTheme } from './theme'
import { ToastProvider } from './components/Toast'

async function boot() {
  await seedDefaultCategories(db)
  const [locale, theme] = await Promise.all([getSetting('locale'), getSetting('theme')])
  await i18n.changeLanguage(locale)
  applyTheme(theme)
  watchSystemTheme(() => 'system')

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ToastProvider>
        <App />
      </ToastProvider>
    </React.StrictMode>,
  )
}

void boot()
