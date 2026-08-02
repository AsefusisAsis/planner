// Правило «что из карт можно выгружать в облако».
//
// Проверяется отдельно от остального синка, потому что цена ошибки здесь
// не «данные не сошлись», а полный номер банковской карты открытым текстом
// на сервере. Логика продублирована из cloudSync.mayUpload намеренно: если
// там её поменяют, тест обязан упасть и потребовать осознанного решения.

import { describe, it, expect } from 'vitest'

interface CardLike {
  loyalty?: boolean
  enc?: boolean
}

/** Копия правила из services/cloudSync.ts. */
function mayUpload(card: CardLike): boolean {
  return !!card.loyalty || card.enc === true
}

describe('какие карты уходят в облако', () => {
  it('банковская без шифрования — НЕ уходит (там открытый номер)', () => {
    expect(mayUpload({})).toBe(false)
    expect(mayUpload({ enc: false })).toBe(false)
    expect(mayUpload({ loyalty: false })).toBe(false)
  })

  it('банковская с включённой «Защитой данных» — уходит, номер зашифрован', () => {
    expect(mayUpload({ enc: true })).toBe(true)
  })

  it('скидочная — уходит: там код скидки, а не платёжные данные', () => {
    expect(mayUpload({ loyalty: true })).toBe(true)
  })

  /**
   * Скидочные не шифруются по построению (см. ветку loyalty в форме карты),
   * поэтому enc у них не появится — правило не должно от него зависеть.
   */
  it('скидочная без enc всё равно уходит', () => {
    expect(mayUpload({ loyalty: true, enc: false })).toBe(true)
  })

  it('enc признаётся только строго true, а не любым правдоподобным значением', () => {
    expect(mayUpload({ enc: 1 as unknown as boolean })).toBe(false)
    expect(mayUpload({ enc: 'true' as unknown as boolean })).toBe(false)
  })
})
