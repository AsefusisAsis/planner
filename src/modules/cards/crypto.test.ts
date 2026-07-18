import { describe, it, expect } from 'vitest'
import { deriveKey, encryptStr, decryptStr, genSalt } from './crypto'

// раундтрип шифрования — той же схемой шифруется cycleLog для GitHub-синка
describe('crypto (AES-GCM под мастер-пароль)', () => {
  it('encrypt → decrypt возвращает исходный JSON', async () => {
    const salt = genSalt()
    const key = await deriveKey('пароль-123', salt, 1000)
    const payload = JSON.stringify([{ id: 'c1', date: '2026-07-01', period: true, mood: 'good' }])
    const blob = await encryptStr(key, payload)
    expect(blob).not.toContain('2026-07-01') // в блобе нет открытого текста
    expect(await decryptStr(key, blob)).toBe(payload)
  })

  it('чужой ключ не расшифровывает', async () => {
    const salt = genSalt()
    const key1 = await deriveKey('пароль-123', salt, 1000)
    const key2 = await deriveKey('другой-пароль', salt, 1000)
    const blob = await encryptStr(key1, '{"secret":1}')
    await expect(decryptStr(key2, blob)).rejects.toThrow()
  })

  it('каждый вызов шифрования даёт разный блоб (случайный IV)', async () => {
    const key = await deriveKey('пароль-123', genSalt(), 1000)
    const a = await encryptStr(key, 'same')
    const b = await encryptStr(key, 'same')
    expect(a).not.toBe(b)
  })
})
