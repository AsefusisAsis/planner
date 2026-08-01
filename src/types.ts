// ============================================================
// Модель данных. AppData — это то, что синхронизируется в data.json.
// Токен GitHub сюда НЕ входит — он хранится только локально (см. lib/localConfig).
// ============================================================

// Курируемый набор валют (широкий, но не весь ISO-4217 — только то, что имеет
// смысл в селекторе). Курсы приходят агрегатором (open.er-api, 160+ валют) —
// технически конвертация работает и для валют вне списка, но выбирать в UI
// можно из этого набора. Порядок: региональные для пользователя → мировые.
export type FiatCurrency =
  | 'BYN' | 'RUB' | 'USD' | 'EUR'
  | 'PLN' | 'UAH' | 'KZT' | 'GEL' | 'AMD' | 'AZN' | 'MDL'
  | 'GBP' | 'CHF' | 'CZK' | 'TRY' | 'CNY' | 'JPY'
  | 'CAD' | 'AUD' | 'AED' | 'INR' | 'RSD' | 'NOK' | 'SEK' | 'THB'

/** Криптовалюты. Для расчётов это обычная валюта: тот же USD-пивот, тот же
 *  «курс на момент операции». Отличий ровно два — свой источник курса и
 *  дробность (0.00042 BTC нельзя показывать с двумя знаками). */
export type CryptoCurrency =
  | 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'TON' | 'TRX'
  | 'BNB' | 'SOL' | 'XRP' | 'LTC' | 'DOGE'

export type Currency = FiatCurrency | CryptoCurrency

export const FIAT_CURRENCIES: FiatCurrency[] = [
  'BYN', 'RUB', 'USD', 'EUR',
  'PLN', 'UAH', 'KZT', 'GEL', 'AMD', 'AZN', 'MDL',
  'GBP', 'CHF', 'CZK', 'TRY', 'CNY', 'JPY',
  'CAD', 'AUD', 'AED', 'INR', 'RSD', 'NOK', 'SEK', 'THB',
]
export const CRYPTO_CURRENCIES: CryptoCurrency[] = [
  'BTC', 'ETH', 'USDT', 'USDC', 'TON', 'TRX', 'BNB', 'SOL', 'XRP', 'LTC', 'DOGE',
]
export const CURRENCIES: Currency[] = [...FIAT_CURRENCIES, ...CRYPTO_CURRENCIES]

const CRYPTO_SET = new Set<string>(CRYPTO_CURRENCIES)
export const isCrypto = (c: string): c is CryptoCurrency => CRYPTO_SET.has(c)

/** Стейблкоины держатся у доллара — им хватает обычных двух знаков. */
const STABLE = new Set<string>(['USDT', 'USDC'])

/** Сколько знаков после запятой показывать. У фиата всегда 2; у крипты
 *  до 8 — иначе 0.00042 BTC округлилось бы в ноль. */
export function fractionDigits(c: Currency): { min: number; max: number } {
  if (!isCrypto(c) || STABLE.has(c)) return { min: 2, max: 2 }
  return { min: 2, max: 8 }
}

/** Шаг для <input type="number">. Без этого браузер отбраковал бы 0.00042
 *  как несоответствующее step="0.01" и сумму просто нельзя было бы ввести. */
export function amountStep(c: Currency): string {
  return fractionDigits(c).max === 2 ? '0.01' : '0.00000001'
}

/** Сколько валют помещается в тикер курсов на Главной.
 *
 *  Замерено на экране 375px: пять строк вида «₿ 63046.00» встают в одну
 *  строку, с шестой шапка переносится на вторую. Ограничение общее для
 *  дашборда и настроек — иначе в настройках можно было выбрать десяток,
 *  а на Главной молча показывалась бы только часть. */
export const MAX_TICKER_CURRENCIES = 5

/** Валюты пользователя: базовая + выбранные для тикера (без дублей).
 *  Используется, чтобы в селекторах валют траты показывать «свои» первыми. */
export function preferredCurrencies(s: {
  baseCurrency: Currency
  displayCurrencies?: Currency[]
}): Currency[] {
  const list = s.displayCurrencies?.length ? s.displayCurrencies : (['USD', 'EUR', 'RUB'] as Currency[])
  return [...new Set<Currency>([s.baseCurrency, ...list])]
}

/** Есть ли в данных хоть одна криптовалюта. Нужно, чтобы не дёргать
 *  крипто-источник курсов у тех, кто криптой не пользуется. */
export function usesCrypto(d: AppData): boolean {
  const s = d.settings
  if (isCrypto(s.baseCurrency)) return true
  if (s.displayCurrencies?.some(isCrypto)) return true
  if (d.expenses.some((e) => isCrypto(e.currency))) return true
  if (d.recurringExpenses.some((r) => isCrypto(r.currency))) return true
  if (d.expenseCategories.some((c) => c.budgetCurrency && isCrypto(c.budgetCurrency))) return true
  return false
}

/** Символы валют для отображения; фолбэк на код, если символа нет. */
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  BYN: 'Br', RUB: '₽', USD: '$', EUR: '€',
  PLN: 'zł', UAH: '₴', KZT: '₸', GEL: '₾', AMD: '֏', AZN: '₼', MDL: 'L',
  GBP: '£', CHF: 'Fr', CZK: 'Kč', TRY: '₺', CNY: '¥', JPY: '¥',
  CAD: 'C$', AUD: 'A$', AED: 'dh', INR: '₹', RSD: 'дин', NOK: 'kr', SEK: 'kr', THB: '฿',
  // у крипты общепринятых символов почти нет — тикер понятнее значка
  BTC: '₿', ETH: 'Ξ', USDT: 'USDT', USDC: 'USDC', TON: 'TON', TRX: 'TRX',
  BNB: 'BNB', SOL: 'SOL', XRP: 'XRP', LTC: 'LTC', DOGE: 'Ð',
}

/** Страна → базовая валюта (курируемый список для шага онбординга).
 *  Не весь ISO-3166 — частые страны + все, чьи валюты есть в CURRENCIES. */
export interface CountryOption {
  code: string
  ru: string
  en: string
  currency: Currency
}
export const COUNTRIES: CountryOption[] = [
  { code: 'BY', ru: 'Беларусь', en: 'Belarus', currency: 'BYN' },
  { code: 'RU', ru: 'Россия', en: 'Russia', currency: 'RUB' },
  { code: 'UA', ru: 'Украина', en: 'Ukraine', currency: 'UAH' },
  { code: 'KZ', ru: 'Казахстан', en: 'Kazakhstan', currency: 'KZT' },
  { code: 'GE', ru: 'Грузия', en: 'Georgia', currency: 'GEL' },
  { code: 'AM', ru: 'Армения', en: 'Armenia', currency: 'AMD' },
  { code: 'AZ', ru: 'Азербайджан', en: 'Azerbaijan', currency: 'AZN' },
  { code: 'MD', ru: 'Молдова', en: 'Moldova', currency: 'MDL' },
  { code: 'PL', ru: 'Польша', en: 'Poland', currency: 'PLN' },
  { code: 'US', ru: 'США', en: 'United States', currency: 'USD' },
  { code: 'GB', ru: 'Великобритания', en: 'United Kingdom', currency: 'GBP' },
  { code: 'DE', ru: 'Германия', en: 'Germany', currency: 'EUR' },
  { code: 'FR', ru: 'Франция', en: 'France', currency: 'EUR' },
  { code: 'IT', ru: 'Италия', en: 'Italy', currency: 'EUR' },
  { code: 'ES', ru: 'Испания', en: 'Spain', currency: 'EUR' },
  { code: 'NL', ru: 'Нидерланды', en: 'Netherlands', currency: 'EUR' },
  { code: 'PT', ru: 'Португалия', en: 'Portugal', currency: 'EUR' },
  { code: 'IE', ru: 'Ирландия', en: 'Ireland', currency: 'EUR' },
  { code: 'AT', ru: 'Австрия', en: 'Austria', currency: 'EUR' },
  { code: 'FI', ru: 'Финляндия', en: 'Finland', currency: 'EUR' },
  { code: 'GR', ru: 'Греция', en: 'Greece', currency: 'EUR' },
  { code: 'CZ', ru: 'Чехия', en: 'Czechia', currency: 'CZK' },
  { code: 'CH', ru: 'Швейцария', en: 'Switzerland', currency: 'CHF' },
  { code: 'TR', ru: 'Турция', en: 'Türkiye', currency: 'TRY' },
  { code: 'CN', ru: 'Китай', en: 'China', currency: 'CNY' },
  { code: 'JP', ru: 'Япония', en: 'Japan', currency: 'JPY' },
  { code: 'CA', ru: 'Канада', en: 'Canada', currency: 'CAD' },
  { code: 'AU', ru: 'Австралия', en: 'Australia', currency: 'AUD' },
  { code: 'AE', ru: 'ОАЭ', en: 'UAE', currency: 'AED' },
  { code: 'IN', ru: 'Индия', en: 'India', currency: 'INR' },
  { code: 'RS', ru: 'Сербия', en: 'Serbia', currency: 'RSD' },
  { code: 'NO', ru: 'Норвегия', en: 'Norway', currency: 'NOK' },
  { code: 'SE', ru: 'Швеция', en: 'Sweden', currency: 'SEK' },
  { code: 'TH', ru: 'Таиланд', en: 'Thailand', currency: 'THB' },
]

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
  /** для автоматически начисленного налога: месяц доходов 'YYYY-MM', за
   *  который посчитан налог (маркер идемпотентности; налог за месяц M
   *  начисляется в M+1) */
  taxForMonth?: string
  /** пометка «относится к налоговой отчётности» — ставит пользователь.
   *  Приложение НЕ решает это само и не считает сумму налога к уплате по
   *  местному закону: это работа бухгалтера, а ошибка в ней дороже удобства. */
  taxRelevant?: boolean
  /** курс на момент траты: сумма в базовой валюте на дату создания.
   *  Пишется, если currency ≠ базовой и курс был доступен. Старые записи
   *  без снимка считаются по текущему курсу (live-fallback). */
  baseAmount?: number
  /** базовая валюта, в которой зафиксирован baseAmount (на момент записи) */
  baseCur?: Currency
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
  /** последний месяц начисления включительно 'YYYY-MM' (платёж с датой
   *  окончания, напр. кредит); после него не начисляется */
  endMonth?: string
  /** платёж последнего месяца (остаток), если отличается от amount;
   *  применяется только в месяц endMonth */
  lastAmount?: number
  /** заметка: номер счёта по кредиту, реквизиты, к чему относится платёж */
  note?: string
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
  /** планируемая дата покупки 'YYYY-MM-DD' (необязательно) — попадает в виджет
   *  покупок на Главной, ближайшее по дате показывается выше */
  plannedDate?: string
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

/** Свой симптом цикла. id = 'c:' + подпись — так удаление и повторное
 *  добавление одного и того же названия дают тот же id, и старые записи
 *  дневника не теряют смысл. Переименования поэтому нет (оно бы их осиротило). */
export interface CustomSymptom {
  id: string
  label: string
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

// ---------- Криптоадреса ----------

/** Сеть, в которой действует адрес. Тип живёт здесь (рядом с записью), а
 *  подписи и проверка формата — в lib/cryptoAddress. */
export type CryptoNetwork =
  | 'BTC' | 'ETH' | 'BSC' | 'TRON' | 'TON' | 'SOL' | 'XRP' | 'LTC' | 'DOGE' | 'OTHER'

/**
 * Справочная запись об адресе: куда вам присылать монеты.
 *
 * Баланса и истории здесь нет и не планируется — это потребовало бы своего
 * API на каждую сеть (отдельная по объёму задача).
 *
 * Адрес НЕ шифруется, в отличие от номера карты: это публичный ключ, его и
 * так дают отправителю, а под замком он стал бы бесполезен — весь смысл в
 * том, чтобы быстро показать QR.
 */
export interface CryptoAddress extends SyncStamp {
  id: string
  /** метка: «Основной», «Биржа», … */
  label: string
  /** какая монета приходит на этот адрес */
  currency: CryptoCurrency
  /** сеть — критично: TRC20, ERC20 и BEP20 это разные адреса */
  network: CryptoNetwork
  address: string
  note?: string
  createdAt: string
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
  /** приложение банка/платежей для быстрого открытия (Android Intent):
   *  ключ пресета из PAYMENT_APPS или произвольная URL-схема/пакет.
   *  Открывает приложение (диплинк к конкретной карте недоступен извне). */
  bankApp?: string
}

/** Пресеты платёжных/банковских приложений (пакет Android → подпись).
 *  Список-подсказка для поля «приложение для оплаты» у карты; при отсутствии
 *  нужного банка пользователь вводит пакет вручную. */
export interface PaymentApp {
  pkg: string
  ru: string
  en: string
}
export const PAYMENT_APPS: PaymentApp[] = [
  { pkg: 'com.google.android.apps.walletnfcrel', ru: 'Google Wallet', en: 'Google Wallet' },
  { pkg: 'com.samsung.android.spay', ru: 'Samsung Wallet', en: 'Samsung Wallet' },
  { pkg: 'ru.nspk.mirpay', ru: 'Mir Pay', en: 'Mir Pay' },
  { pkg: 'ru.sberbankmobile', ru: 'СберБанк', en: 'SberBank' },
  { pkg: 'com.idamob.tinkoff.android', ru: 'Т-Банк (Тинькофф)', en: 'T-Bank (Tinkoff)' },
  { pkg: 'ru.alfabank.mobile.android', ru: 'Альфа-Банк', en: 'Alfa-Bank' },
]

/** Блок защиты карт мастер-паролем (опционально, legacy — заменяется Vault). */
export interface CardSecurity {
  /** соль PBKDF2 (base64) */
  salt: string
  /** проверочный шифртекст для валидации пароля */
  check: string
  /** число итераций PBKDF2; отсутствует у старых записей — 150 000 */
  iterations?: number
}

/**
 * «Защита данных» — единый TOTP-ключ для чувствительных данных (цикл + карты).
 * Синхронизируемая часть: только проверочный шифротекст (валидирует секрет,
 * введённый на новом устройстве) — сам секрет НИКОГДА не синкается и хранится
 * device-local (localStorage на вебе / Keystore на Android — см. vault.ts).
 */
export interface Vault {
  enabled: boolean
  /** encryptStr(DEK, VAULT_CHECK) — проверка правильности секрета на новом девайсе */
  check: string
  createdAt: string
}

// ---------- Настройки (синхронизируемые) ----------
export interface WeatherLocation {
  /** отображаемое имя, напр. «Минск, BY» */
  name: string
  lat: number
  lon: number
}

/** Настройка напоминаний пить воду. */
export interface WaterReminder {
  enabled: boolean
  /** интервал в часах между напоминаниями (1..6) */
  everyHours: number
  /** окно активности: с какого по какой час (24ч) */
  fromHour: number
  toHour: number
}

/** Напоминания цикла (локальные уведомления, нейтральный текст). */
export interface CycleReminder {
  /** за пару дней до прогнозируемого начала */
  periodSoon: boolean
  /** мягкое напоминание отметить самочувствие/лог */
  logReminder: boolean
}

export interface Settings {
  theme: ThemeMode
  language: Language
  baseCurrency: Currency
  /** код страны (ISO-2) — задаётся в онбординге, подставляет базовую валюту */
  country?: string
  /** какие валюты показывать в тикере курсов (к базовой); пусто — дефолт */
  displayCurrencies?: Currency[]
  /** id карт, закреплённых в виджете «Карты» на Главной; пусто — первые 2 */
  dashboardCardIds?: string[]
  /** напоминания пить воду (локальные уведомления, натив); по умолчанию выкл */
  waterReminder?: WaterReminder
  /** напоминания цикла (только при cycleEnabled); по умолчанию выкл */
  cycleReminder?: CycleReminder
  /** место для погоды (задаётся в настройках); null/отсутствует — погода выключена */
  weatherLocation?: WeatherLocation | null
  /** цветовая палитра; отсутствует — 'classic' */
  palette?: Palette
  /** имя пользователя для приветствия (задаётся в онбординге/настройках) */
  userName?: string
  /** пройден ли первый запуск (мастер онбординга) */
  onboarded?: boolean
  /** разблокировать «Защиту данных» биометрией; отсутствует = включено,
   *  если биометрия на устройстве доступна */
  biometricUnlock?: boolean
  /** налог с доходов: включён ли автоматический расчёт */
  taxEnabled?: boolean
  /** ставка налога, % от доходов (напр. 6 для ИП/самозанятого) */
  taxPercent?: number
  /** день месяца начисления налога (1..28); по умолчанию 5 */
  taxDayOfMonth?: number
  /** категория, к которой относить начисленный налог (необязательно) */
  taxCategoryId?: string | null
  /** включён ли трекер цикла (предлагается в онбординге при sex=female;
   *  сам трекер/календарь — Итерация 7, здесь только сохранённое намерение) */
  cycleEnabled?: boolean
  /** ключи встроенных симптомов, убранных пользователем из списка отметок.
   *  Именно скрытие, а не удаление: уже сделанные записи остаются читаемыми */
  cycleSymptomsHidden?: string[]
  /** свои симптомы в дополнение к встроенным */
  cycleSymptomsCustom?: CustomSymptom[]
  /** показывать дни цикла в общем календаре приложения. По умолчанию ВЫКЛ:
   *  общий календарь видно мельком и при чужом взгляде на экран, а цикл —
   *  чувствительные данные; включение всегда осознанное */
  cycleInCalendar?: boolean
  /** опция: синхронизировать данные цикла через ЛИЧНЫЙ GitHub-репозиторий
   *  пользователя (в общий Supabase они не уходят никогда) */
  cycleGitHubSync?: boolean
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
  cryptoAddresses: CryptoAddress[]
  cardSecurity: CardSecurity | null
  vault: Vault | null
  settings: Settings
  /** включённые виджеты главного экрана (по порядку) */
  dashboardWidgets: string[]
  /** ISO-таймстамп последнего изменения — основа слияния */
  updatedAt: string
}

/** Доступные виджеты главного экрана. */
export const ALL_WIDGETS = [
  'reminders',
  'nownext',
  'finance',
  'cards',
  'tasks',
  'calendar',
  'shopping',
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
    cryptoAddresses: [],
    cardSecurity: null,
    vault: null,
    settings: {
      theme: 'system',
      language: 'ru',
      baseCurrency: 'BYN',
    },
    dashboardWidgets: [...DEFAULT_WIDGETS],
    updatedAt: new Date().toISOString(),
  }
}
