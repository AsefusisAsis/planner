import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Eye, EyeOff } from 'lucide-react'
import { Card, Button } from '../../components/ui'
import { useStore } from '../../store'
import { BUILTIN_SYMPTOMS, builtinSymptomKey, customSymptomId } from '../../lib/cycleSymptoms'
import { useSymptomCatalog } from './symptoms'

/**
 * Настройка списка симптомов: скрыть лишние встроенные, добавить свои.
 *
 * Встроенные именно СКРЫВАЮТСЯ, а не удаляются, — иначе уже сделанные записи
 * дневника потеряли бы подпись. Свои удаляются из списка, но их подпись
 * лежит в самом id записи, так что история тоже остаётся читаемой.
 */
export function SymptomCatalog() {
  const { t } = useTranslation()
  const { hidden, custom } = useSymptomCatalog()
  const addCycleSymptom = useStore((s) => s.addCycleSymptom)
  const deleteCycleSymptom = useStore((s) => s.deleteCycleSymptom)
  const toggleCycleSymptomHidden = useStore((s) => s.toggleCycleSymptomHidden)

  const [draft, setDraft] = useState('')
  const [err, setErr] = useState(false)

  function add() {
    const clean = draft.trim()
    if (!clean) return
    // столкновение с подписью встроенного проверяем здесь: переводы есть
    // только в UI, а два одинаковых чипа в списке различить невозможно
    const clashesBuiltin = BUILTIN_SYMPTOMS.some(
      (b) => t(builtinSymptomKey(b)).toLowerCase() === clean.toLowerCase(),
    )
    const clashesCustom = custom.some((c) => c.id === customSymptomId(clean))
    if (clashesBuiltin || clashesCustom || !addCycleSymptom(clean)) {
      setErr(true)
      return
    }
    setDraft('')
    setErr(false)
  }

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold">{t('health.cycCatalogTitle')}</h3>
      <p className="mb-3 text-[11px] text-[var(--text-3)]">{t('health.cycCatalogHint')}</p>

      <div className="mb-1.5 text-xs text-[var(--text-3)]">{t('health.cycCatalogBuiltin')}</div>
      <div className="flex flex-wrap gap-1.5">
        {BUILTIN_SYMPTOMS.map((s) => {
          const off = hidden.includes(s)
          return (
            <button
              key={s}
              onClick={() => toggleCycleSymptomHidden(s)}
              aria-pressed={!off}
              aria-label={`${t(builtinSymptomKey(s))} — ${off ? t('health.cycCatalogShow') : t('health.cycCatalogHide')}`}
              className="chip flex items-center gap-1"
              style={off ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}
            >
              {off ? <EyeOff size={12} /> : <Eye size={12} />}
              {t(builtinSymptomKey(s))}
            </button>
          )
        })}
      </div>

      {custom.length > 0 && (
        <>
          <div className="mb-1.5 mt-3 text-xs text-[var(--text-3)]">
            {t('health.cycCatalogCustom')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {custom.map((c) => (
              <span
                key={c.id}
                className="chip flex items-center gap-1"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                {c.label}
                <button
                  onClick={() => deleteCycleSymptom(c.id)}
                  aria-label={`${t('health.cycCatalogDelete')}: ${c.label}`}
                  className="flex items-center"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setErr(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={t('health.cycCatalogAdd')}
            aria-label={t('health.cycCatalogAdd')}
            className="input w-full"
            maxLength={32}
          />
          {err && (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--danger-text)' }}>
              {t('health.cycCatalogDup')}
            </p>
          )}
        </div>
        <Button variant="subtle" onClick={add} disabled={!draft.trim()}>
          <Plus size={15} />
          {t('health.cycCatalogAddBtn')}
        </Button>
      </div>
    </Card>
  )
}
