import { describe, it, expect } from 'vitest'
import { isRecoveryHash } from './recoveryLink'

describe('isRecoveryHash', () => {
  it('обычные маршруты приложения не трогаем', () => {
    for (const h of ['', '#', '#/', '#/expenses', '#/cards', '#/join/abc123']) {
      expect(isRecoveryHash(h)).toBe(false)
    }
  })

  /**
   * Регрессия: такая ссылка открывалась на приложении, hash-роутер не
   * находил маршрута, и экран оставался белым.
   */
  it('успешная ссылка восстановления узнаётся', () => {
    expect(
      isRecoveryHash('#access_token=eyJhbGc.abc&refresh_token=xyz&type=recovery&expires_in=3600'),
    ).toBe(true)
  })

  it('просроченная ссылка тоже узнаётся — иначе тот же белый экран', () => {
    expect(
      isRecoveryHash('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid'),
    ).toBe(true)
  })

  it('токен без type всё равно уводим: это точно не наш маршрут', () => {
    expect(isRecoveryHash('#access_token=eyJhbGc.abc')).toBe(true)
  })

  it('маршрут со словом recovery в пути — не ссылка восстановления', () => {
    expect(isRecoveryHash('#/health/recovery')).toBe(false)
  })
})
