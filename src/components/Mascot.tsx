// ============================================================
// Маскоты тем (по прототипу редизайна): часть характера темы.
// «Тёплая» — медвежонок Уют (заботливый), «Спокойная» — капибара
// Дзен (невозмутимая). Карточка на дашборде: маскот + реплика в
// пузыре; тап меняет реплику. Реплики контекстные (просрочка,
// вода, всё сделано) + базовые, тон — в голосе темы. В «Деловой»
// маскота нет — компонент ничего не рендерит.
// Иллюстрации-маскоты (webp с прозрачностью, ~5КБ, оптимизированы под APK).
// Контейнер держит анимацию движения (bob/drift) из index.css.
// ============================================================
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store'
import { tap } from '../lib/haptics'
import mascotWarm from '../assets/mascot-warm.webp'
import mascotCalm from '../assets/mascot-calm.webp'

function Bear() {
  return (
    <div className="mascot-warm shrink-0" aria-hidden="true">
      <img src={mascotWarm} alt="" draggable={false} className="h-[76px] w-[76px] object-contain" />
    </div>
  )
}

function Capybara() {
  return (
    <div className="mascot-calm shrink-0" aria-hidden="true">
      <img src={mascotCalm} alt="" draggable={false} className="h-[76px] w-[76px] object-contain" />
    </div>
  )
}

export function MascotCard({
  overdue,
  waterLow,
  allDone,
}: {
  overdue: number
  waterLow: boolean
  allDone: boolean
}) {
  const { t } = useTranslation()
  const palette = useStore((s) => s.data.settings.palette ?? 'classic')
  const kind = palette === 'warm' ? 'warm' : 'calm'

  // пул реплик: контекстные первыми (что важно сейчас), затем базовые по кругу
  const pool = useMemo(() => {
    const p: string[] = []
    if (overdue > 0) p.push(t(`mascot.${kind}.overdue`, { count: overdue }))
    if (waterLow) p.push(t(`mascot.${kind}.water`))
    if (allDone) p.push(t(`mascot.${kind}.done`))
    p.push(t(`mascot.${kind}.p1`), t(`mascot.${kind}.p2`), t(`mascot.${kind}.p3`), t(`mascot.${kind}.p4`))
    return p
  }, [t, kind, overdue, waterLow, allDone])
  const [idx, setIdx] = useState(0)
  const phrase = pool[idx % pool.length]

  if (palette === 'classic') return null

  return (
    <button
      type="button"
      onClick={() => {
        tap()
        setIdx((i) => i + 1)
      }}
      // реплика меняется по тапу — вся карточка и есть кнопка
      aria-label={`${t(`mascot.${kind}.name`)}: ${phrase}. ${t('mascot.hint')}`}
      className="press mb-4 flex w-full items-start gap-3.5 border p-4 text-left"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {kind === 'warm' ? <Bear /> : <Capybara />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[13.5px] font-extrabold">
          {t(`mascot.${kind}.name`)}
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{
              color: 'var(--accent)',
              // сила тинта — токен темы: в тёмном режиме «подушки» плотнее
              background: 'color-mix(in srgb, var(--accent) var(--tint-soft), transparent)',
            }}
          >
            {t(`mascot.${kind}.trait`)}
          </span>
        </span>
        {/* key=idx перезапускает анимацию пузыря на каждую реплику */}
        <span
          key={idx}
          className="mascot-bubble mt-2 block px-3 py-2.5 text-[12.5px] font-semibold leading-snug"
          style={{
            color: 'var(--text-2)',
            background: 'color-mix(in srgb, var(--accent) var(--tint-soft), transparent)',
            borderRadius: '14px 14px 14px 4px',
          }}
        >
          {phrase}
        </span>
        <span className="mt-1.5 block text-[10.5px] font-semibold text-[var(--text-3)]">
          {t('mascot.hint')}
        </span>
      </span>
    </button>
  )
}
