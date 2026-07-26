// ============================================================
// «Защита данных» — единый ключ для чувствительных данных (цикл + карты).
// Схема TOTP (как Google Authenticator), решение пользователя 18.07.2026:
//   • секрет (160-бит) генерится приложением, показывается как QR (otpauth://)
//     и base32 — пользователь сканирует его любым аутентификатором;
//   • 6-значный код из аутентификатора — АУТЕНТИФИКАЦИЯ (RFC 6238), не ключ;
//   • КЛЮЧ шифрования (AES-GCM DEK) выводится из СЕКРЕТА через HKDF —
//     поэтому на новое устройство переносится секрет (QR/base32), а не код.
// Здесь — крипто-функции (WebCrypto) и хранение секрета устройства.
// ============================================================

import { hasSecureStore, secureGet, secureSet, secureRemove } from './secureStore'

const enc = new TextEncoder()

// ---- base32 (RFC 4648, без паддинга) — формат секрета TOTP ----
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(s: string): Uint8Array<ArrayBuffer> {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch)
    if (idx === -1) throw new Error('base32: недопустимый символ')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/** Новый TOTP-секрет: 20 случайных байт (160 бит, как в RFC 6238) в base32. */
export function generateSecret(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)))
}

/** otpauth://-URI для QR — понимается Google Authenticator / Aegis / Authy и др. */
export function otpauthUri(secretB32: string, opts?: { label?: string; issuer?: string }): string {
  const issuer = opts?.issuer ?? 'Планировщик'
  const label = opts?.label ?? 'Защита данных'
  const params = new URLSearchParams({
    secret: secretB32,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?${params}`
}

const TOTP_STEP_S = 30
const TOTP_DIGITS = 6

async function hotp(secretBytes: Uint8Array<ArrayBuffer>, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setUint32(0, Math.floor(counter / 2 ** 32))
  view.setUint32(4, counter >>> 0)
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf))
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3]
  return (bin % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0')
}

/** Текущий 6-значный TOTP-код. atMs — для тестов/детерминизма. */
export function totpCode(secretB32: string, atMs: number = Date.now()): Promise<string> {
  const counter = Math.floor(atMs / 1000 / TOTP_STEP_S)
  return hotp(base32Decode(secretB32), counter)
}

/**
 * Проверка кода из аутентификатора с окном ±window шагов (по умолчанию ±2 =
 * терпим рассинхрон часов до ~60с в обе стороны). ±1 (±30с) на реальных
 * телефонах часто мало — код «не подходил» при небольшом уходе часов.
 * Код нормализуется (пробелы).
 */
export async function verifyTotp(
  secretB32: string,
  code: string,
  atMs: number = Date.now(),
  window = 2,
): Promise<boolean> {
  const norm = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(norm)) return false
  const bytes = base32Decode(secretB32)
  const base = Math.floor(atMs / 1000 / TOTP_STEP_S)
  for (let w = -window; w <= window; w++) {
    if ((await hotp(bytes, base + w)) === norm) return true
  }
  return false
}

/** известный открытый текст для проверочного шифротекста Vault.check */
export const VAULT_CHECK = 'planner-vault-check-v1'

// ---- секрет на устройстве (НЕ синкается) ----
// Android: секрет шифруется ключом из Android Keystore (плагин SecureStore),
// в открытом виде на диске его нет. Веб: localStorage — осознанный
// компромисс (см. ROADMAP 8.5: в браузере нет аппаратного хранилища, и там
// TOTP-код — это гейт, а не шифрование хранилища; синк-блобы при этом всё
// равно зашифрованы).
//
// Чтение синхронное (его дёргают селекторы стора), поэтому значение держим
// в памяти, а initDeviceSecret() один раз наполняет кэш при старте.
const SECRET_KEY = 'planner.vault.secret'

let cachedSecret: string | null = null

/** Прочитать секрет из localStorage (веб-хранилище / источник миграции). */
function readLocal(): string | null {
  try {
    return localStorage.getItem(SECRET_KEY)
  } catch {
    return null
  }
}

/**
 * Наполнить кэш секрета при старте приложения. На нативе заодно переносит
 * секрет из localStorage в Keystore (разовая миграция для тех, кто настроил
 * защиту до этой версии) и стирает открытую копию.
 */
export async function initDeviceSecret(): Promise<void> {
  if (!hasSecureStore()) {
    cachedSecret = readLocal()
    return
  }
  const secure = await secureGet(SECRET_KEY)
  if (secure) {
    cachedSecret = secure
    // подчищаем открытую копию, если осталась от прежних версий
    if (readLocal()) localStorage.removeItem(SECRET_KEY)
    return
  }
  const legacy = readLocal()
  if (legacy) {
    // миграция: сначала убеждаемся, что запись в Keystore прошла, и только
    // потом удаляем открытую копию — иначе при сбое остались бы без секрета
    if (await secureSet(SECRET_KEY, legacy)) localStorage.removeItem(SECRET_KEY)
  }
  cachedSecret = legacy
}

export function loadDeviceSecret(): string | null {
  return cachedSecret
}

export async function saveDeviceSecret(secretB32: string): Promise<void> {
  cachedSecret = secretB32
  if (hasSecureStore()) {
    if (await secureSet(SECRET_KEY, secretB32)) return
    // Keystore недоступен (редкий сбой) — не теряем секрет молча:
    // кладём в localStorage, иначе после перезапуска доступ к картам и
    // циклу пропадёт, а расшифровать их будет нечем
    console.warn('[vault] Keystore недоступен, секрет сохранён в localStorage')
  }
  localStorage.setItem(SECRET_KEY, secretB32)
}

export async function clearDeviceSecret(): Promise<void> {
  cachedSecret = null
  localStorage.removeItem(SECRET_KEY)
  await secureRemove(SECRET_KEY)
}

/**
 * DEK (AES-GCM 256) из TOTP-секрета через HKDF-SHA256. Детерминированно:
 * тот же секрет → тот же ключ на любом устройстве, поэтому синк
 * расшифровывается после переноса секрета. Соль пустая осознанно — секрет
 * уже полностью случайный (160 бит), HKDF здесь — доменное разделение.
 */
export async function deriveVaultKey(secretB32: string): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey('raw', base32Decode(secretB32), 'HKDF', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: enc.encode('planner-vault-dek-v1'),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}
