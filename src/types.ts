// ============================================================
// Модель данных. AppData — это то, что синхронизируется в data.json.
// Токен GitHub сюда НЕ входит — он хранится только локально (см. lib/localConfig).
// ============================================================

export type Currency = 'BYN' | 'USD' | 'RUB' | 'EUR'
export const CURRENCIES: Currency[] = ['BYN', 'USD', 'RUB', 'EUR']

/** Штамп последней правки записи (ISO). Ставится слоем синка автоматически
 *  при каждом изменении; по нему выбирается победитель при конфликте устройств. */
export interface SyncStamp {
  updatedAt?: string
}

export type ThemeMode = 'light' | 'dark' | 'system'
export type Language = 'ru' | 'en'
/** Цветовая палитра (независима от свет/тьмы). */
export type Palette = 'classic' | 'warm' | 'emerald'
export const PALETTES: Palette[] = ['classic', 'warm', 'emerald']

// ---------- Траты ----------
export interface ExpenseCategory extends SyncStamp {
  id: string
  name: string
  color: string
  /** Месячный бюджет (необязательно) */
  budget?: number
  /** Валюта бюджета; отсутствует у старых записей — считается базовой валютой */
  budgetCurrency?: Currency
}

export type TxnType = 'expense' | 'income'

export interface Expense extends SyncStamp {
  id: string
  amount: number
  currency: Currency
  categoryId: string | null
  note: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  createdAt: string
  /** тип записи; отсутствие = 'expense' (обратная совместимость) */
  type?: TxnType
  /** id повторяющегося платежа, из которого создана запись (защита от задвоения) */
  sourceRecurringId?: string
}

export interface RecurringExpense extends SyncStamp {
  id: string
  label: string
  amount: number
  currency: Currency
  categoryId: string | null
  type: TxnType
  /** день месяца 1..28 для начисления */
  dayOfMonth: number
  /** последний применённый месяц 'YYYY-MM' */
  lastAppliedMonth?: string
  createdAt: string
}

// ---------- Задачи по дому ----------
export type Priority = 'low' | 'medium' | 'high'
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly'

export interface TaskStep {
  id: string
  title: string
  done: boolean
}

export interface HomeTask extends SyncStamp {
  id: string
  title: string
  done: boolean
  priority: Priority
  recurrence: Recurrence
  /** ISO-дата YYYY-MM-DD, необязательно */
  dueDate?: string
  createdAt: string
  completedAt?: string
  /** описание (что нужно сделать) */
  description?: string
  /** шаги/подзадачи (как в Basecamp) */
  steps?: TaskStep[]
  /** id следующей копии, порождённой при выполнении повторяющейся задачи
   *  (для отката, если выполнение снято) */
  recurrenceNextId?: string
}

// ---------- Покупки ----------
export interface ShoppingItem {
  id: string
  name: string
  qty: number
  price?: number
  currency?: Currency
  bought: boolean
  /** когда позиция уже проведена в траты (ISO) — защита от повторного проведения */
  exportedAt?: string
}

export interface ShoppingList extends SyncStamp {
  id: string
  name: string
  items: ShoppingItem[]
  createdAt: string
}

// ---------- Календарь (микро-задачи + heatmap) ----------
export interface CalendarTask extends SyncStamp {
  id: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  title: string
  done: boolean
  createdAt: string
  completedAt?: string
  /** время HH:MM (24ч); отсутствует — событие «весь день» */
  time?: string
}

// ---------- Здоровье / похудение ----------
export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Goal = 'lose' | 'maintain' | 'gain'

export interface HealthProfile {
  sex: Sex
  /** лет */
  age: number
  /** см */
  height: number
  /** кг — текущий вес */
  weight: number
  /** кг — целевой вес */
  goalWeight: number
  activity: ActivityLevel
  goal: Goal
  /** темп изменения веса, кг/неделю (0.25..1.0) */
  pace: number
  updatedAt: string
}

export interface WeightEntry extends SyncStamp {
  id: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  /** кг */
  weight: number
}

export interface WaterEntry extends SyncStamp {
  id: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  /** мл */
  ml: number
}

export interface Measurement extends SyncStamp {
  id: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  /** что измеряем, напр. «Талия» */
  label: string
  /** см */
  value: number
}

export interface FoodEntry extends SyncStamp {
  id: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  name: string
  /** граммы порции */
  grams: number
  /** итоговые значения для порции */
  kcal: number
  protein: number
  fat: number
  carbs: number
}

// ---------- Тренировки ----------
export type Equipment =
  | 'bodyweight'
  | 'dumbbell'
  | 'barbell'
  | 'kettlebell'
  | 'bands'
  | 'pullupbar'
  | 'treadmill'
  | 'bike'
  | 'machines'

export interface FitnessPrefs {
  /** доступное оборудование (помимо собственного веса) */
  equipment: Equipment[]
  /** тренировочных дней в неделю (1..6) */
  daysPerWeek: number
}

export interface WorkoutLog extends SyncStamp {
  id: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  /** дома: фокус сессии (fullbody/upper/...); в зале: тип (strength/cardio/trainer/functional) */
  focus: string
  /** место: дома или в зале (по умолчанию home) */
  place?: 'home' | 'gym'
  /** длительность, минут */
  durationMin?: number
  /** потрачено калорий (оценка или вручную) */
  calories?: number
  note?: string
}

export type CycleFlow = 'spotting' | 'light' | 'medium' | 'heavy'
export type CycleMood = 'great' | 'good' | 'ok' | 'low' | 'bad'
/** Запись цикла за день: менструация/поток + симптомы/настроение. */
export interface CycleDayEntry extends SyncStamp {
  id: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  /** менструация в этот день */
  period?: boolean
  /** интенсивность (если период) */
  flow?: CycleFlow
  /** ключи симптомов (напр. 'cramps','headache') */
  symptoms?: string[]
  mood?: CycleMood
  note?: string
}

// ---------- Банковские карты ----------
export interface BankCard extends SyncStamp {
  id: string
  /** название/метка, напр. «Зарплатная» */
  label: string
  /** цифры номера ИЛИ шифртекст (если enc=true) */
  number: string
  /** имя владельца на карте */
  holder: string
  /** срок MM/YY */
  expiry: string
  /** пресет градиента (ключ из gradients) */
  gradient: string
  createdAt: string
  /** заметка (банк, лимит и т.п.) */
  note?: string
  /** скидочная карта (тогда number — код карты, без платёжной системы) */
  loyalty?: boolean
  /** для скидочной: показывать код штрихкодом (по умолчанию true). false — только номер */
  barcode?: boolean
  /** number зашифрован мастер-паролем */
  enc?: boolean
  /** последние 4 цифры (для показа, когда enc) */
  last4?: string
  /** платёжная система (для показа, когда enc) */
  brand?: string
}

/** Блок защиты карт мастер-паролем (опционально). */
export interface CardSecurity {
  /** соль PBKDF2 (base64) */
  salt: string
  /** проверочный шифртекст для валидации пароля */
  check: string
  /** число итераций PBKDF2; отсутствует у старых записей — 150 000 */
  iterations?: number
}

// ---------- Настройки (синхронизируемые) ----------
export interface WeatherLocation {
  /** отображаемое имя, напр. «Минск, BY» */
  name: string
  lat: number
  lon: number
}

export interface Settings {
  theme: ThemeMode
  language: Language
  baseCurrency: Currency
  /** место для погоды (задаётся в настройках); null/отсутствует — погода выключена */
  weatherLocation?: WeatherLocation | null
  /** цветовая палитра; отсутствует — 'classic' */
  palette?: Palette
  /** имя пользователя для приветствия (задаётся в онбординге/настройках) */
  userName?: string
  /** пройден ли первый запуск (мастер онбординга) */
  onboarded?: boolean
  /** включён ли трекер цикла (предлагается в онбординге при sex=female;
   *  сам трекер/календарь — Итерация 7, здесь только сохранённое намерение) */
  cycleEnabled?: boolean
}

// ---------- Весь документ ----------
export interface AppData {
  /** Версия схемы для будущих миграций */
  version: number
  expenses: Expense[]
  expenseCategories: ExpenseCategory[]
  recurringExpenses: RecurringExpense[]
  homeTasks: HomeTask[]
  shoppingLists: ShoppingList[]
  calendarTasks: CalendarTask[]
  healthProfile: HealthProfile | null
  weightLog: WeightEntry[]
  waterLog: WaterEntry[]
  measurements: Measurement[]
  foodLog: FoodEntry[]
  fitnessPrefs: FitnessPrefs | null
  workoutLog: WorkoutLog[]
  cycleLog: CycleDayEntry[]
  cards: BankCard[]
  cardSecurity: CardSecurity | null
  settings: Settings
  /** включённые виджеты главного экрана (по порядку) */
  dashboardWidgets: string[]
  /** ISO-таймстамп последнего изменения — основа слияния */
  updatedAt: string
}

/** Доступные виджеты главного экрана. */
export const ALL_WIDGETS = [
  'reminders',
  'finance',
  'cards',
  'tasks',
  'calendar',
  'water',
  'workout',
] as const
export type WidgetId = (typeof ALL_WIDGETS)[number]
export const DEFAULT_WIDGETS: string[] = ['reminders', 'finance', 'tasks', 'workout']

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
    recurringExpenses: [],
    homeTasks: [],
    shoppingLists: [],
    calendarTasks: [],
    healthProfile: null,
    weightLog: [],
    waterLog: [],
    measurements: [],
    foodLog: [],
    fitnessPrefs: null,
    workoutLog: [],
    cycleLog: [],
    cards: [],
    cardSecurity: null,
    settings: {
      theme: 'system',
      language: 'ru',
      baseCurrency: 'BYN',
    },
    dashboardWidgets: [...DEFAULT_WIDGETS],
    updatedAt: new Date().toISOString(),
  }
}
