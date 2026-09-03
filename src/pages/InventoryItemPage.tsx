import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { GhostButton, PageHeader, SectionCard } from '../components/ui'
import { deleteInventoryItem, discardItem, markStatus, markUsed, displayStatus } from '../lib/inventory'
import { itemKey } from '../lib/analytics'
import { useInventoryItems, useUsageTimeline } from '../hooks'

const PCT_PRESETS = [25, 50, 75, 100] as const

/** One inventory item — quick actions, usage timeline, provenance links. */
export function InventoryItemPage() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const items = useInventoryItems()
  const events = useUsageTimeline(id)
  const item = items?.find((i) => i.id === id)
  const [confirming, setConfirming] = useState(false)

  if (!items) return null
  if (!item) {
    return (
      <div className="px-4 pb-10">
        <PageHeader title={t('inventory.title')} onBack={() => navigate('/inventory')} />
        <p className="px-6 py-16 text-center text-ink-soft dark:text-dusk-soft">{t('inventory.empty')}</p>
      </div>
    )
  }

  const status = displayStatus(item)
  const active = status !== 'finished' && status !== 'expired'

  return (
    <div className="px-4 pb-10">
      <PageHeader title={item.name} onBack={() => navigate('/inventory')} />

      <div className="mt-2 flex items-center gap-2 text-sm text-ink-soft dark:text-dusk-soft">
        <span className="rounded-full bg-terracotta-soft px-2.5 py-0.5 text-xs text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink">
          {status === 'expired' ? t('inventory.expiredS') : status === 'finished' ? t('inventory.finished') : status === 'opened' ? t('inventory.opened') : t('inventory.unopened')}
        </span>
        <span className="tabular-nums">×{item.qty}{item.unit ?? ''}</span>
        {item.expiresAt && <span className="tabular-nums">{t('inventory.expires', { date: item.expiresAt })}</span>}
      </div>

      {active && (
        <SectionCard title={t('inventory.quickActions')}>
          <div className="grid grid-cols-4 gap-2">
            {PCT_PRESETS.map((pct) => (
              <GhostButton
                key={pct}
                className="min-h-11 px-1 text-xs"
                onClick={() => void markUsed(item.id, pct)}
              >
                −{pct}%
              </GhostButton>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <GhostButton onClick={() => void markStatus(item.id, 'finished')}>{t('inventory.finished')}</GhostButton>
            <GhostButton onClick={() => void markStatus(item.id, 'expired')}>{t('inventory.expiredS')}</GhostButton>
          </div>
          {!confirming ? (
            <GhostButton
              className="mt-2 w-full border-red-300 text-red-600 dark:border-red-900"
              onClick={() => setConfirming(true)}
            >
              {t('inventory.discard')}
            </GhostButton>
          ) : (
            <div className="mt-2 flex gap-2">
              <GhostButton
                className="flex-1 border-red-300 text-red-600 dark:border-red-900"
                onClick={() => {
                  void discardItem(item.id)
                  navigate('/inventory')
                }}
              >
                {t('common.confirm')}
              </GhostButton>
              <GhostButton className="flex-1" onClick={() => setConfirming(false)}>
                {t('common.cancel')}
              </GhostButton>
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title={t('inventory.timeline')}>
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-ink-soft dark:text-dusk-soft">{t('inventory.noEvents')}</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {(events ?? []).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span>
                  {e.kind === 'used' && e.amountPct !== undefined
                    ? t('inventory.usedPct', { pct: e.amountPct })
                    : e.kind === 'discarded'
                      ? t('inventory.discard')
                      : e.kind === 'finished'
                        ? t('inventory.finished')
                        : e.kind === 'expired'
                          ? t('inventory.expiredS')
                          : e.kind}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-soft dark:text-dusk-soft">
                  {new Date(e.at).toLocaleDateString(i18n.language)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="mt-4 grid gap-2">
        {item.sourceRecordId && (
          <Link
            to={`/record/${item.sourceRecordId}`}
            className="flex min-h-12 items-center justify-center rounded-xl border border-line text-sm dark:border-dusk-line"
          >
            {t('inventory.sourceReceipt')}
          </Link>
        )}
        <Link
          to={`/product/${encodeURIComponent(itemKey({ id: 'k', name: item.name, barcode: item.barcode }))}`}
          className="flex min-h-12 items-center justify-center rounded-xl border border-line text-sm dark:border-dusk-line"
        >
          {t('dossier.title')}
        </Link>
        <GhostButton
          className="border-red-300 text-red-600 dark:border-red-900"
          onClick={() => {
            void deleteInventoryItem(item.id)
            navigate('/inventory')
          }}
        >
          {t('common.delete')}
        </GhostButton>
      </div>
    </div>
  )
}
