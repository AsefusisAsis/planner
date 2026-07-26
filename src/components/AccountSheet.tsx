import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut, UserRound, Camera, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { Button, Checkbox, Field, Modal } from './ui'
import { getLastCloudUser, localCounts } from '../services/cloudSync'
import { authErrorKey } from '../lib/authErrors'
import { exportDataToFile } from '../lib/backup'

/**
 * Лист аккаунта (облачная синхронизация). Открывается из иконки аккаунта в
 * шапке. Вход/регистрация email+пароль (переиспользует логику из Настроек)
 * или, если вошли — почта + выход. Аккаунт опционален: без него приложение
 * работает локально.
 */
export function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const account = useStore((s) => s.account)
  const signIn = useStore((s) => s.signIn)
  const signUp = useStore((s) => s.signUp)
  const signOut = useStore((s) => s.signOut)
  const deleteAccount = useStore((s) => s.deleteAccount)
  const avatarUrl = useStore((s) => s.avatarUrl)
  const uploadAvatar = useStore((s) => s.uploadAvatar)
  const removeAvatar = useStore((s) => s.removeAvatar)
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarErr, setAvatarErr] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  // удаление аккаунта (двухшаговое подтверждение)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [wipeLocal, setWipeLocal] = useState(false)
  const [delBusy, setDelBusy] = useState(false)
  const [delErr, setDelErr] = useState<string | null>(null)

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAvatarErr(null)
    setAvatarBusy(true)
    try {
      const err = await uploadAvatar(file)
      if (err) {
        const low = err.toLowerCase()
        setAvatarErr(
          low.includes('bucket') && low.includes('not found')
            ? t('account.avatarNoBucket')
            : low.includes('row-level') || low.includes('policy') || low.includes('unauthorized') || low.includes('403')
              ? t('account.avatarNoPolicy')
              : low.includes('no-account')
                ? t('account.intro')
                : `${t('account.avatarFail')} (${err})`,
        )
      }
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleAuth(mode: 'in' | 'up') {
    setBusy(true)
    setErr(null)
    setNote(null)
    try {
      // смена пользователя на устройстве заменит локальные данные — заранее копия
      let backedUp = true
      if (getLastCloudUser() && localCounts(useStore.getState().data).total > 0) {
        backedUp = exportDataToFile(useStore.getState().data)
      }
      const res = mode === 'in' ? await signIn(email.trim(), pass) : await signUp(email.trim(), pass)
      if (res === 'confirm_email') setNote(t('settings.confirmEmail'))
      if (res === 'switched')
        setNote(t(backedUp ? 'settings.accountSwitched' : 'settings.accountSwitchedNoBackup'))
      setPass('')
    } catch (e) {
      setErr(t(authErrorKey(e instanceof Error ? e.message : '')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('settings.account')}>
      <div className="flex flex-col gap-3 pb-2">
        {account ? (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarBusy}
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full"
                style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}
                aria-label={t('account.avatarChange')}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <UserRound size={26} />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/40 py-0.5 text-white">
                  <Camera size={12} />
                </span>
              </button>
              <div className="min-w-0">
                <div className="text-xs text-[var(--text-3)]">{t('account.signedInAs')}</div>
                <div className="truncate text-sm font-medium">{account.email}</div>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarBusy}
                    className="text-xs text-[var(--accent)]"
                  >
                    {avatarBusy ? '…' : t('account.avatarChange')}
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => void removeAvatar()}
                      className="inline-flex items-center gap-0.5 text-xs text-[var(--text-3)]"
                    >
                      <Trash2 size={12} /> {t('account.avatarRemove')}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickAvatar}
            />
            {avatarErr && <p className="text-xs text-[var(--danger)]">{avatarErr}</p>}
            <p className="text-xs text-[var(--text-3)]">{t('account.cloudHint')}</p>
            <Button variant="ghost" onClick={() => void signOut()}>
              <LogOut size={16} /> {t('settings.signOut')}
            </Button>

            {/* Удаление аккаунта — требование Google Play: путь удаления должен
                быть в самом приложении и легко находиться. */}
            <div className="mt-1 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setDelErr(null)
                    setWipeLocal(false)
                    setConfirmDelete(true)
                  }}
                  className="text-xs font-medium"
                  style={{ color: 'var(--danger-text)' }}
                >
                  {t('account.deleteAccount')}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--danger-text)' }}>
                    {t('account.deleteConfirmTitle')}
                  </p>
                  <p className="text-xs text-[var(--text-2)]">{t('account.deleteConfirmBody')}</p>
                  <label className="flex items-start gap-2 text-xs text-[var(--text-2)]">
                    <Checkbox checked={wipeLocal} onChange={setWipeLocal} label={t('account.deleteWipeLocal')} />
                    <span className="flex-1">{t('account.deleteWipeLocal')}</span>
                  </label>
                  {delErr && <p className="text-xs text-[var(--danger)]">{delErr}</p>}
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={delBusy}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      variant="danger"
                      loading={delBusy}
                      onClick={async () => {
                        setDelBusy(true)
                        setDelErr(null)
                        try {
                          await deleteAccount(wipeLocal)
                          setConfirmDelete(false)
                          onClose()
                        } catch (e) {
                          setDelErr(
                            (e as Error).message?.includes('delete_account')
                              ? t('account.deleteNoFunction')
                              : t('account.deleteFail'),
                          )
                        } finally {
                          setDelBusy(false)
                        }
                      }}
                    >
                      <Trash2 size={16} /> {t('account.deleteConfirmBtn')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--text-2)]">{t('account.intro')}</p>
            <Field label={t('settings.email')}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="none"
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>
            <Field label={t('settings.password')}>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                autoComplete="current-password"
                onKeyDown={(e) => e.key === 'Enter' && email && pass && handleAuth('in')}
              />
            </Field>
            {err && <p className="text-sm text-[var(--danger)]">{err}</p>}
            {note && <p className="text-sm text-[var(--text-2)]">{note}</p>}
            <div className="flex gap-2">
              <Button fullWidth disabled={busy || !email || !pass} onClick={() => handleAuth('in')}>
                {t('settings.signIn')}
              </Button>
              <Button variant="subtle" disabled={busy || !email || !pass} onClick={() => handleAuth('up')}>
                {t('settings.signUp')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
