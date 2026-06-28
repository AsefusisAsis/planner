// ============================================================
// Определение платёжной системы по номеру (по диапазонам IIN/BIN),
// форматирование и маскирование номера, пресеты градиентов.
// ============================================================

export type Brand =
  | 'visa'
  | 'mastercard'
  | 'mir'
  | 'amex'
  | 'unionpay'
  | 'maestro'
  | 'discover'
  | 'unknown'

export function digitsOf(number: string): string {
  return number.replace(/\D/g, '')
}

export function detectBrand(number: string): Brand {
  const n = digitsOf(number)
  if (!n) return 'unknown'
  if (/^4/.test(n)) return 'visa'
  if (/^3[47]/.test(n)) return 'amex'
  if (/^220[0-4]/.test(n)) return 'mir'
  if (/^(5[1-5]|2(22[1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))/.test(n)) return 'mastercard'
  if (/^(5018|5020|5038|56|57|58|6304|6759|676[1-3])/.test(n)) return 'maestro'
  if (/^62/.test(n)) return 'unionpay'
  if (/^(6011|65|64[4-9])/.test(n)) return 'discover'
  return 'unknown'
}

export const BRAND_NAME: Record<Brand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  mir: 'Мир',
  amex: 'Amex',
  unionpay: 'UnionPay',
  maestro: 'Maestro',
  discover: 'Discover',
  unknown: 'Card',
}

/** Группировка номера по 4 (для amex — 4-6-5). */
export function formatNumber(number: string): string {
  const n = digitsOf(number)
  if (detectBrand(n) === 'amex') {
    return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(' ')
  }
  return n.replace(/(.{4})/g, '$1 ').trim()
}

/** Маскированный вид: показываем только последние 4 цифры. */
export function maskNumber(number: string): string {
  const n = digitsOf(number)
  if (n.length <= 4) return n
  const last4 = n.slice(-4)
  const groups = Math.ceil((n.length - 4) / 4)
  return `${Array.from({ length: groups }, () => '••••').join(' ')} ${last4}`
}

export interface GradientPreset {
  key: string
  css: string
}

export const GRADIENTS: GradientPreset[] = [
  { key: 'indigo', css: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' },
  { key: 'slate', css: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)' },
  { key: 'emerald', css: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' },
  { key: 'rose', css: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)' },
  { key: 'amber', css: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' },
  { key: 'sky', css: 'linear-gradient(135deg, #0284c7 0%, #1e40af 100%)' },
  { key: 'fuchsia', css: 'linear-gradient(135deg, #c026d3 0%, #7e22ce 100%)' },
  { key: 'graphite', css: 'linear-gradient(135deg, #525252 0%, #171717 100%)' },
]

export function gradientCss(key: string): string {
  return (GRADIENTS.find((g) => g.key === key) ?? GRADIENTS[0]).css
}
