import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconBack } from './icons'

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
      className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? 'bg-terracotta text-paper'
          : 'bg-terracotta-soft/60 text-ink hover:bg-terracotta-soft dark:bg-dusk-line/60 dark:text-dusk-ink dark:hover:bg-dusk-line'
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
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 bg-paper/95 px-2 py-2 backdrop-blur dark:bg-dusk/95">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-terracotta-soft/60 dark:text-dusk-soft dark:hover:bg-dusk-line/60"
        >
          <IconBack />
        </button>
      )}
      <h1 className="flex-1 text-xl font-semibold">{title}</h1>
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-terracotta-soft/50 disabled:opacity-50 dark:border-dusk-line dark:text-dusk-ink dark:hover:bg-dusk-line/50 ${className}`}
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-terracotta px-4 py-2.5 text-sm font-semibold text-paper transition-colors hover:bg-terracotta-deep disabled:opacity-50 ${className}`}
    />
  )
}

export const fieldClass =
  'w-full min-h-11 rounded-xl border border-line bg-paper-raised px-3.5 py-2.5 text-base text-ink placeholder:text-ink-soft/60 focus:border-terracotta focus:outline-none dark:border-dusk-line dark:bg-dusk-raised dark:text-dusk-ink dark:placeholder:text-dusk-soft/60'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-soft dark:text-dusk-soft">
        {label}
      </span>
      {children}
    </label>
  )
}
