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
      className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3.5 py-1.5 text-sm transition-all active:scale-95 ${
        active
          ? 'bg-terracotta text-paper shadow-sm shadow-terracotta/30'
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
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 bg-paper/85 px-2 py-2 backdrop-blur-xl dark:bg-dusk/85">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-terracotta-soft/60 active:scale-95 dark:text-dusk-soft dark:hover:bg-dusk-line/60"
        >
          <IconBack />
        </button>
      )}
      <h1 className="flex-1 truncate text-xl font-semibold tracking-tight">{title}</h1>
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-all hover:bg-terracotta-soft/50 active:scale-[0.97] disabled:opacity-50 dark:border-dusk-line dark:text-dusk-ink dark:hover:bg-dusk-line/50 ${className}`}
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-terracotta to-terracotta-deep px-4 py-2.5 text-sm font-semibold text-paper shadow-md shadow-terracotta/25 transition-all hover:brightness-105 active:scale-[0.97] disabled:opacity-50 dark:shadow-terracotta/10 ${className}`}
    />
  )
}

export const fieldClass =
  'w-full min-w-0 min-h-11 rounded-xl border border-line bg-paper-raised px-3.5 py-2.5 text-base text-ink placeholder:text-ink-soft/60 focus:border-terracotta focus:outline-none dark:border-dusk-line dark:bg-dusk-raised dark:text-dusk-ink dark:placeholder:text-dusk-soft/60'

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
      <span className="mb-1.5 block text-sm font-medium text-ink-soft dark:text-dusk-soft">
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
}: {
  title: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl bg-paper-raised p-4 ring-1 ring-line dark:bg-dusk-raised dark:ring-dusk-line">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-soft dark:text-dusk-soft">
        {icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-terracotta-soft text-terracotta dark:bg-dusk-line dark:text-dusk-ink [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
        {title}
      </h2>
      {children}
    </section>
  )
}
