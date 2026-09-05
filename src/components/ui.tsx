import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconBack, IconChevronDown } from './icons'

/** Small chip used for reasons/tags/filters — always also text, never color-only (spec §7 A11y). */
export function Chip({
  active,
  onClick,
  children,
  className = '',
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center gap-1 rounded-full px-3.5 py-1.5 text-sm transition-all active:scale-95 ${
        active
          ? 'btn-cobalt font-medium'
          : 'glass-soft text-ink hover:brightness-[1.03] dark:text-dusk-ink'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function PageHeader({
  title,
  onBack,
  action,
}: {
  title: string
  onBack?: () => void
  action?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <header className="flex min-h-12 items-center gap-2 py-1">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={t('common.back')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft transition-all hover:bg-cobalt-soft/60 active:scale-95 dark:text-dusk-soft dark:hover:bg-dusk-line/60"
        >
          <IconBack />
        </button>
      )}
      <h1 className="flex-1 truncate font-display text-xl font-semibold tracking-[-0.025em] [font-stretch:110%]">{title}</h1>
      {action}
    </header>
  )
}

export function GhostButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-paper-raised/40 px-4 py-2 text-sm font-medium text-ink shadow-[inset_0_0_0_1px_var(--hairline)] transition-all hover:bg-paper-raised/70 active:scale-[0.97] disabled:opacity-50 dark:bg-dusk-raised/40 dark:text-dusk-ink dark:hover:bg-dusk-raised/70 ${className}`}
    />
  )
}

export function PrimaryButton({
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`btn-cobalt inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-50 ${className}`}
    />
  )
}

/* Fields are hairline wells, not second glass layers — they sit ON glass
   section plates (nested glassmorphism reads as mud). Keyboard focus keeps
   the global 2px outline; the cobalt inset ring is the touch-state layer. */
export const fieldClass =
  'w-full min-w-0 min-h-11 rounded-xl bg-paper-raised/45 px-3.5 py-2.5 text-base text-ink shadow-[inset_0_0_0_1px_var(--hairline)] placeholder:text-ink-soft transition-shadow focus-visible:outline-2 focus-visible:outline-cobalt dark:focus-visible:outline-cobalt-lift focus:shadow-[inset_0_0_0_1.5px_var(--color-cobalt),0_1px_6px_rgb(33_72_184/18%)] dark:bg-dusk/45 dark:text-dusk-ink dark:placeholder:text-dusk-soft dark:focus:shadow-[inset_0_0_0_1.5px_var(--color-cobalt-lift),0_1px_6px_rgb(147_171_242/18%)]'

export function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft dark:text-dusk-soft">
        {label}
      </span>
      {children}
    </label>
  )
}

/** Card-style section used by the record form and settings groups. */
export function SectionCard({
  title,
  icon,
  children,
  className = '',
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`glass-soft rounded-[20px] p-4 ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft dark:text-dusk-soft">
        {icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cobalt-soft text-cobalt dark:bg-cobalt-lift/15 dark:text-cobalt-lift [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
        {title}
      </h2>
      {children}
    </section>
  )
}

/** Collapsible card section — progressive disclosure for secondary groups. */
export function DisclosureCard({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string
  icon?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="glass-soft rounded-[20px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 p-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft transition-colors dark:text-dusk-soft"
      >
        {icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cobalt-soft text-cobalt dark:bg-cobalt-lift/15 dark:text-cobalt-lift [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
        <span className="flex-1 text-left">{title}</span>
        <IconChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  )
}
