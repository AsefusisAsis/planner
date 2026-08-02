import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Home as HomeIcon, Plus } from 'lucide-react'
import { useStore } from '../../store'
import { useVoice } from '../../lib/voice'
import { Button, Checkbox, CollapsibleCard } from '../../components/ui'
import { todayISO } from '../../lib/id'

/** Задачи по дому: пять ближайших активных + быстрый ввод новой. */
export function TasksWidget() {
  const { t } = useTranslation()
  const vt = useVoice()
  const homeTasks = useStore((s) => s.data.homeTasks)
  const addHomeTask = useStore((s) => s.addHomeTask)
  const toggleHomeTask = useStore((s) => s.toggleHomeTask)
  const today = todayISO()

  const [qaTask, setQaTask] = useState('')
  function quickAddTask() {
    const tt = qaTask.trim()
    if (!tt) return
    addHomeTask({ title: tt, priority: 'medium', recurrence: 'none' })
    setQaTask('')
  }

  const activeTasks = useMemo(() => {
    const rank = (x: (typeof homeTasks)[number]) =>
      x.dueDate && x.dueDate < today ? 0 : x.dueDate === today ? 1 : 2
    return homeTasks.filter((x) => !x.done).sort((a, b) => rank(a) - rank(b))
  }, [homeTasks, today])

  return (
    <CollapsibleCard
      id="tasks"
      icon={<HomeIcon size={16} style={{ color: 'var(--accent)' }} />}
      title={t('dashboard.wTasks')}
      summary={
        activeTasks.length > 0 ? (
          <span className="tnum text-xs text-[var(--text-3)]">{activeTasks.length}</span>
        ) : undefined
      }
    >
      {activeTasks.length === 0 ? (
        <p className="mb-2 text-sm text-[var(--text-3)]">{t('dashboard.noTasksW')}</p>
      ) : (
        <ul className="mb-3 space-y-1.5">
          {activeTasks.slice(0, 5).map((x) => {
            const overdue = x.dueDate && x.dueDate < today
            return (
              <li key={x.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={x.done} onChange={() => toggleHomeTask(x.id)} label={x.title} />
                {/* весь текст задачи — тоже цель нажатия «завершить»: на
                    телефоне попасть по одному чекбоксу 24px тяжело */}
                <button onClick={() => toggleHomeTask(x.id)} className="min-w-0 flex-1 truncate py-1 text-left">
                  {x.title}
                </button>
                {overdue && <span className="text-xs" style={{ color: 'var(--danger)' }}>{vt('dashboard.overdue')}</span>}
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={qaTask}
          onChange={(e) => setQaTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && quickAddTask()}
          placeholder={t('dashboard.qaTask')}
          className="min-w-0 flex-1"
        />
        {/* только иконка — без aria-label скринридер объявит кнопку
            безымянной (у соседней кнопки денег подпись уже есть) */}
        <Button onClick={quickAddTask} disabled={!qaTask.trim()} aria-label={t('common.add')} className="shrink-0">
          <Plus size={16} />
        </Button>
      </div>
    </CollapsibleCard>
  )
}
