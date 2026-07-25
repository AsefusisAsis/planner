import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Droplet, Plus, Minus } from 'lucide-react'
import { useStore } from '../../store'
import { Card } from '../../components/ui'
import { todayISO } from '../../lib/id'
import { computeHealth } from '../health/calc'

/**
 * Заметный виджет воды на Главной: круговое кольцо прогресса к дневной цели
 * + быстрое добавление стакана. Цель — из профиля здоровья (computeHealth);
 * если профиля нет, цель не показываем, только счётчик выпитого.
 */
export function WaterWidget() {
  const { t } = useTranslation()
  const waterLog = useStore((s) => s.data.waterLog)
  const profile = useStore((s) => s.data.healthProfile)
  const addWater = useStore((s) => s.addWater)
  const today = todayISO()

  const drunk = useMemo(
    () => waterLog.filter((w) => w.date === today).reduce((s, w) => s + w.ml, 0),
    [waterLog, today],
  )
  const goal = profile ? computeHealth(profile).waterMl : null
  const pct = goal ? Math.min(1, drunk / goal) : 0
  const reached = goal != null && drunk >= goal

  // кольцо прогресса (SVG)
  const size = 120
  const stroke = 12
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const accent = reached ? 'var(--success)' : 'var(--accent)'

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Droplet size={16} style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-semibold">{t('dashboard.wWater')}</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
            {goal != null && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={accent}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - pct)}
                style={{ transition: 'stroke-dashoffset .5s var(--ease, ease), stroke .3s' }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tabular-nums tnum">{drunk}</span>
            <span className="text-[11px] text-[var(--text-3)]">
              {goal != null ? `/ ${goal} ${t('health.waterMlUnit')}` : t('health.waterMlUnit')}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <button
            onClick={() => addWater(250)}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={16} /> 250 {t('health.waterMlUnit')}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => addWater(500)}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 text-sm font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              <Plus size={15} /> 500
            </button>
            <button
              onClick={() => drunk > 0 && addWater(-Math.min(250, drunk))}
              disabled={drunk <= 0}
              aria-label={t('health.waterMinus')}
              className="flex items-center justify-center rounded-xl border px-3 py-2 text-[var(--text-3)] disabled:opacity-40"
              style={{ borderColor: 'var(--border)' }}
            >
              <Minus size={15} />
            </button>
          </div>
          {reached && (
            <span className="text-center text-xs font-medium" style={{ color: 'var(--success-text)' }}>
              {t('health.waterReached')}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}
