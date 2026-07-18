import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LockOpen } from 'lucide-react'
import { useStore } from '../store'
import { Button, Modal } from './ui'

/**
 * Общее окно разблокировки «Защиты данных» — используется и в Настройках,
 * и на экране Карт. Секрет на этом устройстве есть → просим 6-значный код
 * из аутентификатора; нет (новое устройство) → просим ввести секрет.
 * Биометрия подключится сюда отдельным шагом (натив).
 */
export function VaultUnlockModal({
  open,
  onClose,
  onUnlocked,
}: {
  open: boolean
  onClose: () => void
  onUnlocked?: () => void
}) {
  const { t } = useTranslation()
  const hasLocalSecret = useStore((s) => s.vaultHasDeviceSecret)()
  const unlockWithCode = useStore((s) => s.unlockVaultWithCode)
  const unlockWithSecret = useStore((s) => s.unlockVaultWithSecret)

  const [code, setCode] = useState('')
  const [secretInput, setSecretInput] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleUnlock() {
    setErr(null)
    setBusy(true)
    try {
      const ok = hasLocalSecret ? await unlockWithCode(code) : await unlockWithSecret(secretInput)
      if (ok) {
        setCode('')
        setSecretInput('')
        onClose()
        onUnlocked?.()
      } else {
        setErr(t('settings.vaultWrong'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('settings.vaultUnlock')}>
      <div className="flex flex-col gap-3 pb-2">
        {hasLocalSecret ? (
          <>
            <p className="text-sm text-[var(--text-2)]">{t('settings.vaultUnlockCodeHint')}</p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && handleUnlock()}
              placeholder="000000"
              className="text-center text-2xl tracking-[0.4em]"
            />
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--text-2)]">{t('settings.vaultUnlockSecretHint')}</p>
            <input
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder={t('settings.vaultSecretLabel')}
              autoCapitalize="characters"
            />
          </>
        )}
        {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
        <Button
          fullWidth
          disabled={busy || (hasLocalSecret ? code.length !== 6 : secretInput.trim().length < 16)}
          onClick={handleUnlock}
        >
          <LockOpen size={16} /> {t('settings.vaultUnlock')}
        </Button>
      </div>
    </Modal>
  )
}
