import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

/**
 * QR как самодостаточный SVG (без canvas, чётко масштабируется, работает
 * офлайн в APK). Тёмные модули — цветом текста, фон — белый: аутентификаторы
 * ждут высокий контраст, поэтому НЕ красим фон темой (белый в любой теме).
 */
export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c},${r}h1v1h-1z`
      }
    }
    return { path: d, count: n }
  }, [value])

  const quiet = 2 // тихая зона (модулей) вокруг кода — требование стандарта
  const vb = count + quiet * 2
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vb} ${vb}`}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR"
      style={{ background: '#fff', borderRadius: 8 }}
    >
      <path d={path} transform={`translate(${quiet},${quiet})`} fill="#111" />
    </svg>
  )
}
