import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut, UserRound } from 'lucide-react'
import { useStore } from '../store'
import { Button, Field, Modal } from './ui'
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

  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

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
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}
              >
                <UserRound size={20} />
              </span>
              <div className="min-w-0">
                <div className="text-xs text-[var(--text-3)]">{t('account.signedInAs')}</div>
                <div className="truncate text-sm font-medium">{account.email}</div>
              </div>
            </div>
            <p className="text-xs text-[var(--text-3)]">{t('account.cloudHint')}</p>
            <Button variant="ghost" onClick={() => void signOut()}>
              <LogOut size={16} /> {t('settings.signOut')}
            </Button>
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
