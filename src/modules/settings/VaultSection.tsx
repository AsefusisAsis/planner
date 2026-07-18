import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ShieldAlert, Lock, LockOpen, Copy, Check } from 'lucide-react'
import { useStore } from '../../store'
import { Button, Card, Modal } from '../../components/ui'
import { QrCode } from '../../components/QrCode'
import { otpauthUri } from '../../lib/vault'

/**
 * «Защита данных» — единый TOTP-ключ (цикл + карты). Настройка = генерация
 * секрета + QR для аутентификатора; разблокировка = код из аутентификатора
 * или (новое устройство) ввод секрета. Биометрия — отдельным шагом (натив).
 */
export function VaultSection() {
  const { t } = useTranslation()
  const vault = useStore((s) => s.data.vault)
  const unlocked = useStore((s) => s.vaultUnlocked)
  const setupVault = useStore((s) => s.setupVault)
  const unlockWithCode = useStore((s) => s.unlockVaultWithCode)
  const unlockWithSecret = useStore((s) => s.unlockVaultWithSecret)
  const lockVault = useStore((s) => s.lockVault)
  const disableVault = useStore((s) => s.disableVault)
  const getVaultSecret = useStore((s) => s.getVaultSecret)
  const vaultHasDeviceSecret = useStore((s) => s.vaultHasDeviceSecret)
  const cardSecurity = useStore((s) => s.data.cardSecurity)

  // диалог показа секрета (после setup или «показать снова»)
  const [reveal, setReveal] = useState<{ secret: string; uri: string } | null>(null)
  const [copied, setCopied] = useState(false)
  // диалог разблокировки
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [code, setCode] = useState('')
  const [secretInput, setSecretInput] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  // на этом устройстве секрет уже есть? (влияет на способ разблокировки:
  // код из аутентификатора vs ввод секрета на новом устройстве)
  const hasLocalSecret = vaultHasDeviceSecret()

  async function handleSetup() {
    setBusy(true)
    try {
      const res = await setupVault()
      setReveal(res)
    } finally {
      setBusy(false)
    }
  }

  function showQrAgain() {
    const secret = getVaultSecret()
    if (secret) setReveal({ secret, uri: otpauthUri(secret) })
  }

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* буфер недоступен — секрет и так виден на экране */
    }
  }

  async function handleUnlock() {
    setErr(null)
    setBusy(true)
    try {
      // если секрет на устройстве есть — проверяем кодом; иначе вводим секрет
      const ok = hasLocalSecret ? await unlockWithCode(code) : await unlockWithSecret(secretInput)
      if (ok) {
        setUnlockOpen(false)
        setCode('')
        setSecretInput('')
      } else {
        setErr(t('settings.vaultWrong'))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        {vault ? (
          unlocked ? (
            <ShieldCheck size={18} className="text-[var(--accent)]" />
          ) : (
            <Lock size={18} className="text-[var(--text-3)]" />
          )
        ) : (
          <ShieldAlert size={18} className="text-[var(--text-3)]" />
        )}
        <h2 className="text-base font-semibold">{t('settings.vaultTitle')}</h2>
      </div>
      <p className="mb-3 text-sm text-[var(--text-2)]">{t('settings.vaultIntro')}</p>

      {!vault && (
        <>
          <Button onClick={handleSetup} disabled={busy}>
            <ShieldCheck size={16} /> {t('settings.vaultEnable')}
          </Button>
          {cardSecurity && (
            <p className="mt-2 text-xs text-[var(--text-3)]">{t('settings.vaultCardsLegacyNote')}</p>
          )}
        </>
      )}

      {vault && !unlocked && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-[var(--text-2)]">{t('settings.vaultLocked')}</p>
          <div>
            <Button onClick={() => setUnlockOpen(true)}>
              <LockOpen size={16} /> {t('settings.vaultUnlock')}
            </Button>
          </div>
        </div>
      )}

      {vault && unlocked && (
        <div className="flex flex-wrap gap-2">
          <span className="mb-1 w-full text-sm text-[var(--accent)]">{t('settings.vaultOn')}</span>
          <Button variant="subtle" onClick={showQrAgain}>
            {t('settings.vaultShowQr')}
          </Button>
          <Button variant="subtle" onClick={lockVault}>
            <Lock size={16} /> {t('settings.vaultLock')}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDisable(true)}>
            {t('settings.vaultDisable')}
          </Button>
        </div>
      )}

      {/* ── диалог: показать секрет/QR (один раз при настройке или по кнопке) ── */}
      <Modal open={!!reveal} onClose={() => setReveal(null)} title={t('settings.vaultQrTitle')}>
        {reveal && (
          <div className="flex flex-col items-center gap-3 pb-2">
            <p className="text-center text-sm text-[var(--text-2)]">{t('settings.vaultQrHint')}</p>
            <QrCode value={reveal.uri} size={208} />
            <div className="w-full">
              <p className="mb-1 text-xs text-[var(--text-3)]">{t('settings.vaultSecretLabel')}</p>
              <button
                type="button"
                onClick={() => copySecret(reveal.secret)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left"
                style={{ borderColor: 'var(--border)' }}
              >
                <code className="break-all text-sm">{reveal.secret}</code>
                {copied ? <Check size={16} className="text-[var(--accent)]" /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-center text-xs text-[var(--text-3)]">{t('settings.vaultSecretWarn')}</p>
            <Button fullWidth onClick={() => setReveal(null)}>
              {t('settings.vaultSecretDone')}
            </Button>
          </div>
        )}
      </Modal>

      {/* ── диалог разблокировки: код из аутентификатора ИЛИ ввод секрета ── */}
      <Modal open={unlockOpen} onClose={() => setUnlockOpen(false)} title={t('settings.vaultUnlock')}>
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

      {/* ── подтверждение отключения защиты ── */}
      <Modal
        open={confirmDisable}
        onClose={() => setConfirmDisable(false)}
        title={t('settings.vaultDisable')}
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-[var(--text-2)]">{t('settings.vaultDisableWarn')}</p>
          <Button
            fullWidth
            variant="danger"
            onClick={() => {
              disableVault()
              setConfirmDisable(false)
            }}
          >
            {t('settings.vaultDisable')}
          </Button>
        </div>
      </Modal>
    </Card>
  )
}
