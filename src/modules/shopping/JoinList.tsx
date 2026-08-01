import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Users, Check, AlertTriangle } from 'lucide-react'
import { Button, Card, PageHeader } from '../../components/ui'
import { useStore } from '../../store'

/**
 * Приём приглашения в общий список: экран по ссылке #/join/<токен>.
 *
 * Аккаунт обязателен (решение пользователя): без него доступ не на что
 * выдавать — вся модель прав построена на пользователе. Поэтому неавторизо-
 * ванному честно говорим войти, а токен не теряем — после входа он всё ещё
 * в адресе, достаточно нажать «Присоединиться».
 */
export default function JoinList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { token } = useParams<{ token: string }>()
  const account = useStore((s) => s.account)
  const acceptSharedInvite = useStore((s) => s.acceptSharedInvite)

  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')
  const [err, setErr] = useState<string | null>(null)

  async function join() {
    if (!token) return
    setState('busy')
    setErr(null)
    try {
      await acceptSharedInvite(token)
      setState('done')
    } catch (e) {
      // причину показываем: «просрочено» и «нет доступа» чинятся по-разному
      setErr(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }

  // Со свежим входом присоединяем сразу — лишний клик тут ничего не решает
  useEffect(() => {
    if (account && state === 'idle' && token) void join()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, token])

  return (
    <div>
      <PageHeader title={t('shopping.joinTitle')} subtitle={t('shopping.joinSubtitle')} />
      <Card>
        {!token ? (
          <p className="text-sm" style={{ color: 'var(--danger-text)' }}>
            {t('shopping.joinBadLink')}
          </p>
        ) : !account ? (
          <>
            <p className="mb-3 text-sm text-[var(--text-2)]">{t('shopping.joinNeedAccount')}</p>
            <Button onClick={() => navigate('/settings')}>{t('shopping.joinGoSignIn')}</Button>
          </>
        ) : state === 'done' ? (
          <>
            <p className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--success)' }}>
              <Check size={16} /> {t('shopping.joinDone')}
            </p>
            <Button onClick={() => navigate('/shopping')}>{t('shopping.joinOpen')}</Button>
          </>
        ) : state === 'error' ? (
          <>
            <p className="mb-2 flex items-start gap-2 text-sm" style={{ color: 'var(--danger-text)' }}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{t('shopping.joinFailed')}{err ? ` (${err})` : ''}</span>
            </p>
            <Button variant="subtle" onClick={() => void join()}>{t('shopping.joinRetry')}</Button>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-[var(--text-2)]">
            <Users size={16} /> {t('shopping.joinBusy')}
          </p>
        )}
      </Card>
    </div>
  )
}
