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
import { merge } from '../services/merge'

const DATA_KEY = 'planner.data'

type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'error' | 'offline'

interface StoreState {
  data: AppData
  rates: RateTable | null
  ratesError: string | null

  sync: {
    status: SyncStatus
    error?: string
    lastSyncAt?: string
    configured: boolean
  }

  // ---- bootstrap ----
  init: () => Promise<void>
  refreshRates: (force?: boolean) => Promise<void>

  // ---- expenses ----
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => void
  updateExpense: (id: string, patch: Partial<Expense>) => void
  deleteExpense: (id: string) => void
  addCategory: (c: Omit<ExpenseCategory, 'id'>) => void
  updateCategory: (id: string, patch: Partial<ExpenseCategory>) => void
  deleteCategory: (id: string) => void

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
  addCalendarTask: (date: string, title: string) => void
  toggleCalendarTask: (id: string) => void
  updateCalendarTask: (id: string, patch: Partial<CalendarTask>) => void
  deleteCalendarTask: (id: string) => void

  // ---- settings ----
  setTheme: (t: ThemeMode) => void
  setLanguage: (l: Language) => void
  setBaseCurrency: (c: Currency) => void

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
    if (get().sync.configured) schedulePush(() => get().syncNow())
  }

  return {
    data: loadData(),
    rates: null,
    ratesError: null,
    sync: { status: 'disabled', configured: false },

    async init() {
      // тема применяется в App; здесь — курсы и синхронизация
      const cfg = loadGitHubConfig()
      set({ sync: { ...get().sync, configured: !!cfg, status: cfg ? 'idle' : 'disabled' } })
      await get().refreshRates()
      if (cfg) await get().syncNow()
    },

    async refreshRates(force = false) {
      try {
        const rates = await getRates(force)
        set({ rates, ratesError: null })
      } catch (e) {
        set({ ratesError: e instanceof Error ? e.message : 'Не удалось получить курсы' })
      }
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
    addCalendarTask(date, title) {
      mutate((d) => {
        d.calendarTasks.unshift({
          id: uid('cal'),
          date,
          title,
          done: false,
          createdAt: new Date().toISOString(),
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

    // ---------- github ----------
    async connectGitHub(cfg) {
      persistGitHubConfig(cfg)
      set({ sync: { ...get().sync, configured: true, status: 'idle' } })
      await get().syncNow()
    },
    disconnectGitHub() {
      persistGitHubConfig(null)
      saveSyncMeta({})
      set({ sync: { status: 'disabled', configured: false } })
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
        // До 4 попыток: при 409 (кто-то записал файл между нашими pull и push)
        // подтягиваем свежий SHA, сливаем и пишем снова.
        for (let attempt = 0; ; attempt++) {
          const remote = await pull(cfg)
          let data = get().data
          if (!remote.notFound && remote.data) {
            data = merge(data, remote.data)
          }
          try {
            const newSha = await push(cfg, data, remote.sha)
            persist(data)
            const lastSyncAt = new Date().toISOString()
            saveSyncMeta({ sha: newSha, lastSyncAt })
            set({ data, sync: { status: 'idle', configured: true, lastSyncAt } })
            break
          } catch (e) {
            const status = (e as { status?: number }).status
            if (status === 409 && attempt < 3) continue
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
