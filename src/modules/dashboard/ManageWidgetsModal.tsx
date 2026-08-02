import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useStore } from '../../store'
import { Checkbox, IconButton, Modal } from '../../components/ui'
import { ALL_WIDGETS, type WidgetId } from '../../types'

/**
 * Настройка Главной: какие виджеты показывать и в каком порядке.
 *
 * Список включённых передаётся пропом, а не читается из стора: страница уже
 * отфильтровала его от неизвестных id (после обновления в сохранённых
 * настройках может остаться виджет, которого больше нет), и второй,
 * нефильтрованный источник здесь означал бы расхождение.
 */
export function ManageWidgetsModal({
  open,
  onClose,
  widgets,
}: {
  open: boolean
  onClose: () => void
  widgets: WidgetId[]
}) {
  const { t } = useTranslation()
  const setDashboardWidgets = useStore((s) => s.setDashboardWidgets)

  function toggleWidget(id: WidgetId) {
    setDashboardWidgets(widgets.includes(id) ? widgets.filter((x) => x !== id) : [...widgets, id])
  }
  function moveWidget(id: WidgetId, dir: -1 | 1) {
    const i = widgets.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= widgets.length) return
    const next = [...widgets]
    ;[next[i], next[j]] = [next[j], next[i]]
    setDashboardWidgets(next)
  }

  const widgetName: Record<WidgetId, string> = {
    reminders: t('dashboard.wReminders'),
    nownext: t('dashboard.nowNext'),
    finance: t('dashboard.wFinance'),
    cards: t('dashboard.wCards'),
    tasks: t('dashboard.wTasks'),
    calendar: t('dashboard.wCalendar'),
    shopping: t('dashboard.wShopping'),
    water: t('dashboard.wWater'),
    workout: t('dashboard.wWorkout'),
  }

  return (
    <Modal open={open} onClose={onClose} title={t('dashboard.manageTitle')}>
      <ul className="space-y-1.5">
        {ALL_WIDGETS.map((id) => {
          const enabled = widgets.includes(id)
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              style={{ background: 'var(--bg-2)' }}
            >
              <Checkbox checked={enabled} onChange={() => toggleWidget(id)} label={widgetName[id]} />
              <span className="flex-1 text-sm">{widgetName[id]}</span>
              {enabled && (
                <span className="flex shrink-0">
                  <IconButton onClick={() => moveWidget(id, -1)} aria-label="up"><ArrowUp size={14} /></IconButton>
                  <IconButton onClick={() => moveWidget(id, 1)} aria-label="down"><ArrowDown size={14} /></IconButton>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
