import { describe, it, expect } from 'vitest'
import { cardCodeView, cardCodeFields } from './cardCode'

describe('cardCodeView — совместимость со старыми картами', () => {
  /**
   * Карты, заведённые до появления QR, поля codeView не имеют. Они должны
   * показываться ровно так же, как показывались.
   */
  it('нет нового поля и barcode не задан — штрихкод, как было по умолчанию', () => {
    expect(cardCodeView({})).toBe('barcode')
  })

  it('нет нового поля, barcode: true — штрихкод', () => {
    expect(cardCodeView({ barcode: true })).toBe('barcode')
  })

  it('нет нового поля, barcode: false — только цифры', () => {
    expect(cardCodeView({ barcode: false })).toBe('none')
  })

  it('новое поле важнее старого, даже если они спорят', () => {
    expect(cardCodeView({ codeView: 'qr', barcode: true })).toBe('qr')
    expect(cardCodeView({ codeView: 'none', barcode: true })).toBe('none')
    expect(cardCodeView({ codeView: 'barcode', barcode: false })).toBe('barcode')
  })
})

describe('cardCodeFields — что записываем в карту', () => {
  it('пишет оба поля: старое нужно устройствам на прежней сборке', () => {
    expect(cardCodeFields('barcode')).toEqual({ codeView: 'barcode', barcode: true })
    expect(cardCodeFields('none')).toEqual({ codeView: 'none', barcode: false })
  })

  /**
   * У QR старое булево остаётся true: на старой сборке карта покажется
   * штрихкодом. Не тот тип кода, зато не пустота, и номер под ним тот же.
   */
  it('QR оставляет старое булево включённым — иначе на старой сборке будет пусто', () => {
    expect(cardCodeFields('qr')).toEqual({ codeView: 'qr', barcode: true })
  })

  it('запись и чтение сходятся друг с другом', () => {
    for (const v of ['barcode', 'qr', 'none'] as const) {
      expect(cardCodeView(cardCodeFields(v))).toBe(v)
    }
  })
})
