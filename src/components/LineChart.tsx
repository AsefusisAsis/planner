// Лёгкий SVG-линейный график без внешних зависимостей.
// Тема — через CSS-переменные. Подходит для прогресса веса.

interface Point {
  /** подпись по оси X (например, дата) */
  label: string
  value: number
}

export function LineChart({
  data,
  goal,
  unit = '',
  height = 160,
}: {
  data: Point[]
  goal?: number
  unit?: string
  height?: number
}) {
  const W = 320
  const H = height
  const padL = 34
  const padR = 10
  const padT = 12
  const padB = 22

  if (data.length === 0) {
    return null
  }

  const values = data.map((d) => d.value)
  const candidates = goal != null ? [...values, goal] : values
  let min = Math.min(...candidates)
  let max = Math.max(...candidates)
  if (min === max) {
    min -= 1
    max += 1
  }
  const range = max - min
  // небольшой отступ сверху/снизу
  min -= range * 0.1
  max += range * 0.1

  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const x = (i: number) =>
    padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const y = (v: number) => padT + innerH - ((v - min) / (max - min)) * innerH

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`)
    .join(' ')

  const areaPath =
    `${linePath} L ${x(data.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)}` +
    ` L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="График">
      {/* сетка: верх/низ */}
      {[max, (max + min) / 2, min].map((v, idx) => (
        <g key={idx}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--border)"
            strokeWidth="1"
          />
          <text x="2" y={y(v) + 3} fontSize="9" fill="var(--text-3)">
            {v.toFixed(0)}
          </text>
        </g>
      ))}

      {/* линия цели */}
      {goal != null && (
        <line
          x1={padL}
          x2={W - padR}
          y1={y(goal)}
          y2={y(goal)}
          stroke="var(--success)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      )}

      {/* заливка под линией */}
      <path d={areaPath} fill="var(--accent)" opacity="0.12" />
      {/* линия */}
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" />

      {/* точки */}
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r="2.5" fill="var(--accent)" />
      ))}

      {/* подписи краёв по X */}
      <text x={padL} y={H - 6} fontSize="9" fill="var(--text-3)">
        {data[0].label}
      </text>
      {data.length > 1 && (
        <text x={W - padR} y={H - 6} fontSize="9" fill="var(--text-3)" textAnchor="end">
          {data[data.length - 1].label}
        </text>
      )}

      {/* последнее значение */}
      <text
        x={x(data.length - 1)}
        y={y(data[data.length - 1].value) - 6}
        fontSize="10"
        fontWeight="600"
        fill="var(--text)"
        textAnchor="end"
      >
        {data[data.length - 1].value}
        {unit}
      </text>
    </svg>
  )
}
