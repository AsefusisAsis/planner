import { describe, it, expect } from 'vitest'
import { parseNotification } from './notificationParse'

describe('parseNotification / сумма операции, а не остаток', () => {
  it('ГЛАВНАЯ ЛОВУШКА: берётся сумма покупки, а не баланс', () => {
    // в одном уведомлении два числа, и второе — остаток по счёту
    const p = parseNotification('Оплата 45.30 BYN. EUROPT. Карта *1234. Доступно 1200.00 BYN')!
    expect(p.amount).toBe(45.3)
  })

  it('«Баланс» после суммы не путается с суммой', () => {
    const p = parseNotification('Покупка 500.00 RUB Карта *5678 Баланс 12345.67 RUB')!
    expect(p.amount).toBe(500)
  })

  it('«Остаток» тоже распознаётся как баланс', () => {
    const p = parseNotification('Списание 12.50 BYN. Остаток 300.00 BYN')!
    expect(p.amount).toBe(12.5)
  })

  it('если ВСЕ числа — остаток, ничего не выдумываем', () => {
    expect(parseNotification('Баланс 1200.00 BYN')).toBeNull()
  })
})

describe('parseNotification / формат числа', () => {
  it('запятая как десятичный разделитель', () => {
    expect(parseNotification('Оплата 1 250,00 RUB')!.amount).toBe(1250)
  })
  it('разделитель разрядов пробелом', () => {
    expect(parseNotification('Покупка 12 345.67 BYN')!.amount).toBe(12345.67)
  })
  it('целое без дробной части', () => {
    expect(parseNotification('Покупка 500 RUB')!.amount).toBe(500)
  })
})

describe('parseNotification / тип операции', () => {
  it('оплата и покупка — расход', () => {
    expect(parseNotification('Оплата 10 BYN')!.type).toBe('expense')
    expect(parseNotification('Покупка 10 BYN')!.type).toBe('expense')
    expect(parseNotification('Списание 10 BYN')!.type).toBe('expense')
  })
  it('зачисление и пополнение — доход', () => {
    expect(parseNotification('Зачисление 100 BYN')!.type).toBe('income')
    expect(parseNotification('Пополнение 100 BYN')!.type).toBe('income')
  })
  it('неизвестный тип трактуется как расход, но уверенность падает', () => {
    const p = parseNotification('Сумма 10 BYN')!
    expect(p.type).toBe('expense')
    expect(p.confidence).not.toBe('high')
  })
})

describe('parseNotification / валюта', () => {
  it.each([
    ['Оплата 10 BYN', 'BYN'],
    ['Оплата 10 руб.', 'RUB'],
    ['Оплата 10 ₽', 'RUB'],
    ['Оплата 10 USD', 'USD'],
    ['Оплата 10 €', 'EUR'],
    ['Оплата 10 zł', 'PLN'],
  ])('%s → %s', (text, cur) => {
    expect(parseNotification(text)!.currency).toBe(cur)
  })

  it('без валюты — null, а не подстановка наугад', () => {
    expect(parseNotification('Оплата 10')!.currency).toBeNull()
  })

  // Границы слова для кириллицы нельзя задавать через \b: в JS \b считает
  // буквами только [A-Za-z0-9_], поэтому `\bруб` не совпадает никогда.
  // Эти случаи ловят возврат такой ошибки.
  it('кириллический токен в конце строки', () => {
    expect(parseNotification('Оплата 10 руб')!.currency).toBe('RUB')
  })
  it('кириллический токен в начале строки', () => {
    expect(parseNotification('руб 10 списано')!.currency).toBe('RUB')
  })
  it('«бел. руб» — это BYN, а не RUB (порядок проверки)', () => {
    expect(parseNotification('Оплата 10 бел. руб')!.currency).toBe('BYN')
  })
  it('«рубашка» не считается рублями', () => {
    expect(parseNotification('Покупка 10 рубашка')!.currency).toBeNull()
  })
})

describe('parseNotification / карта и магазин', () => {
  it('номер карты не принимается за сумму', () => {
    // «*1234» — это карта; сумма здесь 45.30
    const p = parseNotification('Оплата 45.30 BYN Карта *1234')!
    expect(p.amount).toBe(45.3)
    expect(p.last4).toBe('1234')
  })

  it('магазин по слову-маркеру', () => {
    expect(parseNotification('Оплата 10 BYN, магазин Соседи')!.merchant).toBe('Соседи')
  })

  it('магазин по латинице капсом', () => {
    expect(parseNotification('Оплата 45.30 BYN EUROPT Карта *1234')!.merchant).toBe('EUROPT')
  })

  it('код валюты не принимается за название магазина', () => {
    expect(parseNotification('Оплата 45.30 BYN')!.merchant).toBeNull()
  })
})

describe('parseNotification / уверенность', () => {
  it('сумма + валюта + тип — высокая', () => {
    expect(parseNotification('Оплата 45.30 BYN')!.confidence).toBe('high')
  })
  it('только сумма и валюта — средняя', () => {
    expect(parseNotification('45.30 BYN')!.confidence).toBe('medium')
  })
  it('одна голая сумма — низкая', () => {
    expect(parseNotification('45.30')!.confidence).toBe('low')
  })
})

describe('parseNotification / мусор на вход', () => {
  it('пустая строка', () => {
    expect(parseNotification('')).toBeNull()
    expect(parseNotification('   ')).toBeNull()
  })
  it('текст без чисел', () => {
    expect(parseNotification('Ваш код подтверждения отправлен')).toBeNull()
  })
  it('ноль не считается операцией', () => {
    expect(parseNotification('Оплата 0 BYN')).toBeNull()
  })
})
