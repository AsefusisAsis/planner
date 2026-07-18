import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { Sun, Moon, Monitor, Cloud, ChevronDown, RefreshCw, Check, Download, Upload, Database, MapPin, X, User, LogOut, CloudUpload } from 'lucide-react'
import { useStore } from '../../store'
import { useVoice } from '../../lib/voice'
import { Button, Card, Checkbox, Field, Modal, PageHeader, SegmentedControl } from '../../components/ui'
import { PalettePicker } from '../../components/PalettePicker'
import { CURRENCIES, type AppData, type Currency, type Language, type ThemeMode } from '../../types'
import { testConnection } from '../../services/github'
import { geocodeCity, describeWeather } from '../../services/weather'
import { getLastCloudUser, localCounts } from '../../services/cloudSync'
import { authErrorKey } from '../../lib/authErrors'
import { loadGitHubConfig } from '../../lib/localConfig'

export default function SettingsPage() {
  const { t } = useTranslation()
  const vt = useVoice()
  const settings = useStore((s) => s.data.settings)
  const setTheme = useStore((s) => s.setTheme)
  const setLanguage = useStore((s) => s.setLanguage)
  const setBaseCurrency = useStore((s) => s.setBaseCurrency)
  const setPalette = useStore((s) => s.setPalette)
  const setUserName = useStore((s) => s.setUserName)
  const openOnboarding = useStore((s) => s.openOnboarding)
  const cycleEnabled = useStore((s) => s.data.settings.cycleEnabled)
  const setCycleEnabled = useStore((s) => s.setCycleEnabled)
  const setCycleGitHubSync = useStore((s) => s.setCycleGitHubSync)

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

  // ---- аккаунт (облачная синхронизация) ----
  const account = useStore((s) => s.account)
  const signIn = useStore((s) => s.signIn)
  const signUp = useStore((s) => s.signUp)
  const signOut = useStore((s) => s.signOut)
  const cloudSyncNow = useStore((s) => s.cloudSyncNow)
  const migrateToCloud = useStore((s) => s.migrateToCloud)
  const getMigrationCounts = useStore((s) => s.getMigrationCounts)

  const [authEmail, setAuthEmail] = useState('')
  const [authPass, setAuthPass] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authErr, setAuthErr] = useState<string | null>(null)
  const [authNote, setAuthNote] = useState<string | null>(null)

  async function handleAuth(mode: 'in' | 'up') {
    setAuthBusy(true)
    setAuthErr(null)
    setAuthNote(null)
    try {
      // на устройстве раньше был другой аккаунт: при смене пользователя
      // локальные данные будут заменены — заранее скачиваем копию
      let backedUp = true
      if (getLastCloudUser() && localCounts(useStore.getState().data).total > 0) {
        backedUp = exportData()
      }
      const res =
        mode === 'in' ? await signIn(authEmail.trim(), authPass) : await signUp(authEmail.trim(), authPass)
      if (res === 'confirm_email') setAuthNote(t('settings.confirmEmail'))
      // честно: если файл-копию сохранить не удалось (телефон) — говорим об этом
      if (res === 'switched') setAuthNote(t(backedUp ? 'settings.accountSwitched' : 'settings.accountSwitchedNoBackup'))
      setAuthPass('')
    } catch (e) {
      // сырой англ. текст Supabase → понятное локализованное сообщение с подсказкой
      setAuthErr(t(authErrorKey(e instanceof Error ? e.message : '')))
    } finally {
      setAuthBusy(false)
    }
  }

  const [migrOpen, setMigrOpen] = useState(false)
  const [migrCounts, setMigrCounts] = useState<{ local: number; server: number } | null>(null)
  const [migrBusy, setMigrBusy] = useState(false)
  const [migrDone, setMigrDone] = useState<number | null>(null)
  const [migrErr, setMigrErr] = useState<string | null>(null)

  async function openMigration() {
    setMigrOpen(true)
    setMigrDone(null)
    setMigrErr(null)
    setMigrCounts(null)
    try {
      setMigrCounts(await getMigrationCounts())
    } catch (e) {
      setMigrErr(e instanceof Error ? e.message : t('settings.authError'))
    }
  }

  async function runMigration() {
    setMigrBusy(true)
    setMigrErr(null)
    try {
      exportData() // автоматическая резервная копия перед переносом
      const count = await migrateToCloud()
      setMigrDone(count)
      setMigrCounts(await getMigrationCounts())
    } catch {
      // перенос не удался (сеть/лимит) — данные не потеряны, отдельный текст
      setMigrErr(t('settings.migrateError'))
    } finally {
      setMigrBusy(false)
    }
  }
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

  /** Скачивает копию файлом. Возвращает false, если сохранить нельзя
   *  (Android WebView игнорирует <a download> — не делаем вид, что сработало). */
  function exportData(): boolean {
    if (Capacitor.isNativePlatform()) return false
    const data = useStore.getState().data
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    return true
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as AppData
      if (!parsed || typeof parsed !== 'object' || !('version' in parsed)) throw new Error('bad')
      // под аккаунтом восстановление зальёт копию в облако и на все устройства,
      // перезаписав там данные более старой версией — предупреждаем отдельно
      const confirmKey = account ? 'settings.importConfirmCloud' : 'settings.importConfirm'
      if (window.confirm(vt(confirmKey))) await importData(parsed)
    } catch {
      window.alert(vt('settings.importBad'))
    }
    e.target.value = ''
  }

  const existing = loadGitHubConfig()
  // GitHub-карточка свёрнута по умолчанию (запасной канал, экономим место)
  const [ghOpen, setGhOpen] = useState(false)
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

  const themeOptions: { value: ThemeMode; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun size={16} />, label: t('settings.themeLight') },
    { value: 'dark', icon: <Moon size={16} />, label: t('settings.themeDark') },
    { value: 'system', icon: <Monitor size={16} />, label: t('settings.themeSystem') },
  ]

  return (
    <div>
      <PageHeader title={t('settings.title')} />

      {/* Account (облачная синхронизация) */}
      <Card className="mb-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]">
          <User size={16} /> {t('settings.account')}
        </h2>
        <p className="mb-4 text-xs text-[var(--text-3)]">{t('settings.accountDesc')}</p>

        {account ? (
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--success)' }}>
              <Check size={16} /> {t('settings.signedInAs')}: {account.email}
            </div>
            {sync.lastSyncAt && (
              <p className="mb-3 text-xs text-[var(--text-3)]">
                {t('settings.lastSync')}: {new Date(sync.lastSyncAt).toLocaleString()}
              </p>
            )}
            {sync.error && (
              <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>{sync.error}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="subtle" loading={sync.status === 'syncing'} onClick={() => cloudSyncNow()}>
                <RefreshCw size={16} />
                {t('settings.syncNow')}
              </Button>
              <Button variant="subtle" onClick={openMigration}>
                <CloudUpload size={16} /> {t('settings.migrate')}
              </Button>
              <Button variant="ghost" onClick={() => signOut()}>
                <LogOut size={16} /> {t('settings.signOut')}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Field label={t('settings.email')}>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </Field>
            <Field label={t('settings.password')}>
              <input
                type="password"
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            {authErr && <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>{authErr}</p>}
            {authNote && <p className="mb-3 text-xs" style={{ color: 'var(--warning)' }}>{authNote}</p>}
            <div className="flex gap-2">
              <Button
                loading={authBusy}
                onClick={() => handleAuth('in')}
                disabled={!authEmail.trim() || !authPass}
              >
                {t('settings.signIn')}
              </Button>
              <Button
                variant="subtle"
                loading={authBusy}
                onClick={() => handleAuth('up')}
                disabled={!authEmail.trim() || authPass.length < 6}
              >
                {t('settings.signUp')}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Appearance */}
      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">{t('settings.appearance')}</h2>

        <Field label={t('settings.userName')}>
          <input
            value={settings.userName ?? ''}
            onChange={(e) => setUserName(e.target.value)}
            placeholder={t('onboarding.namePlaceholder')}
            maxLength={40}
          />
        </Field>

        {/* вход в мастер: без него расширенный онбординг недостижим уже
            установившим приложение */}
        <button
          onClick={openOnboarding}
          className="mb-4 flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium">{t('settings.reviewProfile')}</span>
            <span className="block text-xs text-[var(--text-3)]">{t('settings.reviewProfileDesc')}</span>
          </span>
          <User size={16} className="shrink-0 text-[var(--text-3)]" />
        </button>

        {/* прямой тумблер трекера цикла — чтобы не искать в мастере профиля */}
        <label
          className="mb-2 flex items-center gap-3 rounded-xl border px-3 py-2.5"
          style={{ borderColor: 'var(--border)' }}
        >
          <Checkbox checked={!!cycleEnabled} onChange={setCycleEnabled} label={t('settings.cycleTracker')} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{t('settings.cycleTracker')}</span>
            <span className="block text-xs text-[var(--text-3)]">{t('settings.cycleTrackerDesc')}</span>
          </span>
        </label>

        {/* опция: синк цикла через ЛИЧНЫЙ GitHub (в Supabase не уходит никогда) */}
        {cycleEnabled && (
          <label
            className="mb-4 flex items-center gap-3 rounded-xl border px-3 py-2.5"
            style={{ borderColor: 'var(--border)', opacity: existing ? 1 : 0.6 }}
          >
            <Checkbox
              checked={!!settings.cycleGitHubSync && !!existing}
              onChange={(v) => existing && setCycleGitHubSync(v)}
              label={t('settings.cycleGhSync')}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t('settings.cycleGhSync')}</span>
              <span className="block text-xs text-[var(--text-3)]">
                {existing ? t('settings.cycleGhSyncDesc') : t('settings.cycleGhSyncNeedsGh')}
              </span>
            </span>
          </label>
        )}

        <Field label={t('settings.theme')}>
          <SegmentedControl options={themeOptions} value={settings.theme} onChange={setTheme} />
        </Field>

        <Field label={t('settings.palette')}>
          {/* карточки-превью: тема выбирается по характеру, а не по названию */}
          <PalettePicker value={settings.palette ?? 'classic'} onChange={setPalette} />
        </Field>

        <Field label={t('settings.language')}>
          <SegmentedControl
            options={(['ru', 'en'] as Language[]).map((l) => ({
              value: l,
              label: l === 'ru' ? 'Русский' : 'English',
            }))}
            value={settings.language}
            onChange={setLanguage}
          />
        </Field>

        <Field label={t('settings.baseCurrency')}>
          <SegmentedControl
            options={CURRENCIES.map((c: Currency) => ({ value: c, label: c }))}
            value={settings.baseCurrency}
            onChange={setBaseCurrency}
          />
        </Field>
      </Card>

      {/* Sync (GitHub) — запасной канал: свёрнут по умолчанию, чтобы не
          занимать место (основной синк — аккаунт выше) */}
      <Card className="mb-4">
        <button
          onClick={() => setGhOpen((v) => !v)}
          aria-expanded={ghOpen}
          className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-2)]">
            <Cloud size={16} /> {t('settings.sync')}
          </h2>
          <span className="flex items-center gap-2">
            {existing && (
              <span className="text-xs font-medium" style={{ color: 'var(--success-text)' }}>
                {t('settings.connected')}
              </span>
            )}
            <ChevronDown
              size={16}
              className="text-[var(--text-3)] transition-transform duration-200"
              style={{ transform: ghOpen ? undefined : 'rotate(-90deg)' }}
            />
          </span>
        </button>
        {ghOpen && (
        <div className="anim-fade pt-3">
        <p className="mb-4 text-xs text-[var(--text-3)]">{t('settings.syncDesc')}</p>

        {existing ? (
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--success)' }}>
              <Check size={16} /> {t('settings.connected')}: {existing.owner}/{existing.repo}
            </div>
            {sync.lastSyncAt && (
              <p className="mb-3 text-xs text-[var(--text-3)]">
                {t('settings.lastSync')}: {new Date(sync.lastSyncAt).toLocaleString()}
              </p>
            )}
            {sync.error && <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>{sync.error}</p>}
            <div className="flex gap-2">
              <Button variant="subtle" loading={sync.status === 'syncing'} onClick={() => syncNow()}>
                <RefreshCw size={16} />
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
            <Button loading={testing} onClick={handleConnect} disabled={!owner || !repo || !token}>
              {t('settings.connect')}
            </Button>
          </div>
        )}
        </div>
        )}
      </Card>

      {/* Rates */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-2)]">{t('settings.rates')}</h2>
        {ratesError && <p className="mb-2 text-xs" style={{ color: 'var(--danger)' }}>{ratesError}</p>}
        {rates ? (
          <div className="mb-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-2)]">1 USD</span><span className="tnum">{rates.bynPerUnit.USD?.toFixed(4)} BYN</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-2)]">100 RUB</span><span className="tnum">{((rates.bynPerUnit.RUB ?? 0) * 100).toFixed(4)} BYN</span></div>
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
              className="-my-1 -mr-1 flex min-h-11 min-w-11 items-center justify-center text-[var(--text-3)] hover:text-[var(--danger)]"
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
          <Button variant="subtle" onClick={() => { if (!exportData()) window.alert(vt('settings.exportUnavailable')) }}>
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

      {/* Мастер переноса данных в аккаунт */}
      <Modal open={migrOpen} onClose={() => setMigrOpen(false)} title={t('settings.migrateTitle')}>
        <p className="mb-4 text-sm text-[var(--text-2)]">{t('settings.migrateDesc')}</p>
        <div className="mb-4 grid grid-cols-2 gap-2 text-center text-sm">
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-3)' }}>
            <div className="text-xs text-[var(--text-3)]">{t('settings.migrateLocal')}</div>
            <div className="text-lg font-semibold">{migrCounts ? migrCounts.local : '…'}</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-3)' }}>
            <div className="text-xs text-[var(--text-3)]">{t('settings.migrateServer')}</div>
            <div className="text-lg font-semibold">{migrCounts ? migrCounts.server : '…'}</div>
          </div>
        </div>
        {hasPlainCards && (
          <p className="mb-3 text-xs" style={{ color: 'var(--warning)' }}>
            {t('settings.exportPlainCards')}
          </p>
        )}
        {migrErr && <p className="mb-3 text-xs" style={{ color: 'var(--danger)' }}>{migrErr}</p>}
        {migrDone != null ? (
          <p className="mb-3 text-sm" style={{ color: 'var(--success)' }}>
            {t('settings.migrateDone', { count: migrDone })}
          </p>
        ) : (
          <Button loading={migrBusy} onClick={runMigration} disabled={!migrCounts}>
            <CloudUpload size={16} />
            {t('settings.migrateGo')}
          </Button>
        )}
      </Modal>
    </div>
  )
}
