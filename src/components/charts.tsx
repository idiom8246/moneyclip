/**
 * Tiny dependency-free charts. Numbers are always mirrored as text — the
 * SVG is decoration, the data must survive without it (a11y).
 */

const PIE_COLORS = ['#c15e3c', '#a34b2f', '#d9784f', '#78716c', '#57534e', '#e0cfc4']

export interface PieSlice {
  label: string
  value: number
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const startAngle = start * 2 * Math.PI - Math.PI / 2
  const endAngle = end * 2 * Math.PI - Math.PI / 2
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const large = end - start > 0.5 ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
}

export function Pie({
  slices,
  ariaLabel,
  size = 168,
}: {
  slices: PieSlice[]
  ariaLabel: string
  size?: number
}) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const cx = size / 2
  const r = size / 2
  let acc = 0
  return (
    <div className="flex items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
        className="shrink-0"
      >
        {total <= 0 ? (
          <circle cx={cx} cy={cx} r={r} fill="var(--color-terracotta-soft)" />
        ) : (
          slices.map((s, i) => {
            const frac = s.value / total
            const start = acc
            acc += frac
            const d =
              frac >= 0.9999
                ? `<circle cx="${cx}" cy="${cx}" r="${r}"/>`
                : arcPath(cx, cx, r, start, acc)
            return frac <= 0 ? null : (
              <path key={s.label} d={d} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            )
          })
        )}
        {/* donut hole */}
        <circle cx={cx} cy={cx} r={r * 0.55} fill="var(--color-paper-raised)" />
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="shrink-0 tabular-nums text-ink-soft dark:text-dusk-soft">
              {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface BarRow {
  label: string
  value: number
}

export function Bars({ rows, format }: { rows: BarRow[]; format: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate" title={r.label}>{r.label}</span>
          <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-terracotta-soft/60 dark:bg-dusk-line">
            <span
              className="block h-full rounded-full bg-terracotta/80"
              style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }}
            />
          </span>
          <span className="shrink-0 tabular-nums text-xs text-ink-soft dark:text-dusk-soft">
            {format(r.value)}
          </span>
        </li>
      ))}
    </ul>
  )
}
