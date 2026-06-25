import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, Repeat, Calendar, Home as HomeIcon } from 'lucide-react'
import { useStore } from '../../store'
import { Button, IconButton, Card, PageHeader, Empty, Modal, Field } from '../../components/ui'
import type { HomeTask, Priority, Recurrence } from '../../types'
import { todayISO } from '../../lib/id'

type Filter = 'all' | 'active' | 'done'

const PRIORITIES: Priority[] = ['low', 'medium', 'high']
const RECURRENCES: Recurrence[] = ['none', 'daily', 'weekly', 'monthly']

/** Цвет приоритета через CSS-переменные. */
function priorityColor(p: Priority): string {
  return p === 'high' ? 'var(--danger)' : p === 'medium' ? 'var(--warning)' : 'var(--text-3)'
}

interface FormState {
  title: string
  priority: Priority
  recurrence: Recurrence
  dueDate: string
}

const EMPTY_FORM: FormState = { title: '', priority: 'medium', recurrence: 'none', dueDate: '' }

export default function HomePage() {
  const { t } = useTranslation()
  const tasks = useStore((s) => s.data.homeTasks)
  const addHomeTask = useStore((s) => s.addHomeTask)
  const updateHomeTask = useStore((s) => s.updateHomeTask)
  const toggleHomeTask = useStore((s) => s.toggleHomeTask)
  const deleteHomeTask = useStore((s) => s.deleteHomeTask)

  const [filter, setFilter] = useState<Filter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<HomeTask | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const priorityLabel: Record<Priority, string> = {
    low: t('home.priorityLow'),
    medium: t('home.priorityMedium'),
    high: t('home.priorityHigh'),
  }
  const recurrenceLabel: Record<Recurrence, string> = {
    none: t('home.recurrenceNone'),
    daily: t('home.recurrenceDaily'),
    weekly: t('home.recurrenceWeekly'),
    monthly: t('home.recurrenceMonthly'),
  }

  const activeCount = useMemo(() => tasks.filter((x) => !x.done).length, [tasks])

  // сортировка: невыполненные сверху, выполненные уезжают вниз
  const visible = useMemo(() => {
    const filtered = tasks.filter((x) =>
      filter === 'active' ? !x.done : filter === 'done' ? x.done : true,
    )
    return [...filtered].sort((a, b) => Number(a.done) - Number(b.done))
  }, [tasks, filter])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(task: HomeTask) {
    setEditing(task)
    setForm({
      title: task.title,
      priority: task.priority,
      recurrence: task.recurrence,
      dueDate: task.dueDate ?? '',
    })
    setModalOpen(true)
  }

  function handleSubmit() {
    const title = form.title.trim()
    if (!title) return
    const payload = {
      title,
      priority: form.priority,
      recurrence: form.recurrence,
      dueDate: form.dueDate || undefined,
    }
    if (editing) {
      updateHomeTask(editing.id, payload)
    } else {
      addHomeTask(payload)
    }
    setModalOpen(false)
  }

  const today = todayISO()
  const filters: Filter[] = ['all', 'active', 'done']
  const filterLabel: Record<Filter, string> = {
    all: t('home.filterAll'),
    active: t('home.filterActive'),
    done: t('home.filterDone'),
  }

  const emptyText =
    filter === 'active'
      ? t('home.emptyActive')
      : filter === 'done'
        ? t('home.emptyDone')
        : t('home.empty')

  return (
    <div>
      <PageHeader
        title={t('home.title')}
        subtitle={t('home.activeCount', { count: activeCount })}
        action={
          <Button onClick={openAdd}>
            <Plus size={16} />
            {t('home.add')}
          </Button>
        }
      />

      {/* Фильтр */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-lg border px-3 py-2 text-sm transition-colors"
            style={{
              borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
              background:
                filter === f ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
              color: filter === f ? 'var(--accent)' : 'var(--text-2)',
            }}
          >
            {filterLabel[f]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Empty icon={<HomeIcon size={32} />} text={emptyText} />
      ) : (
        <div className="space-y-2">
          {visible.map((task) => {
            const overdue = !task.done && !!task.dueDate && task.dueDate < today
            return (
              <Card key={task.id} className="flex items-start gap-3">
                <button
                  onClick={() => toggleHomeTask(task.id)}
                  aria-label={task.title}
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors"
                  style={{
                    borderColor: task.done ? 'var(--success)' : 'var(--border)',
                    background: task.done ? 'var(--success)' : 'transparent',
                  }}
                >
                  {task.done && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-medium"
                    style={{
                      textDecoration: task.done ? 'line-through' : 'none',
                      color: task.done ? 'var(--text-3)' : 'var(--text)',
                    }}
                  >
                    {task.title}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {/* Приоритет */}
                    <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: priorityColor(task.priority) }}
                      />
                      {priorityLabel[task.priority]}
                    </span>

                    {/* Повторяемость */}
                    {task.recurrence !== 'none' && (
                      <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-2)' }}>
                        <Repeat size={13} />
                        {recurrenceLabel[task.recurrence]}
                      </span>
                    )}

                    {/* Срок */}
                    {task.dueDate && (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: overdue ? 'var(--danger)' : 'var(--text-2)' }}
                      >
                        <Calendar size={13} />
                        {t('home.due')} {task.dueDate}
                        {overdue && ` · ${t('home.overdue')}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center">
                  <IconButton onClick={() => openEdit(task)} aria-label={t('home.edit')}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton onClick={() => deleteHomeTask(task.id)} aria-label={t('home.delete')}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('home.editTask') : t('home.newTask')}
      >
        <Field label={t('home.titleLabel')}>
          <input
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={t('home.titlePlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </Field>

        <Field label={t('home.priority')}>
          <div className="grid grid-cols-3 gap-2">
            {PRIORITIES.map((p) => {
              const selected = form.priority === p
              return (
                <button
                  key={p}
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors"
                  style={{
                    borderColor: selected ? priorityColor(p) : 'var(--border)',
                    background: selected
                      ? `color-mix(in srgb, ${priorityColor(p)} 14%, transparent)`
                      : 'transparent',
                    color: selected ? priorityColor(p) : 'var(--text-2)',
                  }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: priorityColor(p) }}
                  />
                  {priorityLabel[p]}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label={t('home.recurrence')}>
          <select
            value={form.recurrence}
            onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as Recurrence }))}
          >
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {recurrenceLabel[r]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('home.dueDate')}>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
          />
        </Field>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            {t('home.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!form.title.trim()}>
            {t('home.save')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
