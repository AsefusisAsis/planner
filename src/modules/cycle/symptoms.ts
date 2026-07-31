// React-обвязка каталога симптомов. Чистая часть (список, префикс, выбор)
// живёт в lib/cycleSymptoms — стору нужна именно она, а импортировать сюда
// он не может: получилось бы кольцо store → модуль → store.

import { useTranslation } from 'react-i18next'
import { useStore } from '../../store'
import {
  builtinSymptomKey,
  isCustomSymptom,
  symptomChoices,
  CUSTOM_PREFIX,
} from '../../lib/cycleSymptoms'

/**
 * Подпись симптома по id. Своя подпись берётся из самого id, а не из
 * каталога: симптом могли убрать из списка, но в дневнике он остался —
 * показать «(удалён)» вместо названия значило бы стереть уже записанное.
 */
export function useSymptomLabel(): (id: string) => string {
  const { t } = useTranslation()
  return (id: string) =>
    isCustomSymptom(id) ? id.slice(CUSTOM_PREFIX.length) : t(builtinSymptomKey(id))
}

/** Каталог симптомов из стора для UI-компонентов. */
export function useSymptomCatalog() {
  const hidden = useStore((s) => s.data.settings.cycleSymptomsHidden)
  const custom = useStore((s) => s.data.settings.cycleSymptomsCustom)
  return {
    choices: symptomChoices(hidden, custom),
    hidden: hidden ?? [],
    custom: custom ?? [],
  }
}
