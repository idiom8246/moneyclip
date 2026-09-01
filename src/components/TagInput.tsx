import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Free-form tag input with autocomplete over historical tags (spec §5.2). */
export function TagInput({
  tags,
  onChange,
  suggestions,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')

  const matches = useMemo(() => {
    const q = draft.trim().toLowerCase()
    return suggestions
      .filter((s) => !tags.includes(s) && (!q || s.toLowerCase().includes(q)))
      .slice(0, 6)
  }, [draft, suggestions, tags])

  const commit = (raw: string) => {
    const tag = raw.trim()
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setDraft('')
  }

  return (
    <div className="rounded-xl border border-line bg-paper-raised p-2 dark:border-dusk-line dark:bg-dusk-raised">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex min-h-8 items-center gap-1 rounded-full bg-terracotta-soft px-2.5 text-sm text-terracotta-deep dark:bg-dusk-line dark:text-dusk-ink"
          >
            #{tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== tag))}
              aria-label={t('common.removeTag', { tag })}
              className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-full hover:bg-paper/60 dark:hover:bg-dusk"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              commit(draft)
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              onChange(tags.slice(0, -1))
            }
          }}
          placeholder={t('form.tagPlaceholder')}
          className="min-h-8 min-w-28 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-ink-soft/60 dark:placeholder:text-dusk-soft/60"
        />
      </div>
      {draft && matches.length > 0 && (
        <ul className="mt-1.5 flex flex-wrap gap-1.5 border-t border-line pt-2 dark:border-dusk-line">
          {matches.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => commit(s)}
                className="min-h-8 rounded-full border border-line px-2.5 text-sm text-ink-soft dark:border-dusk-line dark:text-dusk-soft"
              >
                #{s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
