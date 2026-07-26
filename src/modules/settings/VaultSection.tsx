import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, ShieldAlert, Lock, LockOpen, Copy, Check, Fingerprint } from 'lucide-react'
import { useStore } from '../../store'
import { Button, Card, Checkbox, Modal } from '../../components/ui'
import { QrCode } from '../../components/QrCode'
import { VaultUnlockModal } from '../../components/VaultUnlockModal'
import { otpauthUri } from '../../lib/vault'
import { getBiometryStatus, biometricAuthenticate, type BiometryStatus } from '../../lib/biometric'

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
  const lockVault = useStore((s) => s.lockVault)
  const disableVault = useStore((s) => s.disableVault)
  const getVaultSecret = useStore((s) => s.getVaultSecret)
  const cardSecurity = useStore((s) => s.data.cardSecurity)

  const biometricUnlock = useStore((s) => s.data.settings.biometricUnlock)
  const setBiometricUnlock = useStore((s) => s.setBiometricUnlock)

  // состояние биометрии на устройстве: раньше её недоступность была молчаливой
  // (кнопка просто не появлялась), теперь показываем статус и причину
  const [bio, setBio] = useState<BiometryStatus | null>(null)
  const [bioTest, setBioTest] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void getBiometryStatus().then((s) => alive && setBio(s))
    return () => {
      alive = false
    }
  }, [])

  async function testBiometry() {
    setBioTest(null)
    const res = await biometricAuthenticate(t('settings.bioTestReason'))
    setBioTest(res.ok ? 'ok' : res.code || 'unknown')
    // статус мог измениться (например, после блокировки за неудачные попытки)
    setBio(await getBiometryStatus())
  }

  // диалог показа секрета (после setup или «показать снова»)
  const [reveal, setReveal] = useState<{ secret: string; uri: string } | null>(null)
  const [copied, setCopied] = useState(false)
  // диалог разблокировки (общий компонент)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [setupErr, setSetupErr] = useState<string | null>(null)

  async function handleSetup() {
    setBusy(true)
    setSetupErr(null)
    try {
      const res = await setupVault()
      setReveal(res)
    } catch (e) {
      // карты заблокированы старым паролём — иначе включение осиротило бы их
      setSetupErr(
        e instanceof Error && e.message === 'cards-locked'
          ? t('settings.vaultCardsLocked')
          : t('settings.vaultWrong'),
      )
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
          {setupErr && <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>{setupErr}</p>}
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

      {/* ── Биометрия: статус + тумблер + проверка ──
          Показываем ВСЕГДА при включённой защите, даже когда биометрия
          недоступна: пользователь должен понимать почему, а не гадать. */}
      {vault && bio?.native && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <div className="mb-2 flex items-center gap-2">
            <Fingerprint size={16} style={{ color: bio.available ? 'var(--accent)' : 'var(--text-3)' }} />
            <span className="text-sm font-medium">{t('settings.bioTitle')}</span>
          </div>

          {bio.available ? (
            <>
              <label
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                style={{ borderColor: 'var(--border)' }}
              >
                <Checkbox
                  checked={biometricUnlock !== false}
                  onChange={setBiometricUnlock}
                  label={t('settings.bioEnable')}
                />
                <span className="flex-1 text-sm">{t('settings.bioEnable')}</span>
              </label>
              <p className="mt-2 text-xs text-[var(--text-3)]">
                {t('settings.bioKind_' + bio.kind)}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs" style={{ color: 'var(--warning-text)' }}>
                {/* конкретная причина, а не «недоступна» */}
                {t('settings.bioWhy_' + bio.code, {
                  defaultValue: t('settings.bioWhy_unknown'),
                })}
                {bio.reason ? ` (${bio.reason})` : ''}
              </p>
              {/* отпечатка нет, но экран блокировки есть — разблокировка всё
                  равно возможна по PIN/паттерну (allowDeviceCredential) */}
              {bio.deviceSecure && (
                <label
                  className="mt-2 flex items-center gap-3 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <Checkbox
                    checked={biometricUnlock !== false}
                    onChange={setBiometricUnlock}
                    label={t('settings.bioEnablePin')}
                  />
                  <span className="flex-1 text-sm">{t('settings.bioEnablePin')}</span>
                </label>
              )}
            </>
          )}

          <div className="mt-2 flex items-center gap-2">
            <Button variant="subtle" onClick={testBiometry}>
              {t('settings.bioTest')}
            </Button>
            {bioTest && (
              <span
                className="text-xs"
                style={{ color: bioTest === 'ok' ? 'var(--success)' : 'var(--text-3)' }}
              >
                {bioTest === 'ok'
                  ? t('settings.bioTestOk')
                  : t('settings.bioFail_' + bioTest, { defaultValue: t('settings.bioFail_unknown') })}
              </span>
            )}
          </div>
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

      {/* ── диалог разблокировки: общий компонент (код/секрет) ── */}
      <VaultUnlockModal open={unlockOpen} onClose={() => setUnlockOpen(false)} />

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
