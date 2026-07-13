import { create } from 'zustand'
import type {
  AppData,
  Currency,
  Expense,
  ExpenseCategory,
  HomeTask,
  Language,
  Palette,
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
import { uid, todayISO, toISODate } from '../lib/id'
import { tap } from '../lib/haptics'
import { addDays, addMonths } from 'date-fns'
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
import { supabase } from '../services/supabase'
import {
  diffAndStamp,
  fetchCloudRows,
  applyCloudRows,
  cloudPush,
  saveCursor,
  stageAllForUpload,
  clearCloudState,
  hasPendingCloud,
  getLastCloudUser,
  setLastCloudUser,
  localCounts,
  serverCounts,
} from '../services/cloudSync'
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

  /** Аккаунт облачной синхронизации (Supabase); null — не выполнен вход. */
  account: { email: string } | null

  /** Ожидающая отмена удаления (для тоста «Удалено · Отменить»). */
  pendingUndo: { id: number; label: string } | null
  undoLast: () => void
  dismissUndo: () => void

  // ---- аккаунт ----
  /** внутреннее: обработка входа другим пользователем на этом устройстве */
  _handleAccountSwitch: (uid: string) => boolean
  signUp: (email: string, password: string) => Promise<'ok' | 'confirm_email' | 'switched'>
  signIn: (email: string, password: string) => Promise<'ok' | 'switched'>
  signOut: () => Promise<void>
  cloudSyncNow: () => Promise<void>
  /** Первичный перенос локальных данных в аккаунт. Возвращает число записей. */
  migrateToCloud: () => Promise<number>
  getMigrationCounts: () => Promise<{ local: number; server: number }>

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
  setPalette: (p: Palette) => void
  setDashboardWidgets: (ids: string[]) => void
  setUserName: (name: string) => void
  /** открыт ли мастер онбординга вручную (из Настроек — «Пересмотреть профиль») */
  onboardingOpen: boolean
  openOnboarding: () => void
  /** завершить онбординг: имя + базовые настройки + (опц.) профиль здоровья,
   *  важные разделы, трекер цикла; отметить onboarded и закрыть мастер */
  completeOnboarding: (p: {
    name: string
    language: Language
    baseCurrency: Currency
    theme: ThemeMode
    palette: Palette
    healthProfile?: HealthProfile | null
    dashboardWidgets?: string[]
    cycleEnabled?: boolean
  }) => void

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

// Аналогичные защёлки для облачного синка (Supabase).
let cloudInFlight = false
let cloudPending = false

// Отмена последнего удаления: восстанавливающее замыкание держим в памяти
// (не сериализуется), а в состоянии — только метка для тоста.
let undoThunk: (() => void) | null = null
let undoCounter = 0

export const useStore = create<StoreState>((set, get) => {
  /** Вооружить отмену последнего удаления: метка для тоста + восстановитель. */
  function armUndo(label: string, restore: () => void) {
    undoThunk = restore
    set({ pendingUndo: { id: ++undoCounter, label } })
  }

  /** Применить изменение данных: проштамповать записи, сохранить, запланировать синк. */
  function mutate(updater: (d: AppData) => void) {
    const prev = get().data
    const data = structuredClone(prev)
    updater(data)
    // штампы updatedAt изменённым записям + outbox (всегда: правки при
    // протухшей сессии выгрузятся после повторного входа)
    diffAndStamp(prev, data)
    data.updatedAt = new Date().toISOString()
    persist(data)
    set({ data })
    rescheduleNotifications(data)
    // при активном аккаунте авто-синк идёт через облако; GitHub — вручную
    if (get().account) schedulePush(() => get().cloudSyncNow())
    else if (get().sync.configured) schedulePush(() => get().syncNow())
  }

  return {
    data: loadData(),
    rates: null,
    ratesError: null,
    weather: null,
    sync: { status: 'disabled', configured: false },
    account: null,
    pendingUndo: null,
    onboardingOpen: false,

    undoLast() {
      const run = undoThunk
      undoThunk = null
      set({ pendingUndo: null })
      run?.()
    },
    dismissUndo() {
      undoThunk = null
      set({ pendingUndo: null })
    },

    async init() {
      // тема применяется в App; здесь — курсы, погода, аккаунт и синхронизация
      const cfg = loadGitHubConfig()
      set({ sync: { ...get().sync, configured: !!cfg, status: cfg ? 'idle' : 'disabled' } })

      // восстанавливаем сессию аккаунта (если входили раньше)
      const { data: sess } = await supabase.auth.getSession()
      const email = sess.session?.user.email
      if (email) {
        // восстановление сессии проходит ту же защиту от смешивания данных,
        // что и ручной вход (вдруг на устройстве раньше был другой аккаунт)
        get()._handleAccountSwitch(sess.session!.user.id)
        set({ account: { email }, sync: { ...get().sync, configured: true, status: 'idle' } })
      }
      supabase.auth.onAuthStateChange((event, s) => {
        const em = s?.user.email
        if (em) {
          set({ account: { email: em } })
        } else {
          // сессия слетела (протух refresh-токен): честный статус, а не «синхронизировано».
          // Правки продолжают копиться в outbox и уйдут после повторного входа.
          const hasGitHub = !!loadGitHubConfig()
          set({
            account: null,
            sync: hasGitHub
              ? { ...get().sync, configured: true, status: 'idle' }
              : { status: 'disabled', configured: false },
          })
        }
        void event
      })

      await get().refreshRates()
      void get().refreshWeather()
      if (get().account) await get().cloudSyncNow()
      else if (cfg) await get().syncNow()
      // начисляем повторяющиеся ПОСЛЕ синхронизации: на стале-данных до
      // подтягивания удалёнки второе устройство создавало бы дубль
      get().applyRecurring()
      rescheduleNotifications(get().data)
    },

    // ---------- аккаунт (Supabase) ----------
    /** Вход другим пользователем на этом устройстве: чужие данные не смешиваем —
     *  локальное состояние заменяется данными нового аккаунта (страница
     *  настроек скачивает резервную копию перед входом). */
    _handleAccountSwitch(uid: string): boolean {
      if (!uid) return false
      const last = getLastCloudUser()
      const switched = !!last && last !== uid
      if (switched) {
        clearCloudState()
        localStorage.removeItem(BASE_KEY)
        const empty = createEmptyData()
        persist(empty)
        set({ data: empty })
      }
      setLastCloudUser(uid)
      return switched
    },

    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw new Error(error.message)
      if (!data.session) return 'confirm_email' // включено подтверждение почты
      const switched = get()._handleAccountSwitch(data.session.user.id)
      set({ account: { email }, sync: { ...get().sync, configured: true, status: 'idle' } })
      await get().cloudSyncNow()
      return switched ? 'switched' : 'ok'
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      const switched = get()._handleAccountSwitch(data.session?.user.id ?? '')
      set({ account: { email }, sync: { ...get().sync, configured: true, status: 'idle' } })
      await get().cloudSyncNow()
      return switched ? 'switched' : 'ok'
    },

    async signOut() {
      await supabase.auth.signOut()
      clearCloudState()
      const cfg = loadGitHubConfig()
      set({
        account: null,
        sync: { status: cfg ? 'idle' : 'disabled', configured: !!cfg },
      })
    },

    async getMigrationCounts() {
      const [srv] = await Promise.all([serverCounts()])
      return { local: localCounts(get().data).total, server: srv.total }
    },

    async migrateToCloud() {
      const count = stageAllForUpload(get().data)
      await get().cloudSyncNow()
      // cloudSyncNow глотает ошибки в статус. НО он мог выйти рано, если фоновый
      // синк уже шёл: тогда outbox ещё не пуст, хотя это не сбой — cloudPending
      // перезапустит выгрузку в finally, а outbox гарантирует загрузку. Ошибкой
      // считаем только явный sync.error (иначе мастер показывал ложную неудачу)
      if (hasPendingCloud() && get().sync.error) {
        throw new Error(get().sync.error)
      }
      return count
    },

    async cloudSyncNow() {
      if (!get().account) return
      if (cloudInFlight) {
        cloudPending = true
        return
      }
      cloudInFlight = true
      set({ sync: { ...get().sync, status: 'syncing', error: undefined, configured: true } })
      try {
        // 1) СЕТЬ: скачиваем чужие изменения (данные не трогаем)
        const fetched = await fetchCloudRows()
        if (!get().account) return // вышли из аккаунта, пока ждали сеть
        // 2) СИНХРОННО применяем к АКТУАЛЬНЫМ данным — правка, сделанная
        //    во время сетевого ожидания, не откатится (она в outbox)
        if (fetched.rows.length) {
          const res = applyCloudRows(get().data, fetched.rows)
          if (res.changed) {
            persist(res.data)
            set({ data: res.data })
            rescheduleNotifications(res.data)
          }
          saveCursor(fetched.cursor)
        }
        // 3) выгружаем свои (outbox переживает ошибки — ничего не теряется)
        await cloudPush(get().data)
        if (!get().account) return
        const lastSyncAt = new Date().toISOString()
        saveSyncMeta({ lastSyncAt })
        set({ sync: { status: 'idle', configured: true, lastSyncAt } })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Ошибка синхронизации'
        set({
          sync: {
            ...get().sync,
            status: navigator.onLine ? 'error' : 'offline',
            error: msg,
            configured: true,
          },
        })
      } finally {
        cloudInFlight = false
        if (cloudPending) {
          cloudPending = false
          void get().cloudSyncNow()
        }
      }
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
      tap()
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
      const exp = get().data.expenses.find((x) => x.id === id)
      mutate((d) => {
        d.expenses = d.expenses.filter((x) => x.id !== id)
      })
      // финансовая запись невосстановима по памяти (сумма/дата/заметка) — даём отмену
      if (exp) armUndo(exp.note || `${exp.amount} ${exp.currency}`, () => mutate((d) => d.expenses.unshift(exp)))
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
      const cat = get().data.expenseCategories.find((x) => x.id === id)
      // запоминаем траты И повторяющиеся платежи, у которых сбросится категория —
      // чтобы вернуть при отмене. Без чистки recurring applyRecurring ежемесячно
      // плодил бы траты с висячим categoryId (фантомные бакеты в разбивке)
      const affected = get().data.expenses.filter((e) => e.categoryId === id).map((e) => e.id)
      const affectedRec = get().data.recurringExpenses.filter((r) => r.categoryId === id).map((r) => r.id)
      mutate((d) => {
        d.expenseCategories = d.expenseCategories.filter((x) => x.id !== id)
        d.expenses = d.expenses.map((e) =>
          e.categoryId === id ? { ...e, categoryId: null } : e,
        )
        d.recurringExpenses = d.recurringExpenses.map((r) =>
          r.categoryId === id ? { ...r, categoryId: null } : r,
        )
      })
      if (cat) {
        armUndo(cat.name, () =>
          mutate((d) => {
            if (!d.expenseCategories.some((c) => c.id === cat.id)) d.expenseCategories.push(cat)
            const back = new Set(affected)
            d.expenses = d.expenses.map((e) => (back.has(e.id) ? { ...e, categoryId: id } : e))
            const backRec = new Set(affectedRec)
            d.recurringExpenses = d.recurringExpenses.map((r) => (backRec.has(r.id) ? { ...r, categoryId: id } : r))
          }),
        )
      }
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
      const rec = get().data.recurringExpenses.find((x) => x.id === id)
      mutate((d) => {
        d.recurringExpenses = d.recurringExpenses.filter((x) => x.id !== id)
      })
      if (rec) armUndo(rec.label, () => mutate((d) => d.recurringExpenses.unshift(rec)))
    },
    applyRecurring() {
      const now = new Date()
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const day = now.getDate()
      // идемпотентность между устройствами: запись этого месяца могла прийти
      // с другого устройства через синк — узнаём её по sourceRecurringId.
      // Месяц определяем по createdAt (когда начислено), а не по date:
      // пользователь может перенести дату оплаты на другой месяц
      const monthKeyOf = (iso: string) => {
        const dt = new Date(iso)
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      }
      const alreadyApplied = (d: AppData, rId: string, last?: string) =>
        last === monthKey ||
        d.expenses.some((e) => e.sourceRecurringId === rId && monthKeyOf(e.createdAt) === monthKey)
      const due = get().data.recurringExpenses.some(
        (r) => day >= r.dayOfMonth && !alreadyApplied(get().data, r.id, r.lastAppliedMonth),
      )
      if (!due) return
      mutate((d) => {
        for (const r of d.recurringExpenses) {
          if (day < r.dayOfMonth) continue
          if (alreadyApplied(d, r.id, r.lastAppliedMonth)) {
            r.lastAppliedMonth = monthKey
            continue
          }
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
            sourceRecurringId: r.id,
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
      tap()
      mutate((d) => {
        const t = d.homeTasks.find((x) => x.id === id)
        if (!t) return
        t.done = !t.done
        t.completedAt = t.done ? new Date().toISOString() : undefined
        // повторяющаяся задача: при выполнении серия продолжается в новой
        // копии со сдвинутым сроком, выполненная остаётся в истории
        if (t.done && t.recurrence !== 'none') {
          const today = todayISO()
          const from = t.dueDate && t.dueDate > today ? t.dueDate : today
          const [y, m, dd] = from.split('-').map(Number)
          const base = new Date(y, m - 1, dd)
          const next =
            t.recurrence === 'daily'
              ? addDays(base, 1)
              : t.recurrence === 'weekly'
                ? addDays(base, 7)
                : addMonths(base, 1)
          const nextId = uid('task')
          d.homeTasks.unshift({
            ...t,
            id: nextId,
            done: false,
            completedAt: undefined,
            createdAt: new Date().toISOString(),
            dueDate: toISODate(next),
            steps: t.steps?.map((s) => ({ ...s, id: uid('step'), done: false })),
            recurrenceNextId: undefined,
          })
          // серия живёт в копии; ссылка — для отката случайного выполнения
          t.recurrenceNextId = nextId
          t.recurrence = 'none'
        } else if (!t.done && t.recurrenceNextId) {
          // выполнение снято: забираем серию обратно — нетронутую копию удаляем
          const i = d.homeTasks.findIndex((x) => x.id === t.recurrenceNextId)
          const copy = i >= 0 ? d.homeTasks[i] : undefined
          if (copy && !copy.done) {
            t.recurrence = copy.recurrence
            d.homeTasks.splice(i, 1)
          }
          t.recurrenceNextId = undefined
        }
      })
    },
    deleteHomeTask(id) {
      const task = get().data.homeTasks.find((x) => x.id === id)
      mutate((d) => {
        d.homeTasks = d.homeTasks.filter((x) => x.id !== id)
      })
      // задача может нести описание и шаги с прогрессом — невосстановимо по памяти
      if (task) armUndo(task.title, () => mutate((d) => d.homeTasks.unshift(task)))
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
      const list = get().data.shoppingLists.find((x) => x.id === id)
      const idx = get().data.shoppingLists.findIndex((x) => x.id === id)
      mutate((d) => {
        d.shoppingLists = d.shoppingLists.filter((x) => x.id !== id)
      })
      if (list) armUndo(list.name, () => mutate((d) => d.shoppingLists.splice(Math.max(0, idx), 0, list)))
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
      tap()
      mutate((d) => {
        const l = d.shoppingLists.find((x) => x.id === listId)
        const it = l?.items.find((x) => x.id === itemId)
        if (it) {
          it.bought = !it.bought
          // снятие отметки «куплено» сбрасывает проведение в траты,
          // чтобы повторная покупка того же товара снова провелась
          if (!it.bought) delete it.exportedAt
        }
      })
    },
    deleteItem(listId, itemId) {
      const l0 = get().data.shoppingLists.find((x) => x.id === listId)
      const item = l0?.items.find((x) => x.id === itemId)
      const idx = l0?.items.findIndex((x) => x.id === itemId) ?? -1
      mutate((d) => {
        const l = d.shoppingLists.find((x) => x.id === listId)
        if (l) l.items = l.items.filter((x) => x.id !== itemId)
      })
      if (item)
        armUndo(item.name, () =>
          mutate((d) => {
            const l = d.shoppingLists.find((x) => x.id === listId)
            if (l && !l.items.some((i) => i.id === item.id)) l.items.splice(Math.max(0, idx), 0, item)
          }),
        )
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
      tap()
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
      const ev = get().data.calendarTasks.find((x) => x.id === id)
      mutate((d) => {
        d.calendarTasks = d.calendarTasks.filter((x) => x.id !== id)
      })
      if (ev) armUndo(ev.title, () => mutate((d) => d.calendarTasks.unshift(ev)))
    },

    // ---------- health ----------
    setHealthProfile(p) {
      mutate((d) => {
        d.healthProfile = { ...p, updatedAt: new Date().toISOString() }
        // первый замер веса в дневник, если его ещё нет на сегодня
        const today = todayISO()
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
      const w = get().data.weightLog.find((x) => x.id === id)
      mutate((d) => {
        d.weightLog = d.weightLog.filter((x) => x.id !== id)
      })
      if (w)
        armUndo(w.date, () =>
          mutate((d) => {
            d.weightLog.push(w)
            d.weightLog.sort((a, b) => a.date.localeCompare(b.date))
          }),
        )
    },
    addWater(ml) {
      tap()
      mutate((d) => {
        // локальная дата: UTC-slice ночью относил воду на «вчера»
        d.waterLog.unshift({ id: uid('water'), date: todayISO(), ml })
      })
    },
    deleteWater(id) {
      const w = get().data.waterLog.find((x) => x.id === id)
      mutate((d) => {
        d.waterLog = d.waterLog.filter((x) => x.id !== id)
      })
      if (w) armUndo(`${w.ml} мл`, () => mutate((d) => d.waterLog.unshift(w)))
    },
    addMeasurement(m) {
      mutate((d) => {
        d.measurements.unshift({ ...m, id: uid('meas') })
      })
    },
    deleteMeasurement(id) {
      const m = get().data.measurements.find((x) => x.id === id)
      mutate((d) => {
        d.measurements = d.measurements.filter((x) => x.id !== id)
      })
      if (m) armUndo(m.label, () => mutate((d) => d.measurements.unshift(m)))
    },
    addFood(entry) {
      tap()
      mutate((d) => {
        d.foodLog.unshift({ ...entry, id: uid('food') })
      })
    },
    deleteFood(id) {
      const f = get().data.foodLog.find((x) => x.id === id)
      mutate((d) => {
        d.foodLog = d.foodLog.filter((x) => x.id !== id)
      })
      if (f) armUndo(f.name, () => mutate((d) => d.foodLog.unshift(f)))
    },
    setFitnessPrefs(prefs) {
      mutate((d) => {
        d.fitnessPrefs = prefs
      })
    },
    addWorkoutLog(entry) {
      tap('medium')
      mutate((d) => {
        d.workoutLog.unshift({ ...entry, id: uid('wo') })
      })
    },
    deleteWorkoutLog(id) {
      const w = get().data.workoutLog.find((x) => x.id === id)
      mutate((d) => {
        d.workoutLog = d.workoutLog.filter((x) => x.id !== id)
      })
      if (w) armUndo(w.date, () => mutate((d) => d.workoutLog.unshift(w)))
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
      const card = get().data.cards.find((x) => x.id === id)
      const idx = get().data.cards.findIndex((x) => x.id === id)
      mutate((d) => {
        d.cards = d.cards.filter((x) => x.id !== id)
      })
      if (card) armUndo(card.label, () => mutate((d) => d.cards.splice(Math.max(0, idx), 0, card)))
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
    setPalette(palette) {
      mutate((d) => {
        d.settings.palette = palette
      })
    },
    setUserName(name) {
      mutate((d) => {
        d.settings.userName = name.trim() || undefined
      })
    },
    openOnboarding() {
      set({ onboardingOpen: true })
    },
    completeOnboarding({ name, language, baseCurrency, theme, palette, healthProfile, dashboardWidgets, cycleEnabled }) {
      mutate((d) => {
        d.settings.userName = name.trim() || undefined
        d.settings.language = language
        d.settings.baseCurrency = baseCurrency
        d.settings.theme = theme
        d.settings.palette = palette
        d.settings.cycleEnabled = cycleEnabled
        d.settings.onboarded = true
        if (dashboardWidgets) d.dashboardWidgets = dashboardWidgets
        if (healthProfile) {
          d.healthProfile = { ...healthProfile, updatedAt: new Date().toISOString() }
          // первый замер веса в дневник, если его ещё нет на сегодня (как setHealthProfile)
          const today = todayISO()
          if (!d.weightLog.some((w) => w.date === today)) {
            d.weightLog.push({ id: uid('w'), date: today, weight: healthProfile.weight })
          }
        }
      })
      set({ onboardingOpen: false })
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
      // при активном аккаунте восстановленный бэкап должен уехать в облако
      // и победить конфликты: перештамповываем записи и помечаем всё на выгрузку
      // (записи, существующие только в облаке, вернутся при следующем pull —
      // восстановление объединяет, а не удаляет чужое)
      if (get().account) stageAllForUpload(data, true)
      persist(data)
      saveBase(data)
      set({ data })
      if (get().account) void get().cloudSyncNow()
      // восстановление перезаписывает GitHub-облако
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
            // изменения, пришедшие из GitHub, должны попасть и в облачный outbox
            diffAndStamp(local, remote.data)
            persist(remote.data)
            saveBase(remote.data)
            saveSyncMeta({ sha: remote.sha ?? undefined, lastSyncAt })
            set({ data: remote.data, sync: { status: 'idle', configured: true, lastSyncAt } })
            rescheduleNotifications(remote.data)
            break
          }

          // 4) Иначе пушим слитый результат
          try {
            // штампы/outbox ДО пуша: изменения из GitHub-merge не должны
            // пройти мимо облачной синхронизации
            diffAndStamp(local, merged)
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
