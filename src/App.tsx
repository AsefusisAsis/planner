import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Layout } from './components/Layout'
import { useStore } from './store'
import { applyTheme } from './lib/theme'

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

  // периодический pull (каждые 60с) и при возврате фокуса
  const syncNow = useStore((s) => s.syncNow)
  const configured = useStore((s) => s.sync.configured)
  useEffect(() => {
    if (!configured) return
    const id = setInterval(() => syncNow(), 60_000)
    const onFocus = () => syncNow()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [configured, syncNow])

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ExpensesPage />} />
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
