import { describe, it, expect } from 'vitest'
import { PUBLIC_SITE, resetRedirectUrl } from './publicSite'

describe('resetRedirectUrl', () => {
  it('веб в подпути GitHub Pages: адрес рядом с index', () => {
    expect(
      resetRedirectUrl({
        native: false,
        origin: 'https://asefusisasis.github.io',
        pathname: '/planner/',
      }),
    ).toBe('https://asefusisasis.github.io/planner/reset-password.html')
  })

  it('веб: имя файла в пути отбрасывается, каталог сохраняется', () => {
    expect(
      resetRedirectUrl({
        native: false,
        origin: 'https://asefusisasis.github.io',
        pathname: '/planner/index.html',
      }),
    ).toBe('https://asefusisasis.github.io/planner/reset-password.html')
  })

  it('локальное превью работает без правок', () => {
    expect(
      resetRedirectUrl({ native: false, origin: 'http://localhost:5173', pathname: '/' }),
    ).toBe('http://localhost:5173/reset-password.html')
  })

  /**
   * Регрессия. В APK origin — https://localhost (Capacitor, androidScheme
   * https): собранная от него ссылка вела в никуда, и восстановление пароля
   * из приложения не работало вовсе.
   */
  it('в приложении берётся публичный адрес, а НЕ localhost из WebView', () => {
    const url = resetRedirectUrl({
      native: true,
      origin: 'https://localhost',
      pathname: '/',
    })
    expect(url).toBe(`${PUBLIC_SITE}reset-password.html`)
    expect(url).not.toContain('localhost')
  })

  it('в приложении origin игнорируется, каким бы он ни был', () => {
    expect(
      resetRedirectUrl({ native: true, origin: 'capacitor://localhost', pathname: '/foo/bar.html' }),
    ).toBe(`${PUBLIC_SITE}reset-password.html`)
  })

  it('публичный адрес заканчивается слэшем — иначе склейка даст мусор', () => {
    expect(PUBLIC_SITE.endsWith('/')).toBe(true)
  })
})
