import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Non-blocking offline indicator (spec §8). */
export function OfflineBanner() {
  const { t } = useTranslation()
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null
  return (
    <div role="status" className="btn-cobalt px-4 py-1.5 text-center text-xs font-medium">
      {t('offline.banner')}
    </div>
  )
}
