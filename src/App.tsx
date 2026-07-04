import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Layout } from './components/Layout'
import { useStore } from './store'
import { applyTheme } from './lib/theme'
import { closeTopSheet } from './lib/backclose'

import DashboardPage from './modules/dashboard/Page'
import ExpensesPage from './modules/expenses/Page'
import HomePage from './modules/home/Page'
import ShoppingPage from './modules/shopping/Page'
import CalendarPage from './modules/calendar/Page'
import HealthPage from './modules/health/Page'
import CardsPage from './modules/cards/Page'
import SettingsPage from './modules/settings/Page'

export default function App() {
  const init = useStore((s) => s.init)
  const theme = useStore((s) => s.data.settings.theme)
  const language = useStore((s) => s.data.settings.language)
  const { i18n } = useTranslation()

  // первичная загрузка: курсы + синхронизация
  useEffect(() => {
    init()
  }, [init])

  // системная «назад» (Android): закрыть открытый лист → шаг назад по
  // навигации → на главном экране свернуть приложение (не выходить)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = CapApp.addListener('backButton', () => {
      if (closeTopSheet()) return
      const hash = window.location.hash
      const atRoot = !hash || hash === '#' || hash === '#/'
      if (!atRoot && window.history.length > 1) window.history.back()
      else void CapApp.minimizeApp()
    })
    return () => {
      void sub.then((h) => h.remove()).catch(() => {})
    }
  }, [])

  // тема (+ реакция на смену системной)
  useEffect(() => {
    applyTheme(theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  // язык
  useEffect(() => {
    if (i18n.language !== language) i18n.changeLanguage(language)
  }, [language, i18n])

  // периодический pull (каждые 60с) и при возврате фокуса;
  // с аккаунтом — облачный синк, иначе — legacy GitHub
  const syncNow = useStore((s) => s.syncNow)
  const cloudSyncNow = useStore((s) => s.cloudSyncNow)
  const configured = useStore((s) => s.sync.configured)
  const hasAccount = useStore((s) => !!s.account)
  useEffect(() => {
    if (!configured && !hasAccount) return
    const tick = () => (hasAccount ? cloudSyncNow() : syncNow())
    const id = setInterval(tick, 60_000)
    window.addEventListener('focus', tick)
    // натив: возврат Activity из фона не диспатчит window 'focus' в WebView —
    // синкаем по нативному appStateChange, иначе свежие данные ждут интервал
    const nativeSub = Capacitor.isNativePlatform()
      ? CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) tick()
        })
      : null
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', tick)
      if (nativeSub) void nativeSub.then((h) => h.remove()).catch(() => {})
    }
  }, [configured, hasAccount, syncNow, cloudSyncNow])

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="shopping" element={<ShoppingPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="cards" element={<CardsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
