import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { Field, GhostButton, PageHeader, fieldClass } from '../components/ui'
import { db } from '../db/db'
import type { AppSettings } from '../db/types'
import { useCategories, useSetting } from '../hooks'
import { addCategory, deleteCategory } from '../lib/records'
import { COMMON_CURRENCIES } from '../lib/currency'
import { downloadTextFile, exportCSV, exportJSON, importJSON } from '../lib/exportImport'
import { fetchRates } from '../lib/rates'
import { getSetting, setSetting } from '../lib/settings'
import { applyTheme } from '../theme'

function useRatesEntry(base: string) {
  return useLiveQuery(() => db.rateCache.get(base), [base])
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-paper-raised p-4 ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line">
      <h2 className="mb-3 text-sm font-semibold text-ink-soft dark:text-dusk-soft">{title}</h2>
      {children}
    </section>
  )
}

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
              ? 'bg-terracotta text-paper'
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
  const rateEntry = useRatesEntry(defaultCurrency)
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
    if (!manualBase || !Number.isFinite(val) || val <= 0) return
    const next = { ...(await getSetting('manualRates')), [manualBase.toUpperCase()]: val }
    if (manualValue === '0') delete next[manualBase.toUpperCase()]
    await setSetting('manualRates', next)
    setManualValue('')
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
        <Section title={t('settings.language')}>
          <ToggleRow
            options={['zh-TW', 'en'] as const}
            value={locale}
            onChange={(v) => void changeLocale(v)}
            labels={(v) => (v === 'zh-TW' ? '繁體中文' : 'English')}
          />
        </Section>

        <Section title={t('settings.theme')}>
          <ToggleRow
            options={['system', 'light', 'dark'] as const}
            value={theme}
            onChange={(v) => void changeTheme(v)}
            labels={(v) =>
              v === 'system' ? t('settings.themeSystem') : v === 'light' ? t('settings.themeLight') : t('settings.themeDark')
            }
          />
        </Section>

        <Section title={t('settings.defaultCurrency')}>
          <div className="flex gap-3">
            <select
              value={COMMON_CURRENCIES.includes(defaultCurrency as never) ? defaultCurrency : 'CUSTOM'}
              onChange={(e) => {
                if (e.target.value !== 'CUSTOM') void setSetting('defaultCurrency', e.target.value)
              }}
              className={fieldClass}
              aria-label={t('settings.defaultCurrency')}
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="CUSTOM">{t('settings.customCurrency')}</option>
            </select>
            {!COMMON_CURRENCIES.includes(defaultCurrency as never) && (
              <input
                defaultValue={defaultCurrency}
                onBlur={(e) => {
                  const v = e.target.value.trim().toUpperCase()
                  if (/^[A-Z]{3}$/.test(v)) void setSetting('defaultCurrency', v)
                }}
                className={fieldClass}
                maxLength={3}
                aria-label={t('settings.customCurrency')}
              />
            )}
          </div>
        </Section>

        <Section title={t('settings.rates')}>
          <p className="mb-2 text-xs text-ink-soft dark:text-dusk-soft">
            {rateEntry
              ? t('settings.ratesUpdated', { date: new Date(rateEntry.fetchedAt).toISOString().slice(0, 10) })
              : t('settings.ratesNever')}
          </p>
          <GhostButton onClick={() => void refreshRates()} className="mb-4 w-full">
            {t('settings.ratesRefresh')}
          </GhostButton>
          <div className="flex items-end gap-2">
            <Field label={t('settings.manualRate', { base: defaultCurrency })}>
              <div className="flex gap-2">
                <input
                  value={manualBase}
                  onChange={(e) => setManualBase(e.target.value.toUpperCase())}
                  placeholder="JPY"
                  maxLength={3}
                  className={`${fieldClass} w-20`}
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
            <GhostButton onClick={() => void saveManualRate()}>{t('common.save')}</GhostButton>
          </div>
          {Object.keys(manualRates).length > 0 && (
            <ul className="mt-2 text-xs text-ink-soft dark:text-dusk-soft">
              {Object.entries(manualRates).map(([cur, rate]) => (
                <li key={cur}>1 {defaultCurrency} = {rate} {cur}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t('settings.ocr')}>
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
        </Section>

        <Section title={t('settings.categories')}>
          <ul className="mb-3 space-y-1">
            {categories.map((c) => (
              <li key={c.id} className="flex min-h-11 items-center justify-between gap-2">
                <span>{c.icon} {locale === 'en' ? (c.nameEn ?? c.name) : c.name}</span>
                <GhostButton
                  className="min-h-9 px-3 py-1 text-xs"
                  onClick={() => {
                    const label = locale === 'en' ? (c.nameEn ?? c.name) : c.name
                    if (window.confirm(t('settings.deleteCategoryConfirm', { name: label }))) {
                      void deleteCategory(c.id)
                    }
                  }}
                >
                  {t('common.delete')}
                </GhostButton>
              </li>
            ))}
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
        </Section>

        <Section title={t('settings.data')}>
          <div className="grid gap-2">
            <GhostButton
              onClick={() => void exportJSON(db, { includeImages: true }).then((b) =>
                downloadTextFile(`moneyclip-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b)),
              )}
            >
              {t('settings.exportJson')}
            </GhostButton>
            <GhostButton
              onClick={() => void exportJSON(db).then((b) =>
                downloadTextFile(`moneyclip-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b)),
              )}
            >
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
        </Section>

        <Section title={t('settings.about')}>
          <p className="text-sm text-ink-soft dark:text-dusk-soft">{t('settings.aboutBody')}</p>
        </Section>
      </div>
    </div>
  )
}
