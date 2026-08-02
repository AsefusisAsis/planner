// Ссылка восстановления пароля, пришедшая НА ПРИЛОЖЕНИЕ вместо отдельной
// страницы.
//
// Supabase кладёт токен в hash (#access_token=…&type=recovery). Если такая
// ссылка почему-либо открылась на приложении — например, Supabase откатился
// на Site URL, потому что точного адреса не было в списке Redirect URLs, —
// hash-роутер не находит маршрута, и человек видит БЕЛЫЙ ЭКРАН. Ровно это и
// произошло при первой проверке на устройстве.
//
// Здесь мы такую ссылку узнаём и уводим на reset-password.html вместе с
// токеном. Вызывается ДО старта React, чтобы приложение не успело
// отрисоваться и мигнуть пустотой.

/** Похож ли hash на ссылку восстановления (или на её ошибку)? */
export function isRecoveryHash(hash: string): boolean {
  const h = hash.replace(/^#/, '')
  if (!h) return false
  const p = new URLSearchParams(h)
  // type=recovery есть и в успешной ссылке, и в просроченной (там ещё error).
  // Токен без type тоже уводим: это точно не наш маршрут.
  return p.get('type') === 'recovery' || p.has('access_token') || p.has('error_code')
}

/**
 * Если hash — ссылка восстановления, уходим на страницу смены пароля.
 * Возвращает true, если переход начат (дальше рендерить приложение не надо).
 */
export function redirectRecoveryLink(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash
  if (!isRecoveryHash(hash)) return false
  // baseURI учитывает <base> и подпуть GitHub Pages (/planner/)
  const target = new URL('reset-password.html', document.baseURI)
  window.location.replace(target.href + hash)
  return true
}
