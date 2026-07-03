import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sun, Moon, Monitor, Cloud, RefreshCw, Check, Download, Upload, Database, MapPin, X } from 'lucide-react'
import { useStore } from '../../store'
import { Button, Card, Field, PageHeader } from '../../components/ui'
import { CURRENCIES, type AppData, type Currency, type Language, type ThemeMode } from '../../types'
import { testConnection } from '../../services/github'
import { geocodeCity, describeWeather } from '../../services/weather'
import { loadGitHubConfig } from '../../lib/localConfig'

export default function SettingsPage() {
  const { t } = useTranslation()
  const settings = useStore((s) => s.data.settings)
  const setTheme = useStore((s) => s.setTheme)
  const setLanguage = useStore((s) => s.setLanguage)
  const setBaseCurrency = useStore((s) => s.setBaseCurrency)

  const sync = useStore((s) => s.sync)
  const connectGitHub = useStore((s) => s.connectGitHub)
  const disconnectGitHub = useStore((s) => s.disconnectGitHub)
  const syncNow = useStore((s) => s.syncNow)

  const rates = useStore((s) => s.rates)
  const ratesError = useStore((s) => s.ratesError)
  const refreshRates = useStore((s) => s.refreshRates)
  const importData = useStore((s) => s.importData)

  const weather = useStore((s) => s.weather)
  const setWeatherLocation = useStore((s) => s.setWeatherLocation)
  /** есть банковские карты с номерами открытым текстом — экспорт их раскроет */
  const hasPlainCards = useStore((s) => s.data.cards.some((c) => !c.loyalty && !c.enc))
  const [city, setCity] = useState('')
  const [geoStatus, setGeoStatus] = useState<'idle' | 'searching' | 'notfound' | 'error'>('idle')

  async function applyCity() {
    const q = city.trim()
    if (!q) return
    setGeoStatus('searching')
    try {
      const loc = await geocodeCity(q, settings.language)
      if (!loc) {
        setGeoStatus('notfound')
        return
      }
      await setWeatherLocation(loc)
      setCity('')
      setGeoStatus('idle')
    } catch {
      setGeoStatus('error')
    }
  }

  const fileRef = useRef<HTMLInputElement>(null)

  function exportData() {
    const data = useStore.getState().data
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as AppData
      if (!parsed || typeof parsed !== 'object' || !('version' in parsed)) throw new Error('bad')
      if (window.confirm(t('settings.importConfirm'))) await importData(parsed)
    } catch {
      window.alert(t('settings.importBad'))
    }
    e.target.value = ''
  }

  const existing = loadGitHubConfig()
  const [owner, setOwner] = useState(existing?.owner ?? '')
  const [repo, setRepo] = useState(existing?.repo ?? '')
  const [path, setPath] = useState(existing?.path ?? 'data.json')
  const [branch, setBranch] = useState(existing?.branch ?? 'main')
  const [token, setToken] = useState(existing?.token ?? '')
  const [testing, setTesting] = useState(false)
  const [testErr, setTestErr] = useState<string | null>(null)

  async function handleConnect() {
    setTesting(true)
    setTestErr(null)
    const cfg = { owner: owner.trim(), repo: repo.trim(), path: path.trim(), branch: branch.trim(), token: token.trim() }
    try {
      await testConnection(cfg)
      await connectGitHub(cfg)
    } catch (e) {
      setTestErr(e instanceof Error ? e.message : t('settings.connectError'))
    } finally {
      setTesting(false)
    }
  }

  const themeBtns: { v: ThemeMode; icon: React.ReactNode; label: string }[] = [
    { v: 'light', icon: <Sun size={16} />, label: t('settings.themeLight') },
    { v: 'dark', icon: <Moon size={16} />, label: t('settings.themeDark') },
    { v: 'system', icon: <Monitor size={16} />, label: t('settings.themeSystem') },
  ]

  return (
    <div>
      <PageHeader title={t('settings.title')} />

      {/* Appearance */}
      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">{t('settings.appearance')}</h2>

        <Field label={t('settings.theme')}>
          <div className="grid grid-cols-3 gap-2">
            {themeBtns.map((b) => (
              <button
                key={b.v}
                onClick={() => setTheme(b.v)}
                className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
                style={{
                  borderColor: settings.theme === b.v ? 'var(--accent)' : 'var(--border)',
                  background: settings.theme === b.v ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                  color: settings.theme === b.v ? 'var(--accent)' : 'var(--text-2)',
                }}
              >
                {b.icon}
                {b.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('settings.language')}>
          <div className="grid grid-cols-2 gap-2">
            {(['ru', 'en'] as Language[]).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className="rounded-lg border px-3 py-2 text-sm transition-colors"
                style={{
                  borderColor: settings.language === l ? 'var(--accent)' : 'var(--border)',
                  background: settings.language === l ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                  color: settings.language === l ? 'var(--accent)' : 'var(--text-2)',
                }}
              >
                {l === 'ru' ? 'Русский' : 'English'}
              </button>
            ))}
          </div>
        </Field>

        <Field label={t('settings.baseCurrency')}>
          <div className="grid grid-cols-3 gap-2">
            {CURRENCIES.map((c: Currency) => (
              <button
                key={c}
                onClick={() => setBaseCurrency(c)}
                className="rounded-lg border px-3 py-2 text-sm transition-colors"
                style={{
                  borderColor: settings.baseCurrency === c ? 'var(--accent)' : 'var(--border)',
                  background: settings.baseCurrency === c ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                  color: settings.baseCurrency === c ? 'var(--accent)' : 'var(--text-2)',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>
      </Card>

      {/* Sync */}
      <Card className="mb-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]">
          <Cloud size={16} /> {t('settings.sync')}
        </h2>
        <p className="mb-4 text-xs text-[var(--text-3)]">{t('settings.syncDesc')}</p>

        {sync.configured ? (
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--success)' }}>
              <Check size={16} /> {t('settings.connected')}: {existing?.owner}/{existing?.repo}
            </div>
            {sync.lastSyncAt && (
              <p className="mb-3 text-xs text-[var(--text-3)]">
                {t('settings.lastSync')}: {new Date(sync.lastSyncAt).toLocaleString()}
              </p>
            )}
            {sync.error && <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>{sync.error}</p>}
            <div className="flex gap-2">
              <Button variant="subtle" onClick={() => syncNow()} disabled={sync.status === 'syncing'}>
                <RefreshCw size={16} className={sync.status === 'syncing' ? 'animate-spin' : ''} />
                {t('settings.syncNow')}
              </Button>
              <Button variant="ghost" onClick={disconnectGitHub}>{t('settings.disconnect')}</Button>
            </div>
          </div>
        ) : (
          <div>
            <Field label={t('settings.owner')}>
              <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="username" />
            </Field>
            <Field label={t('settings.repo')}>
              <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="planner-data" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('settings.path')}>
                <input value={path} onChange={(e) => setPath(e.target.value)} />
              </Field>
              <Field label={t('settings.branch')}>
                <input value={branch} onChange={(e) => setBranch(e.target.value)} />
              </Field>
            </div>
            <Field label={t('settings.token')}>
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_..." />
            </Field>
            {testErr && <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>{testErr}</p>}
            <Button onClick={handleConnect} disabled={testing || !owner || !repo || !token}>
              {testing ? t('settings.testing') : t('settings.connect')}
            </Button>
          </div>
        )}
      </Card>

      {/* Rates */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">{t('settings.rates')}</h2>
        {ratesError && <p className="mb-2 text-xs" style={{ color: 'var(--danger)' }}>{ratesError}</p>}
        {rates ? (
          <div className="mb-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-2)]">1 USD</span><span>{rates.bynPerUnit.USD?.toFixed(4)} BYN</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-2)]">100 RUB</span><span>{((rates.bynPerUnit.RUB ?? 0) * 100).toFixed(4)} BYN</span></div>
            <p className="pt-1 text-xs text-[var(--text-3)]">
              {t('settings.ratesUpdated')}: {new Date(rates.fetchedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="mb-3 text-sm text-[var(--text-3)]">—</p>
        )}
        <Button variant="subtle" onClick={() => refreshRates(true)}>
          <RefreshCw size={16} /> {t('settings.refreshRates')}
        </Button>
      </Card>

      {/* Weather */}
      <Card className="mt-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]">
          <MapPin size={16} /> {t('settings.weather')}
        </h2>
        <p className="mb-3 text-xs text-[var(--text-3)]">{t('settings.weatherDesc')}</p>

        {settings.weatherLocation && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--bg-3)' }}>
            <span className="flex items-center gap-2 text-sm">
              <MapPin size={14} style={{ color: 'var(--accent)' }} />
              {settings.weatherLocation.name}
              {weather && (
                <span className="text-[var(--text-2)]">
                  · {describeWeather(weather.code).emoji} {weather.tempC}°C
                </span>
              )}
            </span>
            <button
              onClick={() => setWeatherLocation(null)}
              aria-label={t('settings.weatherClear')}
              className="text-[var(--text-3)] hover:text-[var(--danger)]"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <Field label={t('settings.weatherCity')}>
          <div className="flex gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyCity()}
              placeholder={t('settings.weatherCityPlaceholder')}
            />
            <Button onClick={applyCity} disabled={!city.trim() || geoStatus === 'searching'} className="shrink-0">
              {geoStatus === 'searching' ? t('settings.testing') : t('settings.weatherSet')}
            </Button>
          </div>
        </Field>
        {geoStatus === 'notfound' && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>{t('settings.weatherNotFound')}</p>
        )}
        {geoStatus === 'error' && (
          <p className="text-xs" style={{ color: 'var(--danger)' }}>{t('settings.weatherError')}</p>
        )}
      </Card>

      {/* Data / backup */}
      <Card className="mt-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]">
          <Database size={16} /> {t('settings.data')}
        </h2>
        <p className="mb-4 text-xs text-[var(--text-3)]">{t('settings.dataDesc')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="subtle" onClick={exportData}>
            <Download size={16} /> {t('settings.exportBtn')}
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> {t('settings.importBtn')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            className="hidden"
          />
        </div>
        {hasPlainCards && (
          <p className="mt-2 text-xs" style={{ color: 'var(--warning)' }}>
            {t('settings.exportPlainCards')}
          </p>
        )}
      </Card>
    </div>
  )
}
