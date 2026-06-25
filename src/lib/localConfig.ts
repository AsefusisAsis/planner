// ============================================================
// Локальная конфигурация, которая НЕ синхронизируется и НЕ попадает в data.json.
// Здесь живут GitHub-креды (включая токен) и метаданные синхронизации.
// Только localStorage конкретного устройства.
// ============================================================

export interface GitHubConfig {
  owner: string
  repo: string
  /** Путь к файлу данных в репозитории */
  path: string
  branch: string
  /** Fine-grained PAT с правом Contents: read/write только на этот репо */
  token: string
}

export interface SyncMeta {
  /** SHA последней известной версии файла на GitHub */
  sha?: string
  /** ISO время последней успешной синхронизации */
  lastSyncAt?: string
}

const GH_KEY = 'planner.github'
const META_KEY = 'planner.syncmeta'

export function loadGitHubConfig(): GitHubConfig | null {
  try {
    const raw = localStorage.getItem(GH_KEY)
    if (!raw) return null
    const cfg = JSON.parse(raw) as GitHubConfig
    if (!cfg.owner || !cfg.repo || !cfg.token) return null
    return { ...cfg, branch: cfg.branch || 'main', path: cfg.path || 'data.json' }
  } catch {
    return null
  }
}

export function saveGitHubConfig(cfg: GitHubConfig | null) {
  if (cfg) localStorage.setItem(GH_KEY, JSON.stringify(cfg))
  else localStorage.removeItem(GH_KEY)
}

export function loadSyncMeta(): SyncMeta {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveSyncMeta(meta: SyncMeta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}
