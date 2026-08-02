// Публичный адрес сайта и построение ссылок на его статические страницы.
//
// Здесь он записан ОДИН раз. Раньше домен был захардкожен в двух ссылках
// настроек, а письмо о смене пароля собирало адрес из window.location —
// и в APK это давало неработающую ссылку (см. resetRedirectUrl).

/** Куда задеплоен веб: GitHub Pages, проект в подпути /planner/. */
export const PUBLIC_SITE = 'https://asefusisasis.github.io/planner/'

/**
 * Адрес страницы смены пароля для письма Supabase (redirectTo).
 *
 * В ВЕБЕ считается от текущего origin: так одинаково работает и на GitHub
 * Pages с подпутём, и на локальном превью, и с любого форка — домен в коде
 * не нужен.
 *
 * В ПРИЛОЖЕНИИ так нельзя. Страница живёт внутри WebView, и origin там —
 * https://localhost (Capacitor, androidScheme по умолчанию https). Письмо
 * уходило со ссылкой на localhost, которая на телефоне никуда не ведёт:
 * восстановление пароля из APK было сломано целиком. Публичного origin у
 * нативной сборки просто нет, брать его неоткуда — поэтому здесь
 * единственный случай, когда адрес берётся из константы.
 *
 * Этот же адрес должен быть в Supabase → Authentication → URL Configuration
 * → Redirect URLs, иначе переход по ссылке отклоняется.
 */
export function resetRedirectUrl(opts: {
  native: boolean
  origin: string
  pathname: string
}): string {
  if (opts.native) return `${PUBLIC_SITE}reset-password.html`
  // отбрасываем имя файла, оставляя каталог: /planner/index.html → /planner/
  const dir = opts.pathname.replace(/[^/]*$/, '')
  return `${opts.origin}${dir}reset-password.html`
}
