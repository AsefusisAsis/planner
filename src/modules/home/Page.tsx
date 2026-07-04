import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Pencil,
  Trash2,
  Repeat,
  Calendar,
  Home as HomeIcon,
  ChevronRight,
  AlignLeft,
  ListChecks,
  X,
  AlertTriangle,
  CalendarDays,
  CalendarClock,
  Inbox,
  CheckCircle2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../../store'
import { Button, IconButton, Card, PageHeader, Modal, Field, Fab } from '../../components/ui'
import { tap } from '../../lib/haptics'
import type { HomeTask, Priority, Recurrence, TaskStep } from '../../types'
import { todayISO, uid } from '../../lib/id'

type Filter = 'all' | 'active' | 'done'

const PRIORITIES: Priority[] = ['low', 'medium', 'high']
const RECURRENCES: Recurrence[] = ['none', 'daily', 'weekly', 'monthly']

/** Ключи секций группировки активных задач. */
type SectionKey = 'overdue' | 'today' | 'upcoming' | 'nodate'

/** Цвет приоритета через CSS-переменные. */
function priorityColor(p: Priority): string {
  return p === 'high' ? 'var(--danger)' : p === 'medium' ? 'var(--warning)' : 'var(--text-3)'
}

interface FormState {
  title: string
  priority: Priority
  recurrence: Recurrence
  dueDate: string
  description: string
  steps: TaskStep[]
}

const EMPTY_FORM: FormState = {
  title: '',
  priority: 'medium',
  recurrence: 'none',
  dueDate: '',
  description: '',
  steps: [],
}

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
  const [newStep, setNewStep] = useState('')
  // раскрытые задачи в списке
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

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

  const today = todayISO()

  const activeCount = useMemo(() => tasks.filter((x) => !x.done).length, [tasks])

  // Активные задачи, сгруппированные по сроку.
  const groups = useMemo(() => {
    const active = tasks.filter((x) => !x.done)
    const overdue: HomeTask[] = []
    const todayTasks: HomeTask[] = []
    const upcoming: HomeTask[] = []
    const nodate: HomeTask[] = []
    for (const tsk of active) {
      if (!tsk.dueDate) nodate.push(tsk)
      else if (tsk.dueDate < today) overdue.push(tsk)
      else if (tsk.dueDate === today) todayTasks.push(tsk)
      else upcoming.push(tsk)
    }
    // Просрочено — ближе к сегодня сверху; Ближайшие — по возрастанию срока.
    overdue.sort((a, b) => (b.dueDate ?? '').localeCompare(a.dueDate ?? ''))
    upcoming.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    return { overdue, today: todayTasks, upcoming, nodate }
  }, [tasks, today])

  // Выполненные задачи (для фильтров «Все» и «Выполненные»).
  const doneTasks = useMemo(() => tasks.filter((x) => x.done), [tasks])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setNewStep('')
    setModalOpen(true)
  }

  function openEdit(task: HomeTask) {
    setEditing(task)
    setForm({
      title: task.title,
      priority: task.priority,
      recurrence: task.recurrence,
      dueDate: task.dueDate ?? '',
      description: task.description ?? '',
      steps: task.steps ? task.steps.map((s) => ({ ...s })) : [],
    })
    setNewStep('')
    setModalOpen(true)
  }

  function addStep() {
    const title = newStep.trim()
    if (!title) return
    setForm((f) => ({ ...f, steps: [...f.steps, { id: uid('step'), title, done: false }] }))
    setNewStep('')
  }

  function removeStep(stepId: string) {
    setForm((f) => ({ ...f, steps: f.steps.filter((s) => s.id !== stepId) }))
  }

  function toggleFormStep(stepId: string) {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)),
    }))
  }

  function handleSubmit() {
    const title = form.title.trim()
    if (!title) return
    const description = form.description.trim()
    const payload = {
      title,
      priority: form.priority,
      recurrence: form.recurrence,
      dueDate: form.dueDate || undefined,
      description: description || undefined,
      steps: form.steps.length ? form.steps : undefined,
    }
    if (editing) {
      updateHomeTask(editing.id, payload)
    } else {
      addHomeTask(payload)
    }
    setModalOpen(false)
  }

  /** Переключить done у конкретного шага задачи прямо в списке. */
  function toggleTaskStep(task: HomeTask, stepId: string) {
    if (!task.steps) return
    const steps = task.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s))
    updateHomeTask(task.id, { steps })
  }

  const filters: Filter[] = ['all', 'active', 'done']
  const filterLabel: Record<Filter, string> = {
    all: t('home.filterAll'),
    active: t('home.filterActive'),
    done: t('home.filterDone'),
  }

  const sectionMeta: Record<SectionKey, { label: string; icon: ReactNode; color: string }> = {
    overdue: { label: t('home.sectionOverdue'), icon: <AlertTriangle size={15} />, color: 'var(--danger)' },
    today: { label: t('home.sectionToday'), icon: <CalendarDays size={15} />, color: 'var(--accent)' },
    upcoming: { label: t('home.sectionUpcoming'), icon: <CalendarClock size={15} />, color: 'var(--text-2)' },
    nodate: { label: t('home.sectionNoDate'), icon: <Inbox size={15} />, color: 'var(--text-2)' },
  }

  /** Карточка одной задачи (общий рендер для всех секций). */
  function renderTask(task: HomeTask): ReactNode {
    const overdue = !task.done && !!task.dueDate && task.dueDate < today
    const steps = task.steps ?? []
    const total = steps.length
    const doneCount = steps.filter((s) => s.done).length
    const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
    const hasDescription = !!task.description && task.description.trim().length > 0
    const expandable = total > 0 || hasDescription
    const isOpen = !!expanded[task.id]
    return (
      <Card key={task.id} className="flex flex-col">
        <div className="flex items-start gap-3">
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
            <div className="flex items-center gap-1.5">
              {expandable && (
                <button
                  onClick={() => setExpanded((m) => ({ ...m, [task.id]: !m[task.id] }))}
                  aria-label={isOpen ? t('home.collapse') : t('home.expand')}
                  aria-expanded={isOpen}
                  className="-ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-[var(--bg-3)]"
                  style={{ color: 'var(--text-2)' }}
                >
                  <ChevronRight
                    size={16}
                    style={{
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.15s',
                    }}
                  />
                </button>
              )}
              <span
                className="text-sm font-medium"
                style={{
                  textDecoration: task.done ? 'line-through' : 'none',
                  color: task.done ? 'var(--text-3)' : 'var(--text)',
                }}
              >
                {task.title}
              </span>
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

              {/* Индикатор описания */}
              {hasDescription && (
                <span
                  className="inline-flex items-center gap-1"
                  style={{ color: 'var(--text-2)' }}
                  title={t('home.hasDescription')}
                >
                  <AlignLeft size={13} />
                </span>
              )}

              {/* Прогресс шагов */}
              {total > 0 && (
                <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-2)' }}>
                  <ListChecks size={13} />
                  {doneCount}/{total}
                </span>
              )}
            </div>

            {/* Мини-полоса прогресса */}
            {total > 0 && (
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                style={{ background: 'var(--bg-3)' }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100 ? 'var(--success)' : 'var(--accent)',
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center">
            <IconButton onClick={() => openEdit(task)} aria-label={t('home.edit')}>
              <Pencil size={16} />
            </IconButton>
            <IconButton onClick={() => deleteHomeTask(task.id)} aria-label={t('home.delete')}>
              <Trash2 size={16} />
            </IconButton>
          </div>
        </div>

        {/* Раскрытая часть: описание + шаги */}
        {expandable && isOpen && (
          <div className="mt-3 border-t pt-3 pl-8" style={{ borderColor: 'var(--border)' }}>
            {hasDescription && (
              <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-2)' }}>
                {task.description}
              </p>
            )}

            {total > 0 && (
              <ul className={`space-y-1.5 ${hasDescription ? 'mt-3' : ''}`}>
                {steps.map((s) => (
                  <li key={s.id} className="flex items-start gap-2">
                    <button
                      onClick={() => toggleTaskStep(task, s.id)}
                      aria-label={s.title}
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
                      style={{
                        borderColor: s.done ? 'var(--success)' : 'var(--border)',
                        background: s.done ? 'var(--success)' : 'transparent',
                      }}
                    >
                      {s.done && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span
                      className="text-sm"
                      style={{
                        textDecoration: s.done ? 'line-through' : 'none',
                        color: s.done ? 'var(--text-3)' : 'var(--text)',
                      }}
                    >
                      {s.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    )
  }

  /** Секция с заголовком, счётчиком и списком задач. Возвращает null, если пусто. */
  function renderSection(key: SectionKey, list: HomeTask[]): ReactNode {
    if (list.length === 0) return null
    const meta = sectionMeta[key]
    return (
      <section key={key} className="break-inside-avoid">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: meta.color }}>
          {meta.icon}
          {meta.label}
          <span className="text-xs font-normal" style={{ color: 'var(--text-3)' }}>
            {list.length}
          </span>
        </h2>
        <div className="space-y-2">{list.map(renderTask)}</div>
      </section>
    )
  }

  /** Пустое состояние с иконкой, текстом и CTA «Добавить задачу». */
  function renderEmpty(text: string): ReactNode {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span style={{ color: 'var(--text-3)' }}>
          <HomeIcon size={32} />
        </span>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>
          {text}
        </p>
        <Button onClick={openAdd}>
          <Plus size={16} />
          {t('home.add')}
        </Button>
      </div>
    )
  }

  // ---- Контент по фильтрам ----
  const activeTotal =
    groups.overdue.length + groups.today.length + groups.upcoming.length + groups.nodate.length

  let content: ReactNode
  if (filter === 'done') {
    content =
      doneTasks.length === 0 ? (
        renderEmpty(t('home.emptyDone'))
      ) : (
        <div className="space-y-2 lg:columns-2 lg:gap-4 lg:space-y-0 [&>*]:lg:mb-2 [&>*]:lg:break-inside-avoid">
          {doneTasks.map(renderTask)}
        </div>
      )
  } else if (filter === 'active') {
    content =
      activeTotal === 0 ? (
        renderEmpty(t('home.emptyActive'))
      ) : (
        <div className="space-y-6 lg:columns-2 lg:gap-6 lg:space-y-0 [&>section]:lg:mb-6">
          {renderSection('overdue', groups.overdue)}
          {renderSection('today', groups.today)}
          {renderSection('upcoming', groups.upcoming)}
          {renderSection('nodate', groups.nodate)}
        </div>
      )
  } else {
    // all
    content =
      activeTotal === 0 && doneTasks.length === 0 ? (
        renderEmpty(t('home.empty'))
      ) : (
        <div className="space-y-6 lg:columns-2 lg:gap-6 lg:space-y-0 [&>section]:lg:mb-6">
          {renderSection('overdue', groups.overdue)}
          {renderSection('today', groups.today)}
          {renderSection('upcoming', groups.upcoming)}
          {renderSection('nodate', groups.nodate)}
          {doneTasks.length > 0 && (
            <section className="break-inside-avoid">
              <h2
                className="mb-2 flex items-center gap-2 text-sm font-semibold"
                style={{ color: 'var(--text-2)' }}
              >
                <CheckCircle2 size={15} />
                {t('home.sectionDone')}
                <span className="text-xs font-normal" style={{ color: 'var(--text-3)' }}>
                  {doneTasks.length}
                </span>
              </h2>
              <div className="space-y-2">{doneTasks.map(renderTask)}</div>
            </section>
          )}
        </div>
      )
  }

  return (
    <div>
      <PageHeader
        title={t('home.title')}
        subtitle={t('home.activeCount', { count: activeCount })}
        action={
          // На мобильном кнопку в шапке прячем — там её дублирует FAB
          <div className="hidden sm:block">
            <Button onClick={openAdd}>
              <Plus size={16} />
              {t('home.add')}
            </Button>
          </div>
        }
      />

      {/* Фильтр */}
      <div className="mb-5 grid grid-cols-3 gap-2 sm:inline-grid sm:w-auto">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-lg border px-3 py-2 text-sm transition-colors sm:px-5"
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

      {content}

      {/* FAB «новая задача» на мобильном; при открытой модалке не показываем */}
      {!modalOpen && (
        <Fab
          label={t('home.add')}
          onClick={() => {
            tap('light')
            openAdd()
          }}
        />
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

        <Field label={t('home.descriptionLabel')}>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder={t('home.descriptionPlaceholder')}
          />
        </Field>

        <Field label={t('home.steps')}>
          <div className="space-y-2">
            {form.steps.length > 0 && (
              <ul className="space-y-1.5">
                {form.steps.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFormStep(s.id)}
                      aria-label={s.title}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
                      style={{
                        borderColor: s.done ? 'var(--success)' : 'var(--border)',
                        background: s.done ? 'var(--success)' : 'transparent',
                      }}
                    >
                      {s.done && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span
                      className="min-w-0 flex-1 truncate text-sm"
                      style={{
                        textDecoration: s.done ? 'line-through' : 'none',
                        color: s.done ? 'var(--text-3)' : 'var(--text)',
                      }}
                    >
                      {s.title}
                    </span>
                    <IconButton
                      onClick={() => removeStep(s.id)}
                      aria-label={t('home.deleteStep')}
                      className="h-7 w-7"
                    >
                      <X size={14} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <input
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                placeholder={t('home.stepPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addStep()
                  }
                }}
              />
              <Button variant="subtle" onClick={addStep} disabled={!newStep.trim()}>
                <Plus size={16} />
              </Button>
            </div>
          </div>
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
