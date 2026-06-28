import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { baseRu, baseEn } from './base'

// Каждый модуль экспортирует { ru, en } со своими строками под собственным ключом.
import expensesI18n from '../modules/expenses/i18n'
import homeI18n from '../modules/home/i18n'
import shoppingI18n from '../modules/shopping/i18n'
import calendarI18n from '../modules/calendar/i18n'
import healthI18n from '../modules/health/i18n'
import cardsI18n from '../modules/cards/i18n'
import dashboardI18n from '../modules/dashboard/i18n'

function deepMerge(target: any, source: any): any {
  const out = { ...target }
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      out[key] = deepMerge(target[key] || {}, source[key])
    } else {
      out[key] = source[key]
    }
  }
  return out
}

const ru = [
  baseRu,
  expensesI18n.ru,
  homeI18n.ru,
  shoppingI18n.ru,
  calendarI18n.ru,
  healthI18n.ru,
  cardsI18n.ru,
  dashboardI18n.ru,
].reduce(deepMerge, {})
const en = [
  baseEn,
  expensesI18n.en,
  homeI18n.en,
  shoppingI18n.en,
  calendarI18n.en,
  healthI18n.en,
  cardsI18n.en,
  dashboardI18n.en,
].reduce(deepMerge, {})

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: 'ru',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
