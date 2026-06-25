# Контракт для модулей (внутренний, для разработки)

Каждый модуль живёт в `src/modules/<name>/` и состоит ровно из ДВУХ файлов:
- `Page.tsx` — `export default function …Page()` (без пропсов), React-компонент страницы.
- `i18n.ts` — `export default { ru: {...}, en: {...} }`, строки под собственным неймспейсом.

НЕ трогать общие файлы: `store/index.ts`, `types.ts`, `i18n/index.ts`, `i18n/base.ts`, `App.tsx`, `components/*`.

## Стор (zustand) — `import { useStore } from '../../store'`
Селекторы: `useStore(s => s.data.<...>)`, `useStore(s => s.rates)`.
Данные: `data.expenses`, `data.expenseCategories`, `data.homeTasks`, `data.shoppingLists`,
`data.calendarTasks`, `data.settings.baseCurrency`.

Экшены (все автоматически сохраняют и синхронизируют):
- Траты: `addExpense({amount,currency,categoryId,note,date})`, `updateExpense(id,patch)`, `deleteExpense(id)`,
  `addCategory({name,color,budget?})`, `updateCategory(id,patch)`, `deleteCategory(id)`
- Дом: `addHomeTask({title,priority,recurrence,dueDate?})`, `updateHomeTask(id,patch)`, `toggleHomeTask(id)`, `deleteHomeTask(id)`
- Покупки: `addList(name)`, `renameList(id,name)`, `deleteList(id)`,
  `addItem(listId,{name,qty,price?,currency?})`, `updateItem(listId,itemId,patch)`, `toggleItem(listId,itemId)`, `deleteItem(listId,itemId)`
- Календарь: `addCalendarTask(date,title)`, `toggleCalendarTask(id)`, `updateCalendarTask(id,patch)`, `deleteCalendarTask(id)`

## Типы — `import type {...} from '../../types'`
`Currency='BYN'|'USD'|'RUB'`, `CURRENCIES`, `Priority='low'|'medium'|'high'`,
`Recurrence='none'|'daily'|'weekly'|'monthly'`, `Expense`, `ExpenseCategory`, `HomeTask`,
`ShoppingList`, `ShoppingItem`, `CalendarTask`.

## Валюты — `import { convert, formatMoney } from '../../services/nbrb'`
`convert(amount, from, to, rates)` — `rates = useStore(s => s.rates)` (может быть null → показать сумму как есть).
`formatMoney(amount, currency)`.

## UI-кит — `import { Button, IconButton, Card, PageHeader, Empty, Modal, Field } from '../../components/ui'`
- `<Button variant="primary|ghost|danger|subtle">`
- `<Card>`, `<PageHeader title subtitle? action?>`, `<Empty icon? text>`
- `<Modal open onClose title>`, `<Field label>`

## Стиль
Tailwind v4. Цвета только через CSS-переменные: `var(--bg) --bg-2 --bg-3 --card --text --text-2 --text-3 --border --accent --success --warning --danger`.
Иконки — `lucide-react`. Даты — `date-fns` или `lib/id` (`todayISO`, `toISODate`).
Адаптив: страница рендерится внутри `max-w-3xl`, на телефоне снизу таб-бар (учитывать `pb`).

## i18n
`Page` использует `useTranslation()` → `t('<ns>.key')`. Неймспейс = имя модуля
(`expenses` / `home` / `shopping` / `calendar`). Все строки — и ru, и en.
