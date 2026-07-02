import { create } from 'zustand'
import type {
  AppData,
  Currency,
  Expense,
  ExpenseCategory,
  HomeTask,
  Language,
  ShoppingItem,
  CalendarTask,
  ThemeMode,
  HealthProfile,
  FoodEntry,
  FitnessPrefs,
  WorkoutLog,
  BankCard,
  CardSecurity,
  RecurringExpense,
  Measurement,
} from '../types'
import { createEmptyData } from '../types'
import { uid } from '../lib/id'
import {
  getRates,
  type RateTable,
} from '../services/nbrb'
import {
  loadGitHubConfig,
  saveGitHubConfig as persistGitHubConfig,
  saveSyncMeta,
  type GitHubConfig,
} from '../lib/localConfig'
import { pull, push } from '../services/github'
import { merge3, sameContent } from '../services/merge'
import { getWeather, type CurrentWeather } from '../services/weather'
import { rescheduleNotifications } from '../services/notifications'
import type { WeatherLocation } from '../types'

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const DATA_KEY = 'planner.data'
const BASE_KEY = 'planner.base'

function loadBase(): AppData | null {
  try {
    const raw = localStorage.getItem(BASE_KEY)
    return raw ? (JSON.parse(raw) as AppData) : null
  } catch {
    return null
  }
}
function saveBase(d: AppData) {
  localStorage.setItem(BASE_KEY, JSON.stringify(d))
}

type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'error' | 'offline'

interface StoreState {
  data: AppData
  rates: RateTable | null
  ratesError: string | null
  weather: CurrentWeather | null

  sync: {
    status: SyncStatus
    error?: string
    lastSyncAt?: string
    configured: boolean
  }

  // ---- bootstrap ----
  init: () => Promise<void>
  refreshRates: (force?: boolean) => Promise<void>
  refreshWeather: (force?: boolean) => Promise<void>
  setWeatherLocation: (loc: WeatherLocation | null) => Promise<void>

  // ---- backup ----
  importData: (data: AppData) => Promise<void>

  // ---- expenses ----
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => void
  updateExpense: (id: string, patch: Partial<Expense>) => void
  deleteExpense: (id: string) => void
  addCategory: (c: Omit<ExpenseCategory, 'id'>) => void
  updateCategory: (id: string, patch: Partial<ExpenseCategory>) => void
  deleteCategory: (id: string) => void
  addRecurring: (r: Omit<RecurringExpense, 'id' | 'createdAt' | 'lastAppliedMonth'>) => void
  deleteRecurring: (id: string) => void
  applyRecurring: () => void

  // ---- home tasks ----
  addHomeTask: (t: Omit<HomeTask, 'id' | 'createdAt' | 'done'>) => void
  updateHomeTask: (id: string, patch: Partial<HomeTask>) => void
  toggleHomeTask: (id: string) => void
  deleteHomeTask: (id: string) => void

  // ---- shopping ----
  addList: (name: string) => void
  renameList: (id: string, name: string) => void
  deleteList: (id: string) => void
  addItem: (listId: string, item: Omit<ShoppingItem, 'id' | 'bought'>) => void
  updateItem: (listId: string, itemId: string, patch: Partial<ShoppingItem>) => void
  toggleItem: (listId: string, itemId: string) => void
  deleteItem: (listId: string, itemId: string) => void

  // ---- calendar ----
  addCalendarTask: (date: string, title: string, time?: string) => void
  toggleCalendarTask: (id: string) => void
  updateCalendarTask: (id: string, patch: Partial<CalendarTask>) => void
  deleteCalendarTask: (id: string) => void

  // ---- health ----
  setHealthProfile: (p: HealthProfile) => void
  addWeight: (date: string, weight: number) => void
  deleteWeight: (id: string) => void
  addWater: (ml: number) => void
  deleteWater: (id: string) => void
  addMeasurement: (m: Omit<Measurement, 'id'>) => void
  deleteMeasurement: (id: string) => void
  addFood: (entry: Omit<FoodEntry, 'id'>) => void
  deleteFood: (id: string) => void
  setFitnessPrefs: (prefs: FitnessPrefs) => void
  addWorkoutLog: (entry: Omit<WorkoutLog, 'id'>) => void
  deleteWorkoutLog: (id: string) => void

  // ---- cards ----
  addCard: (c: Omit<BankCard, 'id' | 'createdAt'>) => void
  updateCard: (id: string, patch: Partial<BankCard>) => void
  deleteCard: (id: string) => void
  setCards: (cards: BankCard[]) => void
  setCardSecurity: (sec: CardSecurity | null) => void

  // ---- settings ----
  setTheme: (t: ThemeMode) => void
  setLanguage: (l: Language) => void
  setBaseCurrency: (c: Currency) => void
  setDashboardWidgets: (ids: string[]) => void

  // ---- github sync config ----
  connectGitHub: (cfg: GitHubConfig) => Promise<void>
  disconnectGitHub: () => void
  syncNow: () => Promise<void>
}

// ---- persistence helpers ----
function loadData(): AppData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (raw) return { ...createEmptyData(), ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return createEmptyData()
}

function persist(data: AppData) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data))
}

// debounced push to GitHub
let pushTimer: ReturnType<typeof setTimeout> | null = null
function schedulePush(run: () => void) {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(run, 2500)
}

// Гарантируем, что одновременно идёт максимум один синк (иначе гонка → 409).
// Если синк запросили во время выполнения — выполним ещё один раз после.
let syncInFlight = false
let syncPending = false

export const useStore = create<StoreState>((set, get) => {
  /** Применить изменение данных: обновить updatedAt, сохранить, запланировать синк. */
  function mutate(updater: (d: AppData) => void) {
    const data = structuredClone(get().data)
    updater(data)
    data.updatedAt = new Date().toISOString()
    persist(data)
    set({ data })
    rescheduleNotifications(data)
    if (get().sync.configured) schedulePush(() => get().syncNow())
  }

  return {
    data: loadData(),
    rates: null,
    ratesError: null,
    weather: null,
    sync: { status: 'disabled', configured: false },

    async init() {
      // тема применяется в App; здесь — курсы, погода и синхронизация
      const cfg = loadGitHubConfig()
      set({ sync: { ...get().sync, configured: !!cfg, status: cfg ? 'idle' : 'disabled' } })
      get().applyRecurring()
      await get().refreshRates()
      void get().refreshWeather()
      if (cfg) await get().syncNow()
      rescheduleNotifications(get().data)
    },

    async refreshRates(force = false) {
      try {
        const rates = await getRates(force)
        set({ rates, ratesError: null })
      } catch (e) {
        set({ ratesError: e instanceof Error ? e.message : 'Не удалось получить курсы' })
      }
    },

    async refreshWeather(force = false) {
      const loc = get().data.settings.weatherLocation
      if (!loc) {
        set({ weather: null })
        return
      }
      try {
        const weather = await getWeather(loc.lat, loc.lon, force)
        set({ weather })
      } catch {
        /* оставляем прошлое значение/кэш */
      }
    },

    async setWeatherLocation(loc) {
      mutate((d) => {
        d.settings.weatherLocation = loc
      })
      await get().refreshWeather(true)
    },

    // ---------- expenses ----------
    addExpense(e) {
      mutate((d) => {
        d.expenses.unshift({ ...e, id: uid('exp'), createdAt: new Date().toISOString() })
      })
    },
    updateExpense(id, patch) {
      mutate((d) => {
        const i = d.expenses.findIndex((x) => x.id === id)
        if (i >= 0) d.expenses[i] = { ...d.expenses[i], ...patch }
      })
    },
    deleteExpense(id) {
      mutate((d) => {
        d.expenses = d.expenses.filter((x) => x.id !== id)
      })
    },
    addCategory(c) {
      mutate((d) => {
        d.expenseCategories.push({ ...c, id: uid('cat') })
      })
    },
    updateCategory(id, patch) {
      mutate((d) => {
        const i = d.expenseCategories.findIndex((x) => x.id === id)
        if (i >= 0) d.expenseCategories[i] = { ...d.expenseCategories[i], ...patch }
      })
    },
    deleteCategory(id) {
      mutate((d) => {
        d.expenseCategories = d.expenseCategories.filter((x) => x.id !== id)
        d.expenses = d.expenses.map((e) =>
          e.categoryId === id ? { ...e, categoryId: null } : e,
        )
      })
    },
    addRecurring(r) {
      mutate((d) => {
        d.recurringExpenses.unshift({
          ...r,
          id: uid('rec'),
          createdAt: new Date().toISOString(),
        })
      })
    },
    deleteRecurring(id) {
      mutate((d) => {
        d.recurringExpenses = d.recurringExpenses.filter((x) => x.id !== id)
      })
    },
    applyRecurring() {
      const now = new Date()
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const day = now.getDate()
      const due = get().data.recurringExpenses.some(
        (r) => r.lastAppliedMonth !== monthKey && day >= r.dayOfMonth,
      )
      if (!due) return
      mutate((d) => {
        for (const r of d.recurringExpenses) {
          if (r.lastAppliedMonth === monthKey) continue
          if (day < r.dayOfMonth) continue
          const dd = String(Math.min(r.dayOfMonth, 28)).padStart(2, '0')
          d.expenses.unshift({
            id: uid('exp'),
            amount: r.amount,
            currency: r.currency,
            categoryId: r.categoryId,
            note: r.label,
            date: `${monthKey}-${dd}`,
            createdAt: new Date().toISOString(),
            type: r.type,
          })
          r.lastAppliedMonth = monthKey
        }
      })
    },

    // ---------- home tasks ----------
    addHomeTask(t) {
      mutate((d) => {
        d.homeTasks.unshift({
          ...t,
          id: uid('task'),
          done: false,
          createdAt: new Date().toISOString(),
        })
      })
    },
    updateHomeTask(id, patch) {
      mutate((d) => {
        const i = d.homeTasks.findIndex((x) => x.id === id)
        if (i >= 0) d.homeTasks[i] = { ...d.homeTasks[i], ...patch }
      })
    },
    toggleHomeTask(id) {
      mutate((d) => {
        const t = d.homeTasks.find((x) => x.id === id)
        if (t) {
          t.done = !t.done
          t.completedAt = t.done ? new Date().toISOString() : undefined
        }
      })
    },
    deleteHomeTask(id) {
      mutate((d) => {
        d.homeTasks = d.homeTasks.filter((x) => x.id !== id)
      })
    },

    // ---------- shopping ----------
    addList(name) {
      mutate((d) => {
        d.shoppingLists.unshift({
          id: uid('list'),
          name,
          items: [],
          createdAt: new Date().toISOString(),
        })
      })
    },
    renameList(id, name) {
      mutate((d) => {
        const l = d.shoppingLists.find((x) => x.id === id)
        if (l) l.name = name
      })
    },
    deleteList(id) {
      mutate((d) => {
        d.shoppingLists = d.shoppingLists.filter((x) => x.id !== id)
      })
    },
    addItem(listId, item) {
      mutate((d) => {
        const l = d.shoppingLists.find((x) => x.id === listId)
        if (l) l.items.push({ ...item, id: uid('item'), bought: false })
      })
    },
    updateItem(listId, itemId, patch) {
      mutate((d) => {
        const l = d.shoppingLists.find((x) => x.id === listId)
        const it = l?.items.find((x) => x.id === itemId)
        if (it) Object.assign(it, patch)
      })
    },
    toggleItem(listId, itemId) {
      mutate((d) => {
        const l = d.shoppingLists.find((x) => x.id === listId)
        const it = l?.items.find((x) => x.id === itemId)
        if (it) it.bought = !it.bought
      })
    },
    deleteItem(listId, itemId) {
      mutate((d) => {
        const l = d.shoppingLists.find((x) => x.id === listId)
        if (l) l.items = l.items.filter((x) => x.id !== itemId)
      })
    },

    // ---------- calendar ----------
    addCalendarTask(date, title, time) {
      mutate((d) => {
        d.calendarTasks.unshift({
          id: uid('cal'),
          date,
          title,
          done: false,
          createdAt: new Date().toISOString(),
          ...(time ? { time } : {}),
        })
      })
    },
    toggleCalendarTask(id) {
      mutate((d) => {
        const t = d.calendarTasks.find((x) => x.id === id)
        if (t) {
          t.done = !t.done
          t.completedAt = t.done ? new Date().toISOString() : undefined
        }
      })
    },
    updateCalendarTask(id, patch) {
      mutate((d) => {
        const i = d.calendarTasks.findIndex((x) => x.id === id)
        if (i >= 0) d.calendarTasks[i] = { ...d.calendarTasks[i], ...patch }
      })
    },
    deleteCalendarTask(id) {
      mutate((d) => {
        d.calendarTasks = d.calendarTasks.filter((x) => x.id !== id)
      })
    },

    // ---------- health ----------
    setHealthProfile(p) {
      mutate((d) => {
        d.healthProfile = { ...p, updatedAt: new Date().toISOString() }
        // первый замер веса в дневник, если его ещё нет на сегодня
        const today = new Date().toISOString().slice(0, 10)
        if (!d.weightLog.some((w) => w.date === today)) {
          d.weightLog.push({ id: uid('w'), date: today, weight: p.weight })
        }
      })
    },
    addWeight(date, weight) {
      mutate((d) => {
        // один замер на дату — перезаписываем
        const existing = d.weightLog.find((w) => w.date === date)
        if (existing) existing.weight = weight
        else d.weightLog.push({ id: uid('w'), date, weight })
        d.weightLog.sort((a, b) => a.date.localeCompare(b.date))
        // синхронизируем текущий вес в профиле с последним замером
        const last = d.weightLog[d.weightLog.length - 1]
        if (d.healthProfile && last) d.healthProfile.weight = last.weight
      })
    },
    deleteWeight(id) {
      mutate((d) => {
        d.weightLog = d.weightLog.filter((w) => w.id !== id)
      })
    },
    addWater(ml) {
      mutate((d) => {
        d.waterLog.unshift({ id: uid('water'), date: new Date().toISOString().slice(0, 10), ml })
      })
    },
    deleteWater(id) {
      mutate((d) => {
        d.waterLog = d.waterLog.filter((w) => w.id !== id)
      })
    },
    addMeasurement(m) {
      mutate((d) => {
        d.measurements.unshift({ ...m, id: uid('meas') })
      })
    },
    deleteMeasurement(id) {
      mutate((d) => {
        d.measurements = d.measurements.filter((x) => x.id !== id)
      })
    },
    addFood(entry) {
      mutate((d) => {
        d.foodLog.unshift({ ...entry, id: uid('food') })
      })
    },
    deleteFood(id) {
      mutate((d) => {
        d.foodLog = d.foodLog.filter((f) => f.id !== id)
      })
    },
    setFitnessPrefs(prefs) {
      mutate((d) => {
        d.fitnessPrefs = prefs
      })
    },
    addWorkoutLog(entry) {
      mutate((d) => {
        d.workoutLog.unshift({ ...entry, id: uid('wo') })
      })
    },
    deleteWorkoutLog(id) {
      mutate((d) => {
        d.workoutLog = d.workoutLog.filter((w) => w.id !== id)
      })
    },

    // ---------- cards ----------
    addCard(c) {
      mutate((d) => {
        d.cards.unshift({ ...c, id: uid('card'), createdAt: new Date().toISOString() })
      })
    },
    updateCard(id, patch) {
      mutate((d) => {
        const i = d.cards.findIndex((x) => x.id === id)
        if (i >= 0) d.cards[i] = { ...d.cards[i], ...patch }
      })
    },
    deleteCard(id) {
      mutate((d) => {
        d.cards = d.cards.filter((x) => x.id !== id)
      })
    },
    setCards(cards) {
      mutate((d) => {
        d.cards = cards
      })
    },
    setCardSecurity(sec) {
      mutate((d) => {
        d.cardSecurity = sec
      })
    },

    // ---------- settings ----------
    setTheme(theme) {
      mutate((d) => {
        d.settings.theme = theme
      })
    },
    setLanguage(language) {
      mutate((d) => {
        d.settings.language = language
      })
    },
    setBaseCurrency(baseCurrency) {
      mutate((d) => {
        d.settings.baseCurrency = baseCurrency
      })
    },
    setDashboardWidgets(ids) {
      mutate((d) => {
        d.dashboardWidgets = ids
      })
    },

    // ---------- github ----------
    async connectGitHub(cfg) {
      persistGitHubConfig(cfg)
      set({ sync: { ...get().sync, configured: true, status: 'idle' } })
      await get().syncNow()
    },
    disconnectGitHub() {
      persistGitHubConfig(null)
      saveSyncMeta({})
      localStorage.removeItem(BASE_KEY)
      set({ sync: { status: 'disabled', configured: false } })
    },

    // ---------- backup (restore overwrites) ----------
    async importData(imported) {
      const data = { ...createEmptyData(), ...imported, updatedAt: new Date().toISOString() }
      persist(data)
      saveBase(data)
      set({ data })
      // восстановление перезаписывает облако
      const cfg = loadGitHubConfig()
      if (!cfg) return
      try {
        const remote = await pull(cfg)
        const newSha = await push(cfg, data, remote.sha)
        saveSyncMeta({ sha: newSha, lastSyncAt: new Date().toISOString() })
      } catch {
        /* офлайн — уйдёт при следующем синке */
      }
    },

    async syncNow() {
      const cfg = loadGitHubConfig()
      if (!cfg) {
        set({ sync: { status: 'disabled', configured: false } })
        return
      }
      // Не запускаем второй синк параллельно — поставим в очередь один повтор.
      if (syncInFlight) {
        syncPending = true
        return
      }
      syncInFlight = true
      set({ sync: { ...get().sync, status: 'syncing', error: undefined } })
      try {
        for (let attempt = 0; ; attempt++) {
          // 1) СНАЧАЛА тянем актуальную версию из репо
          const remote = await pull(cfg)
          const base = loadBase()
          const local = get().data

          // 2) Сливаем удалёнку в локальные данные
          const merged =
            remote.notFound || !remote.data ? local : merge3(base, local, remote.data)

          const lastSyncAt = new Date().toISOString()

          // 3) Если на удалёнке уже ровно то же содержимое — НЕ пушим
          //    (просто принимаем удалёнку как есть → устройства идентичны, нет пинг-понга)
          if (!remote.notFound && remote.data && sameContent(merged, remote.data)) {
            persist(remote.data)
            saveBase(remote.data)
            saveSyncMeta({ sha: remote.sha ?? undefined, lastSyncAt })
            set({ data: remote.data, sync: { status: 'idle', configured: true, lastSyncAt } })
            rescheduleNotifications(remote.data)
            break
          }

          // 4) Иначе пушим слитый результат
          try {
            const newSha = await push(cfg, merged, remote.sha)
            persist(merged)
            saveBase(merged)
            saveSyncMeta({ sha: newSha, lastSyncAt })
            set({ data: merged, sync: { status: 'idle', configured: true, lastSyncAt } })
            rescheduleNotifications(merged)
            break
          } catch (e) {
            const status = (e as { status?: number }).status
            if (status === 409 && attempt < 5) {
              // кто-то записал между нашими pull и push — даём догнать и пробуем снова
              await delay(800 * (attempt + 1))
              continue
            }
            throw e
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка синхронизации'
        const offline = !navigator.onLine
        set({
          sync: {
            ...get().sync,
            status: offline ? 'offline' : 'error',
            error: msg,
            configured: true,
          },
        })
      } finally {
        syncInFlight = false
        if (syncPending) {
          syncPending = false
          void get().syncNow()
        }
      }
    },
  }
})
