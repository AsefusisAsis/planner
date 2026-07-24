import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { PageHeader } from '../../components/ui'
import CalcView from './views/CalcView'
import WeightView from './views/WeightView'
import MenuView from './views/MenuView'
import DiaryView from './views/DiaryView'
import WorkoutView from './views/WorkoutView'

// Цикл вынесен в отдельный раздел /cycle (modules/cycle) — репродуктивные
// данные это самостоятельный домен, cycle-first как в спец-приложениях.
type Tab = 'calc' | 'weight' | 'menu' | 'diary' | 'workout'

export default function HealthPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('calc')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'calc', label: t('health.tabCalc') },
    { key: 'weight', label: t('health.tabWeight') },
    { key: 'menu', label: t('health.tabMenu') },
    { key: 'diary', label: t('health.tabDiary') },
    { key: 'workout', label: t('health.tabWorkout') },
  ]

  return (
    <div>
      <PageHeader title={t('health.title')} subtitle={t('health.subtitle')} />

      {/* Дисклеймер */}
      <div
        className="mb-4 flex items-start gap-2 rounded-lg border p-3 text-xs"
        style={{
          background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--warning) 40%, transparent)',
          color: 'var(--text-2)',
        }}
      >
        <Info size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
        <span>{t('health.disclaimer')}</span>
      </div>

      {/* Вкладки */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg p-1" style={{ background: 'var(--bg-2)' }}>
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className="flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            style={
              tab === tb.key
                ? { background: 'var(--card)', color: 'var(--text)' }
                : { color: 'var(--text-2)' }
            }
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'calc' && <CalcView />}
      {tab === 'weight' && <WeightView />}
      {tab === 'menu' && <MenuView />}
      {tab === 'diary' && <DiaryView />}
      {tab === 'workout' && <WorkoutView />}
    </div>
  )
}
