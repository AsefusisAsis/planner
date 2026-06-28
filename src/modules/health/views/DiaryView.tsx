import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, UtensilsCrossed, Droplet, Undo2 } from 'lucide-react'
import { useStore } from '../../../store'
import { Button, Card, Empty, Field, IconButton, Modal } from '../../../components/ui'
import { computeHealth } from '../calc'
import { FOODS, findFood, type Food } from '../foods'
import { todayISO, toISODate } from '../../../lib/id'
import { Donut } from '../../../components/Donut'

type Mode = 'base' | 'custom'

interface Portion {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

/** Пересчёт значений «на 100 г» в порцию заданной массы. */
function portionOf(per100: Portion, grams: number): Portion {
  const factor = grams / 100
  return {
    kcal: Math.round(per100.kcal * factor),
    protein: Math.round(per100.protein * factor * 10) / 10,
    fat: Math.round(per100.fat * factor * 10) / 10,
    carbs: Math.round(per100.carbs * factor * 10) / 10,
  }
}

export default function DiaryView() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('ru') ? 'ru' : 'en'

  const profile = useStore((s) => s.data.healthProfile)
  const foodLog = useStore((s) => s.data.foodLog)
  const addFood = useStore((s) => s.addFood)
  const deleteFood = useStore((s) => s.deleteFood)

  const waterLog = useStore((s) => s.data.waterLog)
  const addWater = useStore((s) => s.addWater)
  const deleteWater = useStore((s) => s.deleteWater)

  const today = todayISO()
  const todayEntries = useMemo(
    () => foodLog.filter((f) => f.date === today),
    [foodLog, today],
  )

  const totals = useMemo(
    () =>
      todayEntries.reduce(
        (acc, f) => ({
          kcal: acc.kcal + f.kcal,
          protein: acc.protein + f.protein,
          fat: acc.fat + f.fat,
          carbs: acc.carbs + f.carbs,
        }),
        { kcal: 0, protein: 0, fat: 0, carbs: 0 },
      ),
    [todayEntries],
  )

  const targetKcal = profile ? computeHealth(profile).targetKcal : null
  const waterGoal = profile ? computeHealth(profile).waterMl : null

  // ---- вода ----
  const todayWaterEntries = useMemo(
    () => waterLog.filter((w) => w.date === today),
    [waterLog, today],
  )
  const waterToday = useMemo(
    () => todayWaterEntries.reduce((s, w) => s + w.ml, 0),
    [todayWaterEntries],
  )
  // последняя добавленная запись за сегодня (waterLog хранится новыми вперёд)
  const lastWaterId = todayWaterEntries[0]?.id ?? null
  const waterPct =
    waterGoal && waterGoal > 0 ? Math.min(100, (waterToday / waterGoal) * 100) : 0

  // ---- калории за последние 7 дней ----
  const trend = useMemo(() => {
    const days: { iso: string; label: string; kcal: number }[] = []
    const base = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base)
      d.setDate(base.getDate() - i)
      const iso = toISODate(d)
      days.push({ iso, label: `${d.getDate()}.${d.getMonth() + 1}`, kcal: 0 })
    }
    const byDate = new Map(days.map((d) => [d.iso, d]))
    for (const f of foodLog) {
      const day = byDate.get(f.date)
      if (day) day.kcal += f.kcal
    }
    return days
  }, [foodLog])

  const trendMax = useMemo(() => {
    const maxKcal = trend.reduce((m, d) => Math.max(m, d.kcal), 0)
    return Math.max(maxKcal, targetKcal ?? 0, 1)
  }, [trend, targetKcal])

  const hasTrendData = trend.some((d) => d.kcal > 0)

  // ---- modal state ----
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('base')
  const [search, setSearch] = useState('')
  const [foodId, setFoodId] = useState('')
  const [grams, setGrams] = useState('100')
  // custom fields (на 100 г)
  const [name, setName] = useState('')
  const [kcal100, setKcal100] = useState('')
  const [protein100, setProtein100] = useState('')
  const [fat100, setFat100] = useState('')
  const [carbs100, setCarbs100] = useState('')

  const filteredFoods = useMemo<Food[]>(() => {
    const q = search.trim().toLowerCase()
    if (!q) return FOODS
    return FOODS.filter((f) => f[lang].toLowerCase().includes(q))
  }, [search, lang])

  const gramsNum = Number(grams)
  const gramsValid = Number.isFinite(gramsNum) && gramsNum > 0

  const selectedFood = foodId ? findFood(foodId) : undefined

  const kcal100Num = Number(kcal100)
  const customNameValid = name.trim() !== ''
  const customKcalValid = Number.isFinite(kcal100Num) && kcal100Num >= 0

  // предпросмотр порции в модалке
  const preview = useMemo<Portion | null>(() => {
    if (!gramsValid) return null
    if (mode === 'base') {
      if (!selectedFood) return null
      return portionOf(selectedFood, gramsNum)
    }
    if (!customKcalValid) return null
    return portionOf(
      {
        kcal: kcal100Num,
        protein: Number(protein100) || 0,
        fat: Number(fat100) || 0,
        carbs: Number(carbs100) || 0,
      },
      gramsNum,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedFood, gramsNum, gramsValid, kcal100Num, customKcalValid, protein100, fat100, carbs100])

  const canSave =
    gramsValid &&
    (mode === 'base' ? !!selectedFood : customNameValid && customKcalValid)

  function openModal() {
    setMode('base')
    setSearch('')
    setFoodId('')
    setGrams('100')
    setName('')
    setKcal100('')
    setProtein100('')
    setFat100('')
    setCarbs100('')
    setOpen(true)
  }

  function submit() {
    if (!preview) return
    const entryName =
      mode === 'base' ? (selectedFood ? selectedFood[lang] : '') : name.trim()
    if (!entryName) return
    addFood({
      date: today,
      name: entryName,
      grams: gramsNum,
      kcal: preview.kcal,
      protein: preview.protein,
      fat: preview.fat,
      carbs: preview.carbs,
    })
    setOpen(false)
  }

  const overTarget = targetKcal != null && totals.kcal > targetKcal
  const remaining = targetKcal != null ? targetKcal - totals.kcal : 0
  const pct =
    targetKcal && targetKcal > 0 ? Math.min(100, (totals.kcal / targetKcal) * 100) : 0
  const barColor = overTarget ? 'var(--danger)' : 'var(--accent)'

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={openModal}>
          <Plus size={16} /> {t('health.diaryAdd')}
        </Button>
      </div>

      {/* Итоги за день */}
      <Card className="mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--text-2)]">{t('health.diaryTotal')}</span>
          <span className="text-xl font-semibold">
            {totals.kcal}{' '}
            <span className="text-sm font-normal text-[var(--text-3)]">
              {t('health.diaryKcalUnit')}
            </span>
          </span>
        </div>

        {targetKcal != null ? (
          <>
            <div className="mt-4 flex justify-center">
              <Donut
                segments={[
                  {
                    label: t('health.diaryEatenToday'),
                    value: Math.min(totals.kcal, targetKcal),
                    color: overTarget ? 'var(--danger)' : 'var(--accent)',
                  },
                ]}
                centerTop={String(Math.round(totals.kcal))}
                centerBottom={`/ ${targetKcal}`}
                showLegend={false}
              />
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: barColor }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-[var(--text-3)]">
                {t('health.diaryNorm')}: {targetKcal} {t('health.diaryKcalUnit')}
              </span>
              <span style={{ color: overTarget ? 'var(--danger)' : 'var(--success)' }}>
                {overTarget ? t('health.diaryOver') : t('health.diaryRemaining')}:{' '}
                {Math.abs(remaining)} {t('health.diaryKcalUnit')}
              </span>
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs" style={{ color: 'var(--warning)' }}>
            {t('health.diaryNoProfile')}
          </p>
        )}

        {/* Макросы */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Macro label={t('health.diaryProtein')} value={totals.protein} unit={t('health.diaryGramsUnit')} />
          <Macro label={t('health.diaryFat')} value={totals.fat} unit={t('health.diaryGramsUnit')} />
          <Macro label={t('health.diaryCarbs')} value={totals.carbs} unit={t('health.diaryGramsUnit')} />
        </div>
      </Card>

      {/* Трекер воды */}
      <Card className="mb-4">
        <div className="mb-3 flex items-center gap-2">
          <Droplet size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-sm font-semibold text-[var(--text-2)]">{t('health.waterTitle')}</h2>
        </div>

        {waterGoal != null ? (
          <>
            <div className="flex justify-center">
              <Donut
                segments={[
                  {
                    label: t('health.waterToday'),
                    value: Math.min(waterToday, waterGoal),
                    color: 'var(--accent)',
                  },
                ]}
                centerTop={`${waterToday}`}
                centerBottom={`/ ${waterGoal} ${t('health.waterMlUnit')}`}
                showLegend={false}
              />
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-3)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${waterPct}%`, background: 'var(--accent)' }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-[var(--text-3)]">
                {t('health.waterToday')}: {waterToday} {t('health.waterMlUnit')}
              </span>
              <span className="text-[var(--text-3)]">
                {t('health.waterGoal')}: {waterGoal} {t('health.waterMlUnit')}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-baseline justify-between">
            <p className="text-xs" style={{ color: 'var(--warning)' }}>
              {t('health.waterNoGoal')}
            </p>
            <span className="text-xl font-semibold">
              {waterToday}{' '}
              <span className="text-sm font-normal text-[var(--text-3)]">
                {t('health.waterMlUnit')}
              </span>
            </span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Button variant="subtle" className="flex-1" onClick={() => addWater(250)}>
            <Plus size={16} /> {t('health.waterAdd250')}
          </Button>
          <Button variant="subtle" className="flex-1" onClick={() => addWater(500)}>
            <Plus size={16} /> {t('health.waterAdd500')}
          </Button>
          <IconButton
            onClick={() => lastWaterId && deleteWater(lastWaterId)}
            disabled={!lastWaterId}
            aria-label={t('health.waterUndo')}
          >
            <Undo2 size={16} />
          </IconButton>
        </div>

        <p className="mt-2 text-xs text-[var(--text-3)]">
          {t('health.waterCount')}: {todayWaterEntries.length}
        </p>
      </Card>

      {/* Сводка калорий за 7 дней */}
      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">{t('health.trendTitle')}</h2>
        {!hasTrendData ? (
          <Empty icon={<UtensilsCrossed size={28} />} text={t('health.trendEmpty')} />
        ) : (
          <>
            <div className="relative flex h-40 items-end gap-1.5">
              {targetKcal != null && (
                <div
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed"
                  style={{
                    bottom: `${(targetKcal / trendMax) * 100}%`,
                    borderColor: 'var(--success)',
                  }}
                  aria-hidden
                />
              )}
              {trend.map((d) => {
                const over = targetKcal != null && d.kcal > targetKcal
                const h = trendMax > 0 ? (d.kcal / trendMax) * 100 : 0
                return (
                  <div key={d.iso} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-full w-full items-end justify-center">
                      <div
                        className="w-full rounded-t transition-all"
                        style={{
                          maxWidth: 28,
                          height: `${h}%`,
                          background: over ? 'var(--danger)' : 'var(--accent)',
                        }}
                        title={`${d.kcal} ${t('health.diaryKcalUnit')}`}
                      />
                    </div>
                    <span className="text-[10px] text-[var(--text-3)]">{d.label}</span>
                  </div>
                )
              })}
            </div>
            {targetKcal != null && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="h-0 w-4 border-t border-dashed" style={{ borderColor: 'var(--success)' }} />
                <span className="text-[var(--text-3)]">
                  {t('health.trendTarget')}: {targetKcal} {t('health.diaryKcalUnit')}
                </span>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Список съеденного */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">
          {t('health.diaryEatenToday')}
        </h2>
        {todayEntries.length === 0 ? (
          <Empty icon={<UtensilsCrossed size={28} />} text={t('health.diaryEmpty')} />
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {todayEntries.map((f) => (
              <div key={f.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{f.name}</div>
                  <div className="truncate text-xs text-[var(--text-3)]">
                    {f.grams} {t('health.diaryGramsUnit')}
                  </div>
                </div>
                <div className="shrink-0 text-right text-sm font-medium">
                  {f.kcal}{' '}
                  <span className="text-xs font-normal text-[var(--text-3)]">
                    {t('health.diaryKcalUnit')}
                  </span>
                </div>
                <IconButton onClick={() => deleteFood(f.id)} aria-label={t('health.diaryDelete')}>
                  <Trash2 size={16} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Модалка добавления */}
      <Modal open={open} onClose={() => setOpen(false)} title={t('health.diaryModalTitle')}>
        {/* Переключатель режима */}
        <div className="mb-4 flex gap-2">
          <Button
            variant={mode === 'base' ? 'primary' : 'subtle'}
            className="flex-1"
            onClick={() => setMode('base')}
          >
            {t('health.diaryModeFromBase')}
          </Button>
          <Button
            variant={mode === 'custom' ? 'primary' : 'subtle'}
            className="flex-1"
            onClick={() => setMode('custom')}
          >
            {t('health.diaryModeCustom')}
          </Button>
        </div>

        {mode === 'base' ? (
          <>
            <Field label={t('health.diarySearch')}>
              <input
                value={search}
                placeholder={t('health.diarySearch')}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={t('health.diaryFood')}>
              <select value={foodId} onChange={(e) => setFoodId(e.target.value)}>
                <option value="">{t('health.diaryPickFood')}</option>
                {filteredFoods.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f[lang]}
                  </option>
                ))}
              </select>
            </Field>
            {filteredFoods.length === 0 && (
              <p className="mb-3 text-xs text-[var(--text-3)]">{t('health.diaryNoMatches')}</p>
            )}
          </>
        ) : (
          <>
            <Field label={t('health.diaryCustomName')}>
              <input
                value={name}
                placeholder={t('health.diaryCustomNamePlaceholder')}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('health.diaryKcalPer100')}>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="1"
                  value={kcal100}
                  onChange={(e) => setKcal100(e.target.value)}
                />
              </Field>
              <Field label={t('health.diaryProteinPer100')}>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={protein100}
                  onChange={(e) => setProtein100(e.target.value)}
                />
              </Field>
              <Field label={t('health.diaryFatPer100')}>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={fat100}
                  onChange={(e) => setFat100(e.target.value)}
                />
              </Field>
              <Field label={t('health.diaryCarbsPer100')}>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={carbs100}
                  onChange={(e) => setCarbs100(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}

        <Field label={t('health.diaryGrams')}>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
          />
        </Field>

        {preview && (
          <div
            className="mb-3 rounded-lg p-3 text-xs"
            style={{ background: 'var(--bg-3)', color: 'var(--text-2)' }}
          >
            <span className="font-medium text-[var(--text)]">{t('health.diaryPortionPreview')}:</span>{' '}
            {preview.kcal} {t('health.diaryKcalUnit')} · {t('health.diaryProtein')} {preview.protein} {t('health.diaryGramsUnit')} ·{' '}
            {t('health.diaryFat')} {preview.fat} {t('health.diaryGramsUnit')} · {t('health.diaryCarbs')} {preview.carbs} {t('health.diaryGramsUnit')}
          </div>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('health.diaryCancel')}
          </Button>
          <Button onClick={submit} disabled={!canSave}>
            {t('health.diarySave')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function Macro({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg p-2" style={{ background: 'var(--bg-3)' }}>
      <div className="text-sm font-semibold">
        {Math.round(value * 10) / 10}
        <span className="ml-0.5 text-xs font-normal text-[var(--text-3)]">{unit}</span>
      </div>
      <div className="text-xs text-[var(--text-3)]">{label}</div>
    </div>
  )
}
