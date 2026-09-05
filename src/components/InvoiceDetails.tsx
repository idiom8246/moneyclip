import { useTranslation } from 'react-i18next'
import type { ConsumptionRecord } from '../db/types'
import { invoiceIssues, isObject } from '../lib/invoice'

/** Readable access to extensible receipt fields, including fields unknown to the current schema. */
export function DataFields({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const { t } = useTranslation()
  if (value === undefined || value === null || depth > 12) return null
  if (typeof value === 'boolean') return <span>{t(value ? 'invoice.yes' : 'invoice.no')}</span>
  if (typeof value === 'string' || typeof value === 'number') return <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{String(value)}</span>
  if (Array.isArray(value)) return <ul className="space-y-3">{value.map((v, i) => <li key={i}><DataFields value={v} depth={depth + 1} /></li>)}</ul>
  if (!isObject(value)) return null
  const entries = Object.entries(value).filter(([key, val]) => val !== undefined && val !== null && !['id', 'sourceId', 'schemaVersion'].includes(key))
  return <dl className="space-y-2">{entries.map(([key, val]) => <div key={key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 text-sm">
    <dt className="break-words text-ink dark:text-dusk-soft">{t(`invoice.fields.${key}`, { defaultValue: key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ') })}</dt>
    <dd className="min-w-0 tabular-nums"><DataFields value={val} depth={depth + 1} /></dd>
  </div>)}</dl>
}

export function InvoiceReview({ record }: { record: Pick<ConsumptionRecord, 'invoice' | 'items' | 'currency'> }) {
  const { t } = useTranslation()
  const issues = invoiceIssues(record)
  if (!issues.length) return null
  return <section className="my-4 rounded-xl border border-line p-3 dark:border-dusk-line" aria-label={t('invoice.review')}>
    <h3 className="font-semibold">{t('invoice.review')}</h3>
    <ul className="mt-2 space-y-2 text-sm">{issues.map((issue, i) => <li key={i}>{t(`invoice.issues.${issue.code}`, { expected: issue.expected, actual: issue.actual })}</li>)}</ul>
  </section>
}

export function InvoiceDetails({ record, onOpenSource }: { record: ConsumptionRecord; onOpenSource?: (attachmentId: string) => void }) {
  const { t, i18n } = useTranslation()
  const invoice = record.invoice
  if (!invoice) return <p className="py-6 text-sm text-ink dark:text-dusk-soft">{t('invoice.noDetails')}</p>
  const summary = { invoiceNumber: invoice.invoiceNumber, documentTypes: invoice.documentTypes, country: invoice.country,
    languages: invoice.languages, dateRaw: invoice.dateRaw, time: invoice.time, copyType: invoice.copyType }
  const groups = [
    ['summary', summary], ['merchantDetails', invoice.merchantDetails], ['totals', invoice.totals],
    ['payments', invoice.payments], ['adjustments', invoice.adjustments], ['taxBreakdown', invoice.taxBreakdown],
    ['loyalty', invoice.loyalty], ['coupons', invoice.coupons], ['rebates', invoice.rebates],
    ['regional', invoice.regional], ['policies', invoice.policies], ['sections', invoice.sections],
    ['currencyEvidence', invoice.currencyEvidence], ['extra', invoice.extra],
  ] as const
  return <div>
    <InvoiceReview record={record} />
    {groups.filter(([, value]) => value && Object.values(value).some((v) => v !== undefined)).map(([key, value]) =>
      <section key={key} className="border-b border-line py-4 last:border-0 dark:border-dusk-line">
        <h3 className="mb-3 text-base font-semibold">{t(`invoice.groups.${key}`)}</h3>
        <DataFields value={value} />
      </section>)}
    <details className="border-b border-line py-3 dark:border-dusk-line">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">{t('invoice.transcript')}</summary>
      <p className="whitespace-pre-wrap break-words py-3 text-sm [overflow-wrap:anywhere]">{invoice.transcript || t('invoice.noTranscript')}</p>
    </details>
    {!!invoice.evidence?.length && <details className="border-b border-line py-3 dark:border-dusk-line">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">{t('invoice.evidence')}</summary>
      <DataFields value={invoice.evidence} />
    </details>}
    {!!invoice.sources?.length && <section className="py-4">
      <h3 className="mb-2 font-semibold">{t('invoice.sources')}</h3>
      {invoice.sources.map((source, i) => <details key={source.id ?? i} className="border-b border-line py-2 dark:border-dusk-line">
        <summary className="min-h-11 cursor-pointer content-center text-sm">{t('invoice.extraction', { count: i + 1 })}
          {source.extractedAt && <span className="ml-2">{new Date(source.extractedAt).toLocaleString(i18n.language)}</span>}
        </summary>
        {source.attachmentId && onOpenSource && <button type="button" className="min-h-11 text-sm underline underline-offset-4" onClick={() => onOpenSource(source.attachmentId!)}>{t('invoice.openSource')}</button>}
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-paper-raised p-3 text-xs [overflow-wrap:anywhere] dark:bg-dusk-raised">{source.rawResponse}</pre>
      </details>)}
    </section>}
  </div>
}
