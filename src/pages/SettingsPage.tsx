import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Coins,
  Database,
  FolderCog,
  Info,
  Languages,
  Palette,
  ScanText,
  TrendingUp,
} from 'lucide-react'
import { useToast } from '../components/Toast'
import { Field, GhostButton, PageHeader, SectionCard, fieldClass } from '../components/ui'
import { db } from '../db/db'
import type { AppSettings } from '../db/types'
import { useCategories, useSetting } from '../hooks'
import { addCategory, deleteCategory, renameCategory } from '../lib/records'
import { COMMON_CURRENCIES, isCommonCurrency } from '../lib/currency'
import { downloadTextFile, exportCSV, exportJSON, importJSON } from '../lib/exportImport'
import { fetchRates } from '../lib/rates'
import { getSetting, setSetting } from '../lib/settings'
import { applyTheme } from '../theme'
import { categoryDisplayName } from '../lib/search'

const sectionIcon = (Icon: typeof Coins) => <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />

function ToggleRow<A extends string>({
  options, value, onChange, labels,
}: {
  options: A[]
  value: A
  onChange: (v: A) => void
  labels: (v: A) => string
}) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-line dark:border-dusk-line">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={`min-h-11 flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            value === opt
              ? 'bg-terracotta font-semibold text-paper shadow-sm shadow-terracotta/25'
              : 'bg-transparent text-ink-soft hover:bg-terracotta-soft/50 dark:text-dusk-soft dark:hover:bg-dusk-line/50'
          }`}
        >
          {labels(opt)}
        </button>
      ))}
    </div>
  )
}

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()
  const categories = useCategories() ?? []

  const locale = useSetting('locale')
  const theme = useSetting('theme')
  const defaultCurrency = useSetting('defaultCurrency')
  const ocrConfig = useSetting('ocrConfig')
  const manualRates = useSetting('manualRates')

  const [ocrForm, setOcrForm] = useState(ocrConfig)
  const [manualBase, setManualBase] = useState('JPY')
  const [manualValue, setManualValue] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const rateCacheRows = useLiveQuery(() => db.rateCache.toArray(), []) ?? []
  const [newCat, setNewCat] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => setOcrForm(ocrConfig), [ocrConfig])

  const changeLocale = async (v: AppSettings['locale']) => {
    await setSetting('locale', v)
    await i18n.changeLanguage(v)
  }
  const changeTheme = async (v: AppSettings['theme']) => {
    await setSetting('theme', v)
    applyTheme(v)
  }

  const refreshRates = async () => {
    try {
      await fetchRates(defaultCurrency)
      toast(t('settings.ratesUpdated', { date: new Date().toISOString().slice(0, 10) }))
    } catch {
      toast(t('settings.ratesFailed'))
    }
  }

  const saveManualRate = async () => {
    const val = Number(manualValue)
    if (!manualBase.trim() || !Number.isFinite(val) || val <= 0) return
    const next = { ...(await getSetting('manualRates')), [manualBase.toUpperCase()]: val }
    await setSetting('manualRates', next)
    setManualValue('')
  }

  const downloadBundle = async (includeImages: boolean) => {
    const bundle = await exportJSON(db, { includeImages })
    downloadTextFile(
      `moneyclip-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(bundle),
    )
  }

  const doImport = async (file: File) => {
    try {
      const text = await file.text()
      const result = await importJSON(db, JSON.parse(text))
      toast(t('settings.importResult', { records: result.records, categories: result.categories }))
    } catch {
      toast(t('settings.importFailed'))
    }
  }

  return (
    <div className="px-4 pb-8">
      <PageHeader title={t('settings.title')} onBack={() => navigate(-1)} />

      <div className="space-y-4">
        <SectionCard title={t('settings.language')} icon={sectionIcon(Languages)}>
          <ToggleRow
            options={['zh-TW', 'en'] as const}
            value={locale}
            onChange={(v) => void changeLocale(v)}
            labels={(v) => (v === 'zh-TW' ? '繁體中文' : 'English')}
          />
        </SectionCard>

        <SectionCard title={t('settings.theme')} icon={sectionIcon(Palette)}>
          <ToggleRow
            options={['system', 'light', 'dark'] as const}
            value={theme}
            onChange={(v) => void changeTheme(v)}
            labels={(v) =>
              v === 'system' ? t('settings.themeSystem') : v === 'light' ? t('settings.themeLight') : t('settings.themeDark')
            }
          />
        </SectionCard>

        <SectionCard title={t('settings.defaultCurrency')} icon={sectionIcon(Coins)}>
          <div className="flex gap-3">
            <select
              value={!customOpen && isCommonCurrency(defaultCurrency) ? defaultCurrency : 'CUSTOM'}
              onChange={(e) => {
                if (e.target.value === 'CUSTOM') setCustomOpen(true)
                else {
                  setCustomOpen(false)
                  void setSetting('defaultCurrency', e.target.value)
                }
              }}
              className={fieldClass}
              aria-label={t('settings.defaultCurrency')}
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="CUSTOM">{t('settings.customCurrency')}</option>
            </select>
            {customOpen && (
              <input
                defaultValue={isCommonCurrency(defaultCurrency) ? '' : defaultCurrency}
                placeholder="USD"
                onBlur={(e) => {
                  const v = e.target.value.trim().toUpperCase()
                  if (/^[A-Z]{3}$/.test(v)) {
                    void setSetting('defaultCurrency', v)
                    setCustomOpen(false)
                  }
                }}
                className={fieldClass}
                maxLength={3}
                autoFocus
                aria-label={t('settings.customCurrency')}
              />
            )}
          </div>
        </SectionCard>

        <SectionCard title={t('settings.rates')} icon={sectionIcon(TrendingUp)}>
          {rateCacheRows.length === 0 ? (
            <p className="mb-2 text-xs text-ink-soft dark:text-dusk-soft">{t('settings.ratesNever')}</p>
          ) : (
            <ul className="mb-2 text-xs text-ink-soft dark:text-dusk-soft">
              {rateCacheRows.map((row) => (
                <li key={row.base}>
                  {t('settings.ratesCacheBase', { base: row.base })} ·{' '}
                  {t('settings.ratesUpdated', { date: new Date(row.fetchedAt).toISOString().slice(0, 10) })}
                  {Object.keys(row.rates).length > 0 && ` (${Object.keys(row.rates).length})`}
                </li>
              ))}
            </ul>
          )}
          <GhostButton onClick={() => void refreshRates()} className="mb-4 w-full">
            {t('settings.ratesRefresh')}
          </GhostButton>
          <div className="flex items-end gap-2">
            <Field label={t('settings.manualRate', { base: defaultCurrency })} className="min-w-0 flex-1">
              <div className="flex gap-2">
                <input
                  value={manualBase}
                  onChange={(e) => setManualBase(e.target.value.toUpperCase())}
                  placeholder="JPY"
                  maxLength={3}
                  className={`${fieldClass} max-w-20 shrink-0`}
                  aria-label="Currency"
                />
                <input
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder={manualRates[manualBase] !== undefined ? String(manualRates[manualBase]) : '4.5'}
                  inputMode="decimal"
                  className={fieldClass}
                  aria-label={t('settings.manualRate', { base: defaultCurrency })}
                />
              </div>
            </Field>
            <GhostButton onClick={() => void saveManualRate()} className="shrink-0 whitespace-nowrap">
              {t('common.save')}
            </GhostButton>
          </div>
          {Object.keys(manualRates).length > 0 && (
            <ul className="mt-2 text-xs text-ink-soft dark:text-dusk-soft">
              {Object.entries(manualRates).map(([cur, rate]) => (
                <li key={cur}>1 {defaultCurrency} = {rate} {cur}</li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t('settings.ocr')} icon={sectionIcon(ScanText)}>
          <p className="mb-3 text-xs text-ink-soft dark:text-dusk-soft">{t('settings.ocrHint')}</p>
          <div className="space-y-3">
            <Field label={t('settings.ocrBaseUrl')}>
              <input
                value={ocrForm.baseUrl}
                onChange={(e) => setOcrForm({ ...ocrForm, baseUrl: e.target.value })}
                placeholder="https://api.example.com/v1"
                inputMode="url"
                className={fieldClass}
              />
            </Field>
            <Field label={t('settings.ocrApiKey')}>
              <input
                type="password"
                value={ocrForm.apiKey}
                onChange={(e) => setOcrForm({ ...ocrForm, apiKey: e.target.value })}
                autoComplete="off"
                className={fieldClass}
              />
            </Field>
            <Field label={t('settings.ocrModel')}>
              <input
                value={ocrForm.model}
                onChange={(e) => setOcrForm({ ...ocrForm, model: e.target.value })}
                placeholder="gpt-4o-mini"
                className={fieldClass}
              />
            </Field>
            <GhostButton
              onClick={() => {
                void setSetting('ocrConfig', ocrForm)
                toast(t('settings.ocrSaved'))
              }}
              className="w-full"
            >
              {t('common.save')}
            </GhostButton>
          </div>
        </SectionCard>

        <SectionCard title={t('settings.categories')} icon={sectionIcon(FolderCog)}>
          <ul className="mb-3 space-y-1">
            {categories.map((c) => {
              const label = categoryDisplayName(c, i18n.language)
              return (
                <li key={c.id} className="flex min-h-11 items-center justify-between gap-2">
                  <span>{c.icon} {label}</span>
                  <span className="flex gap-1">
                    <GhostButton
                      className="min-h-9 px-3 py-1 text-xs"
                      onClick={() => {
                        const name = window.prompt(t('settings.categoryName'), label)?.trim()
                        if (name) void renameCategory(c.id, name)
                      }}
                    >
                      {t('settings.renameCategory')}
                    </GhostButton>
                    <GhostButton
                      className="min-h-9 px-3 py-1 text-xs"
                      onClick={() => {
                        if (window.confirm(t('settings.deleteCategoryConfirm', { name: label }))) {
                          void deleteCategory(c.id)
                        }
                      }}
                    >
                      {t('common.delete')}
                    </GhostButton>
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="flex gap-2">
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder={t('settings.categoryName')}
              className={fieldClass}
            />
            <GhostButton
              onClick={() => {
                const name = newCat.trim()
                if (name) void addCategory(name).then(() => setNewCat(''))
              }}
            >
              {t('common.add')}
            </GhostButton>
          </div>
        </SectionCard>

        <SectionCard title={t('settings.data')} icon={sectionIcon(Database)}>
          <div className="grid gap-2">
            <GhostButton onClick={() => void downloadBundle(true)}>
              {t('settings.exportJson')}
            </GhostButton>
            <GhostButton onClick={() => void downloadBundle(false)}>
              {t('settings.exportJsonNoImages')}
            </GhostButton>
            <GhostButton
              onClick={() => {
                void (async () => {
                  const [records, cats] = await Promise.all([db.records.toArray(), db.categories.toArray()])
                  downloadTextFile(`moneyclip-${new Date().toISOString().slice(0, 10)}.csv`, exportCSV(records, cats), 'text/csv')
                })()
              }}
            >
              {t('settings.exportCsv')}
            </GhostButton>
            <GhostButton onClick={() => fileInput.current?.click()}>
              {t('settings.importJson')}
            </GhostButton>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void doImport(f)
                e.target.value = ''
              }}
            />
          </div>
        </SectionCard>

        <SectionCard title={t('settings.about')} icon={sectionIcon(Info)}>
          <p className="text-sm text-ink-soft dark:text-dusk-soft">{t('settings.aboutBody')}</p>
        </SectionCard>
      </div>
    </div>
  )
}
