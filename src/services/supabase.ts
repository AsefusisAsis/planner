import { createClient } from '@supabase/supabase-js'

// Публичные реквизиты проекта. Anon-ключ БЕЗОПАСЕН в клиенте и в репозитории:
// доступ к данным ограничен RLS-политиками — каждый видит только свои записи.
// Секретные ключи (service_role) сюда попадать не должны никогда.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://oaiqwcorpjigmpbkjpqe.supabase.co'
const KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_NZIUZyNxzmVxWV2amgkNQg_mg0XMnTU'

export const supabase = createClient(URL, KEY, {
  auth: {
    // сессия живёт в localStorage WebView и переживает перезапуск,
    // токен обновляется в фоне
    persistSession: true,
    autoRefreshToken: true,
    // внешних redirect-потоков нет (email-confirm выключен), а с HashRouter
    // разбор #access_token сломал бы маршрут — отключаем
    detectSessionInUrl: false,
  },
  global: {
    // таймаут на все запросы синка: без него «зависшая» сеть (captive portal,
    // half-open сокет) оставляла бы status:'syncing' навсегда — кнопка синка
    // заблокирована, восстановление только перезапуском. При таймауте fetch
    // реджектится → существующий catch ставит error/offline, синк разблокирован
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
  },
})
