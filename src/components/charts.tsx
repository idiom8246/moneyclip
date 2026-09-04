/**
 * Tiny dependency-free charts. Numbers are always mirrored as text — the
 * SVG is decoration, the data must survive without it (a11y).
 */

/* One ink, many densities — the mono-color plate ramp. Slate stands in
   only as the neutral "everything else" step. */
const PIE_COLORS = ['#2148b8', '#17337e', '#4f6fd0', '#93abf2', '#c3d1f6', '#4a5a80']

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
          <circle cx={cx} cy={cx} r={r} fill="var(--chart-hole-soft)" />
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
        {/* donut hole — matches the glass card it sits on */}
        <circle cx={cx} cy={cx} r={r * 0.55} fill="var(--chart-hole)" />
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
          <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-cobalt-soft/60 dark:bg-dusk-line">
            <span
              className="block h-full rounded-full bg-cobalt dark:bg-cobalt-lift"
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

export interface SparkPoint {
  label: string
  value: number
}

/** Compact price-history step line. Min/max numbers remain in the adjacent stat tiles. */
export function PriceSparkline({ points, ariaLabel }: { points: SparkPoint[]; ariaLabel: string }) {
  if (points.length < 2) return null
  const width = 320
  const height = 104
  const padX = 12
  const padY = 12
  const min = Math.min(...points.map((point) => point.value))
  const max = Math.max(...points.map((point) => point.value))
  const range = Math.max(max - min, 1)
  const coords = points.map((point, index) => ({
    ...point,
    x: padX + (index / (points.length - 1)) * (width - padX * 2),
    y: padY + ((max - point.value) / range) * (height - padY * 2),
  }))
  let d = `M ${coords[0].x} ${coords[0].y}`
  for (let index = 1; index < coords.length; index++) {
    const prev = coords[index - 1]
    const point = coords[index]
    const mid = (prev.x + point.x) / 2
    d += ` H ${mid} V ${point.y} H ${point.x}`
  }
  const minIndex = points.findIndex((point) => point.value === min)
  const maxIndex = points.findIndex((point) => point.value === max)

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="h-28 w-full overflow-visible">
        <path d={`M ${padX} ${height - padY} H ${width - padX}`} stroke="var(--hairline)" strokeWidth="1" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-cobalt dark:text-cobalt-lift" />
        {coords.map((point, index) => (
          <circle
            key={`${point.label}-${index}`}
            cx={point.x}
            cy={point.y}
            r={index === minIndex || index === maxIndex ? 4.5 : 2.5}
            fill="var(--chart-hole)"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-cobalt dark:text-cobalt-lift"
          />
        ))}
      </svg>
      <div className="-mt-1 flex justify-between text-[11px] tabular-nums text-ink-soft dark:text-dusk-soft">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}
