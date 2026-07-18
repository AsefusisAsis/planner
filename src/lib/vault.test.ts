import { describe, it, expect } from 'vitest'
import {
  base32Encode,
  base32Decode,
  generateSecret,
  totpCode,
  verifyTotp,
  deriveVaultKey,
  otpauthUri,
} from './vault'
import { encryptStr, decryptStr } from '../modules/cards/crypto'

const utf8 = (s: string) => new TextEncoder().encode(s)
// секрет из RFC 6238 (ASCII "12345678901234567890" = 20 байт)
const RFC_SECRET_B32 = base32Encode(utf8('12345678901234567890'))

describe('base32 (RFC 4648)', () => {
  it('известный вектор: ASCII 20 байт', () => {
    expect(RFC_SECRET_B32).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  })
  it('roundtrip случайных байт', () => {
    const b = crypto.getRandomValues(new Uint8Array(20))
    expect(Array.from(base32Decode(base32Encode(b)))).toEqual(Array.from(b))
  })
})

describe('TOTP (RFC 6238, SHA-1, 6 цифр)', () => {
  // RFC 6238 Appendix B: T=59s → 8-значный 94287082 → младшие 6 = 287082
  it('известный вектор при T=59с', async () => {
    expect(await totpCode(RFC_SECRET_B32, 59_000)).toBe('287082')
  })
  it('T=1111111109с → 081804', async () => {
    expect(await totpCode(RFC_SECRET_B32, 1_111_111_109_000)).toBe('081804')
  })
  it('verifyTotp принимает свежий код и окно ±1', async () => {
    const t = 1_000_000_000_000
    const code = await totpCode(RFC_SECRET_B32, t)
    expect(await verifyTotp(RFC_SECRET_B32, code, t)).toBe(true)
    // код из соседнего шага (±30с) ещё принимается
    expect(await verifyTotp(RFC_SECRET_B32, code, t + 30_000)).toBe(true)
    // а через 2 шага — уже нет
    expect(await verifyTotp(RFC_SECRET_B32, code, t + 90_000)).toBe(false)
  })
  it('verifyTotp отвергает мусор', async () => {
    expect(await verifyTotp(RFC_SECRET_B32, 'abc', 0)).toBe(false)
    expect(await verifyTotp(RFC_SECRET_B32, '000000', 59_000)).toBe(false)
  })
})

describe('deriveVaultKey (HKDF секрет→DEK)', () => {
  it('детерминирован: тот же секрет → ключ, расшифровывающий чужой шифротекст', async () => {
    const secret = generateSecret()
    const k1 = await deriveVaultKey(secret) // «устройство 1»
    const k2 = await deriveVaultKey(secret) // «устройство 2» после переноса секрета
    const blob = await encryptStr(k1, '{"cycle":"secret-data"}')
    expect(await decryptStr(k2, blob)).toBe('{"cycle":"secret-data"}')
  })
  it('другой секрет → не расшифровывает', async () => {
    const k1 = await deriveVaultKey(generateSecret())
    const k2 = await deriveVaultKey(generateSecret())
    const blob = await encryptStr(k1, 'x')
    await expect(decryptStr(k2, blob)).rejects.toThrow()
  })
})

describe('otpauthUri', () => {
  it('содержит секрет и параметры для аутентификатора', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP')
    expect(uri).toMatch(/^otpauth:\/\/totp\//)
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(uri).toContain('digits=6')
    expect(uri).toContain('period=30')
  })
})
