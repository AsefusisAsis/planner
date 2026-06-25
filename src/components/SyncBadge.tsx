import { useTranslation } from 'react-i18next'
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check } from 'lucide-react'
import { useStore } from '../store'

export function SyncBadge() {
  const { t } = useTranslation()
  const sync = useStore((s) => s.sync)
  const syncNow = useStore((s) => s.syncNow)

  const map = {
    idle: { icon: <Check size={14} />, text: t('settings.statusIdle'), color: 'var(--success)' },
    syncing: {
      icon: <RefreshCw size={14} className="animate-spin" />,
      text: t('settings.statusSyncing'),
      color: 'var(--text-2)',
    },
    error: {
      icon: <AlertTriangle size={14} />,
      text: t('settings.statusError'),
      color: 'var(--danger)',
    },
    offline: { icon: <CloudOff size={14} />, text: t('settings.statusOffline'), color: 'var(--warning)' },
    disabled: { icon: <Cloud size={14} />, text: t('settings.statusDisabled'), color: 'var(--text-3)' },
  } as const

  const s = map[sync.status]

  return (
    <button
      onClick={() => sync.configured && syncNow()}
      disabled={!sync.configured || sync.status === 'syncing'}
      title={sync.error || s.text}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium hover:bg-[var(--bg-3)] transition-colors disabled:cursor-default"
      style={{ color: s.color }}
    >
      {s.icon}
      <span className="hidden sm:inline">{s.text}</span>
    </button>
  )
}
