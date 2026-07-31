import { describe, it, expect } from 'vitest'
import { addressFamily, checkAddress, shortAddress, NETWORKS_FOR_COIN } from './cryptoAddress'

// Реальные по формату адреса (публичные примеры из документации сетей).
const EVM = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
const TRON = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'
const BTC_LEGACY = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
const BTC_BECH32 = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'
const TON_ADDR = 'UQAvDfWFG0oYX19jwNDNBBL1rKNT9XfaGP9HyTb5nb2Eml6y'
const LTC = 'LZone2ELgHnFxYnpBERGWMWmMt1nQrpVdM'
const DOGE = 'DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L'
const XRP = 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH'

describe('addressFamily — определяем только то, в чём уверены', () => {
  it('EVM-адрес', () => expect(addressFamily(EVM)).toBe('evm'))
  it('Tron', () => expect(addressFamily(TRON)).toBe('tron'))
  it('Bitcoin legacy и bech32', () => {
    expect(addressFamily(BTC_LEGACY)).toBe('btc')
    expect(addressFamily(BTC_BECH32)).toBe('btc')
  })
  it('TON', () => expect(addressFamily(TON_ADDR)).toBe('ton'))
  it('Litecoin', () => expect(addressFamily(LTC)).toBe('ltc'))
  it('Dogecoin', () => expect(addressFamily(DOGE)).toBe('doge'))
  it('XRP', () => expect(addressFamily(XRP)).toBe('xrp'))

  it('адрес с «3» не относим ни к чему: так бывает и у Bitcoin, и у Litecoin', () => {
    expect(addressFamily('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBeNull()
  })
  it('незнакомый формат — null, а не догадка', () => {
    expect(addressFamily('какая-то строка')).toBeNull()
    expect(addressFamily('')).toBeNull()
  })
  it('пробелы по краям не мешают', () => {
    expect(addressFamily(`  ${EVM}  `)).toBe('evm')
  })
})

describe('checkAddress — защита от перевода не в ту сеть', () => {
  it('совпадение сети и формата', () => {
    expect(checkAddress(TRON, 'TRON')).toEqual({ status: 'ok' })
    expect(checkAddress(EVM, 'ETH')).toEqual({ status: 'ok' })
    expect(checkAddress(BTC_BECH32, 'BTC')).toEqual({ status: 'ok' })
  })

  it('ГЛАВНЫЙ СЛУЧАЙ: адрес ERC20, а выбран TRC20', () => {
    expect(checkAddress(EVM, 'TRON')).toEqual({ status: 'mismatch', looksLike: 'evm' })
  })
  it('обратный случай: адрес TRC20, а выбран ERC20', () => {
    expect(checkAddress(TRON, 'ETH')).toEqual({ status: 'mismatch', looksLike: 'tron' })
  })
  it('биткоин-адрес в сети Tron', () => {
    expect(checkAddress(BTC_BECH32, 'TRON')).toEqual({ status: 'mismatch', looksLike: 'btc' })
  })

  it('ETH и BSC не различаются по адресу — ложной тревоги быть не должно', () => {
    // один и тот же адрес валиден в обеих EVM-сетях; сказать «ошибка»
    // здесь значило бы соврать
    expect(checkAddress(EVM, 'BSC')).toEqual({ status: 'ok' })
    expect(checkAddress(EVM, 'ETH')).toEqual({ status: 'ok' })
  })

  it('сеть «Другая» — не с чем сверять, молчим', () => {
    expect(checkAddress(EVM, 'OTHER')).toEqual({ status: 'unknown' })
  })
  it('незнакомый формат не объявляем ошибкой', () => {
    expect(checkAddress('SoLaNaLiKeStRiNg123456789', 'SOL')).toEqual({ status: 'unknown' })
  })
  it('пустая строка — отдельный статус, не ошибка', () => {
    expect(checkAddress('   ', 'TRON')).toEqual({ status: 'empty' })
  })
})

describe('подсказка сетей по монете', () => {
  it('у USDT сетей несколько — это и есть источник ошибок', () => {
    expect(NETWORKS_FOR_COIN.USDT).toContain('TRON')
    expect(NETWORKS_FOR_COIN.USDT).toContain('ETH')
    expect(NETWORKS_FOR_COIN.USDT.length).toBeGreaterThan(1)
  })
  it('у биткоина сеть одна', () => {
    expect(NETWORKS_FOR_COIN.BTC).toEqual(['BTC'])
  })
})

describe('shortAddress', () => {
  it('длинный адрес сокращается с обеих сторон', () => {
    const s = shortAddress(EVM)
    expect(s.startsWith('0x742d')).toBe(true)
    expect(s.endsWith('38f44e')).toBe(true)
    expect(s).toContain('…')
  })
  it('короткую строку не трогаем', () => {
    expect(shortAddress('abc')).toBe('abc')
  })
})
