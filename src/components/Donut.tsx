// Переиспользуемая кольцевая диаграмма (SVG, без зависимостей).
// Сегменты рисуются через stroke-dasharray на окружности.

export interface DonutSegment {
  label: string
  value: number
  color: string
}

export function Donut({
  segments,
  size = 140,
  thickness = 16,
  centerTop,
  centerBottom,
  showLegend = true,
}: {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  centerTop?: string
  centerBottom?: string
  showLegend?: boolean
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  const r = (size - thickness) / 2
  const cx = size / 2
  const c = 2 * Math.PI * r

  let acc = 0
  const arcs =
    total > 0
      ? segments
          .filter((s) => s.value > 0)
          .map((s) => {
            const frac = s.value / total
            const dash = frac * c
            const seg = {
              color: s.color,
              dasharray: `${dash} ${c - dash}`,
              dashoffset: -acc * c,
            }
            acc += frac
            return seg
          })
      : []

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {/* фон-кольцо */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          strokeWidth={thickness}
          style={{ stroke: 'var(--bg-3)' }}
        />
        {/* сегменты */}
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              strokeWidth={thickness}
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.dashoffset}
              strokeLinecap="butt"
              style={{ stroke: a.color }}
            />
          ))}
        </g>
        {(centerTop || centerBottom) && (
          <g>
            {centerTop && (
              <text
                x={cx}
                y={cx - 2}
                textAnchor="middle"
                fontSize="16"
                fontWeight="700"
                fill="var(--text)"
              >
                {centerTop}
              </text>
            )}
            {centerBottom && (
              <text x={cx} y={cx + 14} textAnchor="middle" fontSize="10" fill="var(--text-3)">
                {centerBottom}
              </text>
            )}
          </g>
        )}
      </svg>

      {showLegend && (
        <div className="flex min-w-0 flex-col gap-1.5">
          {segments.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: s.color }}
              />
              <span className="truncate text-[var(--text-2)]">{s.label}</span>
              <span className="ml-auto tabular-nums text-[var(--text)]">
                {total > 0 ? Math.round((s.value / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
