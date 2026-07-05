// ============================================================
// Голос темы: тон текста меняется вместе с темой.
// vt('key') берёт вариант 'key_<palette>' если он есть, иначе базовый 'key'.
// Так «Тёплая» звучит бережно (для тревожных), «Спокойная» — сдержанно,
// «Деловая» — нейтрально (базовый текст). Обе локали работают как обычно.
// ============================================================
import { useTranslation } from 'react-i18next'
import { useStore } from '../store'

export function useVoice() {
  const { t } = useTranslation()
  const palette = useStore((s) => s.data.settings.palette ?? 'classic')
  return (key: string, opts?: Record<string, unknown>) => {
    if (palette !== 'classic') {
      const themed = t(`${key}_${palette}`, { defaultValue: '', ...opts })
      if (themed) return themed
    }
    return t(key, opts)
  }
}
