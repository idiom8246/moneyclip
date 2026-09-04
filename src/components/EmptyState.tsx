import type { ReactNode } from 'react'

export type EmptyStateKind =
  | 'invoices'
  | 'saved'
  | 'search'
  | 'reports'
  | 'inventory'
  | 'dossier'
  | 'store'
  | 'trip'
  | 'list'

function Symbol({ kind }: { kind: EmptyStateKind }) {
  if (kind === 'search') {
    return (
      <>
        <circle cx="82" cy="57" r="19" />
        <path d="m96 71 18 18" />
        <path d="M71 56h22M82 45v22" opacity=".34" />
      </>
    )
  }
  if (kind === 'reports') {
    return (
      <>
        <path d="M58 82V66h13v16M79 82V48h13v34M100 82V35h13v47" />
        <path d="M54 82h64" />
      </>
    )
  }
  if (kind === 'inventory') {
    return (
      <>
        <path d="M58 47h50v37H58zM58 60h50M78 47v13" />
        <path d="M69 71h28" opacity=".42" />
      </>
    )
  }
  if (kind === 'store') {
    return (
      <>
        <path d="M55 52h58l-5-14H60zM60 52v32h48V52M75 84V66h18v18" />
        <path d="M55 52c0 7 10 7 10 0 0 7 10 7 10 0 0 7 10 7 10 0 0 7 10 7 10 0 0 7 10 7 10 0" />
      </>
    )
  }
  if (kind === 'trip') {
    return (
      <>
        <path d="M60 49h49v35H60zM75 49v-8c0-4 3-7 7-7h5c4 0 7 3 7 7v8" />
        <path d="M60 61h49M71 58v9M98 58v9" />
      </>
    )
  }
  if (kind === 'dossier') {
    return (
      <>
        <path d="M56 80h58M60 74l14-13 13 7 20-25" />
        <circle cx="60" cy="74" r="3" fill="currentColor" stroke="none" />
        <circle cx="74" cy="61" r="3" fill="currentColor" stroke="none" />
        <circle cx="87" cy="68" r="3" fill="currentColor" stroke="none" />
        <circle cx="107" cy="43" r="3" fill="currentColor" stroke="none" />
      </>
    )
  }
  if (kind === 'saved') {
    return (
      <>
        <path d="M65 35h39v52L84.5 75 65 87z" />
        <path d="M74 47h21M74 56h16" opacity=".4" />
      </>
    )
  }
  if (kind === 'list') {
    return (
      <>
        <path d="M63 43h43v43H63z" />
        <path d="m70 55 4 4 7-8M86 56h13M70 70l4 4 7-8M86 71h13" />
      </>
    )
  }
  return (
    <>
      <path d="M62 33h45v56H62z" />
      <path d="M70 47h29M70 57h23M70 67h29M70 77h17" opacity=".45" />
      <path d="M104 30c9-7 18 5 11 12l-19 19c-5 5-13-3-8-8l17-17" />
    </>
  )
}

function EmptyArtwork({ kind }: { kind: EmptyStateKind }) {
  return (
    <svg
      viewBox="0 0 168 124"
      className="h-32 w-44 text-cobalt dark:text-cobalt-lift"
      aria-hidden="true"
    >
      <defs>
        <pattern id={`dots-${kind}`} width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".8" fill="currentColor" opacity=".18" />
        </pattern>
      </defs>
      <rect x="31" y="15" width="111" height="88" rx="10" transform="rotate(5 86 59)" fill="currentColor" opacity=".08" />
      <rect x="22" y="18" width="118" height="86" rx="10" transform="rotate(-4 81 61)" fill="var(--glass-bg-deep)" stroke="currentColor" strokeWidth="2" opacity=".9" />
      <rect x="28" y="25" width="106" height="72" rx="6" transform="rotate(-4 81 61)" fill={`url(#dots-${kind})`} />
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <Symbol kind={kind} />
      </g>
      <path d="M38 104c26 7 66 8 95-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".2" />
    </svg>
  )
}

export function EmptyState({
  kind,
  title,
  body,
  action,
  compact = false,
}: {
  kind: EmptyStateKind
  title: string
  body?: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <section className={`flex flex-col items-center text-center ${compact ? 'px-5 py-8' : 'px-5 py-12'}`}>
      <EmptyArtwork kind={kind} />
      <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">{title}</h2>
      {body && <p className="mt-1 max-w-[18rem] text-sm leading-6 text-ink-soft dark:text-dusk-soft">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </section>
  )
}
