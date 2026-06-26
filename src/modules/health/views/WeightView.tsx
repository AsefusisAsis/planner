import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Scale } from 'lucide-react'
import { useStore } from '../../../store'
import { Button, Card, Empty, Field, IconButton } from '../../../components/ui'
import { LineChart } from '../../../components/LineChart'
import { todayISO } from '../../../lib/id'

/** dd.mm из ISO YYYY-MM-DD без внешних зависимостей. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}.${m}`
}

export default function WeightView() {
  const { t } = useTranslation()

  const profile = useStore((s) => s.data.healthProfile)
  const weightLog = useStore((s) => s.data.weightLog)
  const addWeight = useStore((s) => s.addWeight)
  const deleteWeight = useStore((s) => s.deleteWeight)

  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(todayISO())

  // По возрастанию даты — для графика и расчёта изменения.
  const ascending = useMemo(
    () => [...weightLog].sort((a, b) => a.date.localeCompare(b.date)),
    [weightLog],
  )
  // По убыванию даты — для списка.
  const descending = useMemo(() => [...ascending].reverse(), [ascending])

  const chartData = useMemo(
    () => ascending.map((w) => ({ label: shortDate(w.date), value: w.weight })),
    [ascending],
  )

  const first = ascending[0]
  const last = ascending[ascending.length - 1]
  const current = last?.weight ?? null
  const goal = profile?.goalWeight ?? null

  // Общее изменение с первого замера (если замеров >= 2).
  const change = ascending.length >= 2 && first && last ? last.weight - first.weight : null

  // Движемся ли к цели? Знак изменения должен совпадать со знаком (goal - first).
  let changeColor = 'var(--text-2)'
  if (change != null && goal != null && first) {
    const want = goal - first.weight
    if (Math.abs(want) < 0.05) {
      changeColor = 'var(--text-2)'
    } else if (Math.sign(change) === Math.sign(want)) {
      changeColor = 'var(--success)'
    } else {
      changeColor = 'var(--danger)'
    }
  }

  const weightNum = Number(weight)
  const weightValid = Number.isFinite(weightNum) && weightNum > 0

  function submit() {
    if (!weightValid || !date) return
    addWeight(date, weightNum)
    setWeight('')
    setDate(todayISO())
  }

  function formatChange(v: number): string {
    const rounded = Math.round(v * 10) / 10
    const sign = rounded > 0 ? '+' : ''
    return `${sign}${rounded} ${t('health.wKg')}`
  }

  return (
    <div className="space-y-4">
      {/* Форма добавления замера */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">{t('health.wAddTitle')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('health.wWeight')}>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={weight}
              placeholder={t('health.wWeightPlaceholder')}
              onChange={(ev) => setWeight(ev.target.value)}
            />
          </Field>
          <Field label={t('health.wDate')}>
            <input
              type="date"
              value={date}
              onChange={(ev) => setDate(ev.target.value || todayISO())}
            />
          </Field>
        </div>
        <Button onClick={submit} disabled={!weightValid}>
          <Plus size={16} /> {t('health.wAdd')}
        </Button>
      </Card>

      {weightLog.length === 0 ? (
        <Card>
          <Empty icon={<Scale size={28} />} text={t('health.wEmpty')} />
        </Card>
      ) : (
        <>
          {/* Сводка */}
          <Card>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xs text-[var(--text-3)]">{t('health.wSummaryCurrent')}</div>
                <div className="mt-1 text-lg font-semibold">
                  {current != null ? `${current} ${t('health.wKg')}` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-3)]">{t('health.wSummaryGoal')}</div>
                <div className="mt-1 text-lg font-semibold">
                  {goal != null ? `${goal} ${t('health.wKg')}` : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-3)]">{t('health.wSummaryChange')}</div>
                <div className="mt-1 text-lg font-semibold" style={{ color: changeColor }}>
                  {change != null ? formatChange(change) : '—'}
                </div>
              </div>
            </div>
          </Card>

          {/* График динамики */}
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">{t('health.wChartTitle')}</h2>
            <LineChart
              data={chartData}
              goal={profile?.goalWeight}
              unit={` ${t('health.wKg')}`}
            />
          </Card>

          {/* История замеров */}
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">{t('health.wLogTitle')}</h2>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {descending.map((w) => (
                <div key={w.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 text-sm text-[var(--text-2)]">{shortDate(w.date)}</span>
                  <span className="text-sm font-medium">
                    {w.weight} {t('health.wKg')}
                  </span>
                  <IconButton onClick={() => deleteWeight(w.id)} aria-label={t('health.wDelete')}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
