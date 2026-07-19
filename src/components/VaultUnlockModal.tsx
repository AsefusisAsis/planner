import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LockOpen, Fingerprint } from 'lucide-react'
import { useStore } from '../store'
import { Button, Modal } from './ui'
import { isBiometryAvailable } from '../lib/biometric'

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
  const unlockBiometric = useStore((s) => s.unlockVaultBiometric)

  const [code, setCode] = useState('')
  const [secretInput, setSecretInput] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [bioOk, setBioOk] = useState(false)
  // способ ввода: код из аутентификатора или сам секретный ключ. По умолчанию
  // код, если секрет на устройстве; иначе (другое устройство) — только ключ.
  // Пользователь может переключиться на ключ, если нет доступа к коду.
  const [mode, setMode] = useState<'code' | 'secret'>('code')
  useEffect(() => {
    if (open) setMode(hasLocalSecret ? 'code' : 'secret')
  }, [open, hasLocalSecret])

  // биометрия доступна только в нативной сборке при наличии секрета на устройстве
  useEffect(() => {
    if (!open || !hasLocalSecret) return
    let alive = true
    void isBiometryAvailable().then((v) => alive && setBioOk(v))
    return () => {
      alive = false
    }
  }, [open, hasLocalSecret])

  // авто-промпт биометрии при открытии окна (если доступна) — как «окошко разблокировки»
  useEffect(() => {
    if (!open || !bioOk) return
    void handleBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bioOk])

  async function handleBiometric() {
    setErr(null)
    setBusy(true)
    try {
      const ok = await unlockBiometric()
      if (ok) {
        onClose()
        onUnlocked?.()
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock() {
    setErr(null)
    setBusy(true)
    try {
      const ok = mode === 'code' ? await unlockWithCode(code) : await unlockWithSecret(secretInput)
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
        {mode === 'code' ? (
          <>
            {bioOk && (
              <Button variant="subtle" fullWidth disabled={busy} onClick={handleBiometric}>
                <Fingerprint size={16} /> {t('settings.vaultUnlockBiometric')}
              </Button>
            )}
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
            {/* запасной путь: нет доступа к аутентификатору — ввести секрет */}
            <button
              type="button"
              className="self-start text-xs text-[var(--accent)] underline"
              onClick={() => {
                setErr(null)
                setMode('secret')
              }}
            >
              {t('settings.vaultNoCode')}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--text-2)]">{t('settings.vaultUnlockSecretHint')}</p>
            <input
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && secretInput.trim().length >= 16 && handleUnlock()}
              placeholder={t('settings.vaultSecretLabel')}
              autoCapitalize="characters"
            />
            {hasLocalSecret && (
              <button
                type="button"
                className="self-start text-xs text-[var(--accent)] underline"
                onClick={() => {
                  setErr(null)
                  setMode('code')
                }}
              >
                {t('settings.vaultUseCode')}
              </button>
            )}
          </>
        )}
        {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
        <Button
          fullWidth
          disabled={busy || (mode === 'code' ? code.length !== 6 : secretInput.trim().length < 16)}
          onClick={handleUnlock}
        >
          <LockOpen size={16} /> {t('settings.vaultUnlock')}
        </Button>
      </div>
    </Modal>
  )
}
