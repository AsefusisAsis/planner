import { useTranslation } from 'react-i18next'
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CloudCheck } from 'lucide-react'
import { useStore } from '../store'

export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const sync = useStore((s) => s.sync)
  const account = useStore((s) => s.account)
  const syncNow = useStore((s) => s.syncNow)
  const cloudSyncNow = useStore((s) => s.cloudSyncNow)

  // «Синхронизировано» — только если синк реально прошёл (есть lastSyncAt).
  // Просто «настроено, но ещё не синкалось» — нейтральное облако.
  const synced = sync.status === 'idle' && !!sync.lastSyncAt

  const view =
    sync.status === 'syncing'
      ? { icon: <RefreshCw size={16} className="animate-spin" />, text: t('settings.statusSyncing'), color: 'var(--text-2)' }
      : sync.status === 'error'
        ? { icon: <AlertTriangle size={16} />, text: t('settings.statusError'), color: 'var(--danger-text)' }
        : sync.status === 'offline'
          ? { icon: <CloudOff size={16} />, text: t('settings.statusOffline'), color: 'var(--warning-text)' }
          : sync.status === 'disabled'
            ? { icon: <Cloud size={16} />, text: t('settings.statusDisabled'), color: 'var(--text-3)' }
            : synced
              ? { icon: <CloudCheck size={16} />, text: t('settings.statusSynced'), color: 'var(--success-text)' }
              : { icon: <Cloud size={16} />, text: t('settings.statusIdle'), color: 'var(--text-3)' }

  const title = synced && sync.lastSyncAt
    ? `${t('settings.lastSync')}: ${new Date(sync.lastSyncAt).toLocaleTimeString()}`
    : sync.error || view.text

  // компактный бейдж-индикатор для наложения на иконку аккаунта (правый нижний
  // угол): только иконка статуса на кольце цвета фона, без текста, пассивный
  if (compact) {
    return (
      <span
        title={title}
        aria-label={view.text}
        className="pointer-events-none flex h-4 w-4 items-center justify-center rounded-full"
        style={{ background: 'var(--bg)', color: view.color }}
      >
        {sync.status === 'syncing' ? (
          <RefreshCw size={11} className="animate-spin" />
        ) : synced ? (
          <CloudCheck size={11} />
        ) : sync.status === 'error' ? (
          <AlertTriangle size={11} />
        ) : sync.status === 'offline' ? (
          <CloudOff size={11} />
        ) : (
          <Cloud size={11} />
        )}
      </span>
    )
  }

  return (
    <button
      onClick={() => sync.configured && (account ? cloudSyncNow() : syncNow())}
      disabled={!sync.configured || sync.status === 'syncing'}
      title={title}
      aria-label={view.text}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[var(--bg-3)] disabled:cursor-default"
      style={{ color: view.color }}
    >
      {view.icon}
      <span className="hidden sm:inline">{view.text}</span>
    </button>
  )
}
