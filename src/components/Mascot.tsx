// ============================================================
// Маскоты тем (по прототипу редизайна): часть характера темы.
// «Тёплая» — медвежонок Уют (заботливый), «Спокойная» — капибара
// Дзен (невозмутимая). Карточка на дашборде: маскот + реплика в
// пузыре; тап меняет реплику. Реплики контекстные (просрочка,
// вода, всё сделано) + базовые, тон — в голосе темы. В «Деловой»
// маскота нет — компонент ничего не рендерит.
// Рисованы CSS-дивами (без ассетов — ничего не грузим, важно для APK).
// ============================================================
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store'
import { tap } from '../lib/haptics'

// геометрия из прототипа (масштаб 1:1 с ПК-версией)
function Bear() {
  return (
    <div className="mascot-warm relative h-[72px] w-[78px] shrink-0" aria-hidden="true">
      <div className="absolute left-[6px] top-[2px] h-[18px] w-[18px] rounded-full" style={{ background: '#d98d55' }} />
      <div className="absolute right-[6px] top-[2px] h-[18px] w-[18px] rounded-full" style={{ background: '#d98d55' }} />
      <div className="absolute left-[5px] top-[10px] h-[60px] w-[68px] rounded-full" style={{ background: '#e8a668' }} />
      <div className="absolute left-[22px] top-[38px] h-[24px] w-[34px] rounded-full" style={{ background: '#f7ddb8' }} />
      <div className="mascot-eye absolute left-[22px] top-[32px] h-[7px] w-[7px] rounded-full" style={{ background: '#3a2b1c' }} />
      <div className="mascot-eye absolute right-[22px] top-[32px] h-[7px] w-[7px] rounded-full" style={{ background: '#3a2b1c' }} />
      <div className="absolute left-[34px] top-[42px] h-[8px] w-[10px]" style={{ background: '#7a5432', borderRadius: '40%' }} />
      <div
        className="absolute left-[31px] top-[50px] h-[6px] w-[16px]"
        style={{ borderBottom: '2px solid #7a5432', borderRadius: '0 0 50% 50%' }}
      />
    </div>
  )
}

function Capybara() {
  return (
    <div className="mascot-calm relative h-[66px] w-[82px] shrink-0" aria-hidden="true">
      <div className="absolute left-[14px] top-[2px] h-[13px] w-[13px] rounded-full" style={{ background: '#a5875f' }} />
      <div className="absolute right-[14px] top-[2px] h-[13px] w-[13px] rounded-full" style={{ background: '#a5875f' }} />
      <div className="absolute left-[4px] top-[8px] h-[56px] w-[74px]" style={{ background: '#b99b77', borderRadius: '46% 46% 48% 48%' }} />
      {/* глаза-чёрточки: прикрыты — дзен */}
      <div className="absolute left-[20px] top-[32px] h-[3px] w-[11px] rounded-[2px]" style={{ background: '#3a2f22' }} />
      <div className="absolute right-[20px] top-[32px] h-[3px] w-[11px] rounded-[2px]" style={{ background: '#3a2f22' }} />
      <div className="absolute left-[32px] top-[43px] h-[11px] w-[18px]" style={{ background: '#8f7350', borderRadius: '40%' }} />
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
              background: 'color-mix(in srgb, var(--accent) 11%, transparent)',
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
            background: 'color-mix(in srgb, var(--accent) 9%, transparent)',
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
