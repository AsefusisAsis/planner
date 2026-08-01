import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HeartPulse, Download, ExternalLink, Check } from 'lucide-react'
import { Button, Card } from '../../../components/ui'
import { useStore } from '../../../store'
import {
  getHealthStatus,
  openHealthConnect,
  readHealthWeights,
  requestHealthPermission,
  type HealthStatus,
} from '../../../lib/healthConnect'

/**
 * Импорт веса из Health Connect.
 *
 * Читаем только вес и только в одну сторону. Ничего в общее хранилище ОС не
 * пишем, и данные цикла туда не отдаём: решение «цикл не покидает устройство»
 * остаётся в силе, а Health Connect читают другие одобренные приложения.
 *
 * На вебе и на старом Android карточка не показывается вовсе — предлагать
 * то, чего на устройстве нет, бессмысленно.
 */
export function HealthConnectCard() {
  const { t } = useTranslation()
  const importHealthWeights = useStore((s) => s.importHealthWeights)

  const [status, setStatus] = useState<HealthStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function refresh() {
    setStatus(await getHealthStatus())
  }
  useEffect(() => {
    void refresh()
  }, [])

  if (!status || status.state === 'unsupported') return null

  async function grant() {
    setErr(null)
    setBusy(true)
    try {
      await requestHealthPermission()
      await refresh() // состояние перечитываем, а не верим результату диалога
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    setErr(null)
    setResult(null)
    setBusy(true)
    try {
      const samples = await readHealthWeights()
      const plan = importHealthWeights(samples)
      setResult({ added: plan.add.length, skipped: plan.skippedExisting })
    } catch (e) {
      // молчаливое «импортировано 0» скрывало бы реальную ошибку чтения
      setErr((e as Error)?.message || t('health.hcReadFailed'))
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <HeartPulse size={16} style={{ color: 'var(--accent)' }} />
        <h3 className="text-sm font-semibold">{t('health.hcTitle')}</h3>
      </div>
      <p className="mb-3 text-xs text-[var(--text-3)]">{t('health.hcHint')}</p>

      {status.state === 'notInstalled' && (
        <>
          <p className="mb-2 text-sm text-[var(--text-2)]">{t('health.hcNotInstalled')}</p>
          <Button variant="subtle" onClick={() => void openHealthConnect()}>
            <ExternalLink size={15} /> {t('health.hcInstall')}
          </Button>
        </>
      )}

      {status.state === 'needsUpdate' && (
        <>
          <p className="mb-2 text-sm text-[var(--text-2)]">{t('health.hcNeedsUpdate')}</p>
          <Button variant="subtle" onClick={() => void openHealthConnect()}>
            <ExternalLink size={15} /> {t('health.hcOpen')}
          </Button>
        </>
      )}

      {status.state === 'noPermission' && (
        <>
          <p className="mb-2 text-sm text-[var(--text-2)]">{t('health.hcNoPermission')}</p>
          <Button variant="subtle" disabled={busy} onClick={() => void grant()}>
            {t('health.hcGrant')}
          </Button>
        </>
      )}

      {status.state === 'ready' && (
        <>
          <Button variant="subtle" disabled={busy} onClick={() => void runImport()}>
            <Download size={15} /> {t('health.hcImport')}
          </Button>
          {result && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--text-2)]">
              <Check size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--success)' }} />
              <span>
                {t('health.hcImported', { count: result.added })}
                {/* про пропущенные говорим прямо: иначе «добавлено 0» выглядит
                    поломкой, хотя это защита своих записей */}
                {result.skipped > 0 && ` · ${t('health.hcSkipped', { count: result.skipped })}`}
              </span>
            </p>
          )}
        </>
      )}

      {status.state === 'error' && (
        <p className="text-sm" style={{ color: 'var(--danger-text)' }}>
          {t('health.hcError')}
          {status.reason ? ` (${status.reason})` : ''}
        </p>
      )}

      {err && (
        <p className="mt-2 text-xs" style={{ color: 'var(--danger-text)' }}>
          {err}
        </p>
      )}
    </Card>
  )
}
