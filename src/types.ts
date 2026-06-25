// ============================================================
// Модель данных. AppData — это то, что синхронизируется в data.json.
// Токен GitHub сюда НЕ входит — он хранится только локально (см. lib/localConfig).
// ============================================================

export type Currency = 'BYN' | 'USD' | 'RUB'
export const CURRENCIES: Currency[] = ['BYN', 'USD', 'RUB']

export type ThemeMode = 'light' | 'dark' | 'system'
export type Language = 'ru' | 'en'

// ---------- Траты ----------
export interface ExpenseCategory {
  id: string
  name: string
  color: string
  /** Месячный бюджет в базовой валюте (необязательно) */
  budget?: number
}

export interface Expense {
  id: string
  amount: number
  currency: Currency
  categoryId: string | null
  note: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  createdAt: string
}

// ---------- Задачи по дому ----------
export type Priority = 'low' | 'medium' | 'high'
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly'

export interface HomeTask {
  id: string
  title: string
  done: boolean
  priority: Priority
  recurrence: Recurrence
  /** ISO-дата YYYY-MM-DD, необязательно */
  dueDate?: string
  createdAt: string
  completedAt?: string
}

// ---------- Покупки ----------
export interface ShoppingItem {
  id: string
  name: string
  qty: number
  price?: number
  currency?: Currency
  bought: boolean
}

export interface ShoppingList {
  id: string
  name: string
  items: ShoppingItem[]
  createdAt: string
}

// ---------- Календарь (микро-задачи + heatmap) ----------
export interface CalendarTask {
  id: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  title: string
  done: boolean
  createdAt: string
  completedAt?: string
}

// ---------- Настройки (синхронизируемые) ----------
export interface Settings {
  theme: ThemeMode
  language: Language
  baseCurrency: Currency
}

// ---------- Весь документ ----------
export interface AppData {
  /** Версия схемы для будущих миграций */
  version: number
  expenses: Expense[]
  expenseCategories: ExpenseCategory[]
  homeTasks: HomeTask[]
  shoppingLists: ShoppingList[]
  calendarTasks: CalendarTask[]
  settings: Settings
  /** ISO-таймстамп последнего изменения — основа слияния */
  updatedAt: string
}

export const SCHEMA_VERSION = 1

export function createEmptyData(): AppData {
  return {
    version: SCHEMA_VERSION,
    expenses: [],
    expenseCategories: [
      { id: 'cat-food', name: 'Еда', color: '#22c55e' },
      { id: 'cat-home', name: 'Дом', color: '#6366f1' },
      { id: 'cat-transport', name: 'Транспорт', color: '#f59e0b' },
      { id: 'cat-fun', name: 'Развлечения', color: '#ec4899' },
    ],
    homeTasks: [],
    shoppingLists: [],
    calendarTasks: [],
    settings: {
      theme: 'system',
      language: 'ru',
      baseCurrency: 'BYN',
    },
    updatedAt: new Date().toISOString(),
  }
}
