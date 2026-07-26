import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Check } from 'lucide-react'
import { Button } from './ui'
import { useInstallState, promptInstall } from '../lib/pwaInstall'

/**
 * Предложение установить веб-версию как приложение.
 *
 * Если браузер дал системный диалог (Chrome/Edge) — показываем кнопку и
 * вызываем его сами; иначе — короткую инструкцию под платформу. В нативной
 * сборке и в уже установленном приложении не показывается вовсе.
 */
export function InstallAppCard({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { show, canPrompt, hint } = useInstallState()
  const [done, setDone] = useState(false)

  if (!show) return null

  return (
    <div
      className="rounded-xl border p-3"
      style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }}>
          <Download size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t('install.title')}</p>
          {!compact && <p className="mt-0.5 text-xs text-[var(--text-2)]">{t('install.why')}</p>}

          {/* done проверяем ПЕРВЫМ: promptInstall гасит canPrompt сразу
              (событие одноразовое), и при обратном порядке после успешной
              установки показалась бы инструкция вместо «Установлено» */}
          {done ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs" style={{ color: 'var(--success)' }}>
              <Check size={14} /> {t('install.done')}
            </p>
          ) : canPrompt ? (
            <Button
              className="mt-2"
              onClick={async () => {
                if (await promptInstall()) setDone(true)
              }}
            >
              <Download size={16} /> {t('install.action')}
            </Button>
          ) : (
            // системного диалога нет (Safari, Firefox, уже отклонили) —
            // объясняем словами, где искать пункт установки
            <p className="mt-1.5 text-xs text-[var(--text-2)]">{t('install.hint_' + hint)}</p>
          )}
        </div>
      </div>
    </div>
  )
}
