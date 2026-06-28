// ============================================================
// Шифрование номеров карт под мастер-пароль (Web Crypto).
// PBKDF2(SHA-256) -> AES-GCM 256. Ключ держим только в памяти сессии.
// ============================================================

const enc = new TextEncoder()
const dec = new TextDecoder()
const CHECK_TEXT = 'planner-card-lock-v1'

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function genSalt(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations: 150_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptStr(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
  return `${toB64(iv)}:${toB64(ct)}`
}

export async function decryptStr(key: CryptoKey, blob: string): Promise<string> {
  const [ivB, ctB] = blob.split(':')
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB) },
    key,
    fromB64(ctB),
  )
  return dec.decode(pt)
}

export async function makeCheck(key: CryptoKey): Promise<string> {
  return encryptStr(key, CHECK_TEXT)
}

export async function verifyKey(key: CryptoKey, check: string): Promise<boolean> {
  try {
    return (await decryptStr(key, check)) === CHECK_TEXT
  } catch {
    return false
  }
}

// ---- ключ сессии (только в памяти) ----
let sessionKey: CryptoKey | null = null
export function setSessionKey(k: CryptoKey | null) {
  sessionKey = k
}
export function getSessionKey(): CryptoKey | null {
  return sessionKey
}
