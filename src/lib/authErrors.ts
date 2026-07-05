// Маппинг сырых ошибок Supabase (англ.) в локализуемые i18n-ключи с подсказкой.
// Возвращает ключ из namespace settings.*; неизвестное — settings.authError.
export function authErrorKey(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login') || m.includes('invalid credentials'))
    return 'settings.errWrongCreds'
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already'))
    return 'settings.errEmailTaken'
  if (m.includes('password') && (m.includes('at least') || m.includes('short') || m.includes('6')))
    return 'settings.errWeakPassword'
  if (m.includes('email') && (m.includes('invalid') || m.includes('valid')))
    return 'settings.errBadEmail'
  if (
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('failed to') ||
    m.includes('timeout') ||
    m.includes('offline')
  )
    return 'settings.errNetwork'
  if (m.includes('rate limit') || m.includes('too many'))
    return 'settings.errRateLimit'
  return 'settings.authError'
}
