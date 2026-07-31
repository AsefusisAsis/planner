import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check } from 'lucide-react'
import { Button, Modal } from './ui'
import { QrCode } from './QrCode'

/**
 * Показ секрета «Защиты данных»: QR для аутентификатора + сам секрет.
 *
 * Вынесено из VaultSection, потому что то же окно нужно при переводе карт со
 * старого мастер-пароля на единый ключ — а миграция теперь делается прямо в
 * «Кошельке», без похода в Настройки. Дублировать экран, на котором
 * показывают невосстановимый секрет, нельзя: разойдись две копии текстом или
 * поведением — и часть пользователей потеряет доступ к своим картам.
 */
export function VaultSecretModal({
  value,
  onClose,
}: {
  value: { secret: string; uri: string } | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* буфер недоступен — секрет и так виден на экране */
    }
  }

  return (
    <Modal open={!!value} onClose={onClose} title={t('settings.vaultQrTitle')}>
      {value && (
        <div className="flex flex-col items-center gap-3 pb-2">
          <p className="text-center text-sm text-[var(--text-2)]">{t('settings.vaultQrHint')}</p>
          <QrCode value={value.uri} size={208} />
          <div className="w-full">
            <p className="mb-1 text-xs text-[var(--text-3)]">{t('settings.vaultSecretLabel')}</p>
            <button
              type="button"
              onClick={() => copySecret(value.secret)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left"
              style={{ borderColor: 'var(--border)' }}
            >
              <code className="break-all text-sm">{value.secret}</code>
              {copied ? <Check size={16} className="text-[var(--accent)]" /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-center text-xs text-[var(--text-3)]">{t('settings.vaultSecretWarn')}</p>
          <Button fullWidth onClick={onClose}>
            {t('settings.vaultSecretDone')}
          </Button>
        </div>
      )}
    </Modal>
  )
}
