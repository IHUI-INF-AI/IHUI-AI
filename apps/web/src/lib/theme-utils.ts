/**
 * 主题工具集（合并版）
 *
 * 合并自旧架构 utils/ 下的 14 个主题相关文件：
 * - themeBackup / themeCloudSync / themeOfflineSync / themeHistory
 * - themeImportExport / themePreset / themeScheduledSwitch / themeShortcut
 * - themeTransition / themeAccessibility / themePerformance / themeDebug
 * - themeSyncConflict / themeSyncHistory
 *
 * 新架构基于纯 TypeScript + zustand theme store，无 Vue 依赖。
 */

export type ThemeMode = 'light' | 'dark' | 'auto'

export interface ThemeConfig {
  mode: ThemeMode
  primaryColor: string
  accentColor: string
  fontSize: number
  borderRadius: number
  fontFamily?: string
  custom?: Record<string, string>
}

export const DEFAULT_THEME: ThemeConfig = {
  mode: 'auto',
  primaryColor: '#07c160',
  accentColor: '#10b981',
  fontSize: 14,
  borderRadius: 8,
}

/* ------------------------------------------------------------------ */
/* 预设主题（themePreset）                                             */
/* ------------------------------------------------------------------ */

export interface ThemePreset {
  id: string
  name: string
  description: string
  config: ThemeConfig
  isOfficial: boolean
}

export const OFFICIAL_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: '默认绿',
    description: '清新明亮的默认配色（微信品牌绿）',
    config: DEFAULT_THEME,
    isOfficial: true,
  },
  {
    id: 'midnight',
    name: '午夜黑',
    description: '护眼深色主题',
    config: { ...DEFAULT_THEME, mode: 'dark', primaryColor: '#6366f1' },
    isOfficial: true,
  },
  {
    id: 'forest',
    name: '森林绿',
    description: '自然舒适',
    config: { ...DEFAULT_THEME, primaryColor: '#16a34a', accentColor: '#84cc16' },
    isOfficial: true,
  },
  {
    id: 'sunset',
    name: '日落橙',
    description: '温暖活力',
    config: { ...DEFAULT_THEME, primaryColor: '#f97316', accentColor: '#facc15' },
    isOfficial: true,
  },
]

export function getPreset(id: string): ThemePreset | undefined {
  return OFFICIAL_PRESETS.find((p) => p.id === id)
}

/* ------------------------------------------------------------------ */
/* 主题应用 / 切换                                                     */
/* ------------------------------------------------------------------ */

const ROOT = (): HTMLElement | null =>
  typeof document === 'undefined' ? null : document.documentElement

export function applyTheme(config: ThemeConfig): void {
  const root = ROOT()
  if (!root) return
  root.dataset.theme = config.mode
  root.style.setProperty('--primary-color', config.primaryColor)
  root.style.setProperty('--accent-color', config.accentColor)
  root.style.setProperty('--font-size', `${config.fontSize}px`)
  root.style.setProperty('--border-radius', `${config.borderRadius}px`)
  if (config.fontFamily) {
    root.style.setProperty('--font-family', config.fontFamily)
  }
  if (config.custom) {
    for (const [k, v] of Object.entries(config.custom)) {
      root.style.setProperty(`--${k}`, v)
    }
  }
}

export function getAppliedMode(): ThemeMode {
  const root = ROOT()
  if (!root) return 'light'
  return (root.dataset.theme as ThemeMode) ?? 'light'
}

export function toggleMode(): ThemeMode {
  const current = getAppliedMode()
  const next: ThemeMode = current === 'dark' ? 'light' : 'dark'
  const root = ROOT()
  if (root) root.dataset.theme = next
  return next
}

/* ------------------------------------------------------------------ */
/* 历史记录（themeHistory）                                            */
/* ------------------------------------------------------------------ */

export interface ThemeHistoryEntry {
  id: string
  config: ThemeConfig
  appliedAt: number
  source: 'user' | 'schedule' | 'sync' | 'preset'
}

const history: ThemeHistoryEntry[] = []
const MAX_HISTORY = 50

export function recordHistory(
  config: ThemeConfig,
  source: ThemeHistoryEntry['source'] = 'user',
): ThemeHistoryEntry {
  const entry: ThemeHistoryEntry = {
    id: `th_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    config: { ...config },
    appliedAt: Date.now(),
    source,
  }
  history.push(entry)
  if (history.length > MAX_HISTORY) history.shift()
  return entry
}

export function getHistory(limit = 20): ThemeHistoryEntry[] {
  return history.slice(-limit)
}

export function undoLastTheme(): ThemeHistoryEntry | undefined {
  if (history.length < 2) return undefined
  const prev = history[history.length - 2]
  if (prev) {
    applyTheme(prev.config)
    return prev
  }
  return undefined
}

/* ------------------------------------------------------------------ */
/* 导入导出（themeImportExport）                                       */
/* ------------------------------------------------------------------ */

export function exportTheme(config: ThemeConfig): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), config }, null, 2)
}

export function importTheme(json: string): ThemeConfig {
  const parsed = JSON.parse(json) as { config?: ThemeConfig }
  if (!parsed.config) throw new Error('无效的主题文件')
  return parsed.config
}

export function downloadThemeFile(config: ThemeConfig, filename = 'theme.json'): void {
  if (typeof window === 'undefined') return
  const blob = new Blob([exportTheme(config)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------ */
/* 备份（themeBackup）                                                 */
/* ------------------------------------------------------------------ */

const BACKUP_KEY = 'ihui:theme_backups'

export interface ThemeBackup {
  id: string
  name: string
  config: ThemeConfig
  createdAt: number
}

export function createBackup(name: string, config: ThemeConfig): ThemeBackup {
  const backup: ThemeBackup = {
    id: `bk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    config: { ...config },
    createdAt: Date.now(),
  }
  const all = listBackups()
  all.push(backup)
  saveBackups(all)
  return backup
}

export function listBackups(): ThemeBackup[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY)
    return raw ? (JSON.parse(raw) as ThemeBackup[]) : []
  } catch {
    return []
  }
}

export function restoreBackup(id: string): ThemeConfig | undefined {
  const backup = listBackups().find((b) => b.id === id)
  if (!backup) return undefined
  applyTheme(backup.config)
  recordHistory(backup.config, 'preset')
  return backup.config
}

export function deleteBackup(id: string): boolean {
  const all = listBackups()
  const next = all.filter((b) => b.id !== id)
  if (next.length === all.length) return false
  saveBackups(next)
  return true
}

function saveBackups(list: ThemeBackup[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BACKUP_KEY, JSON.stringify(list))
  } catch {
    // 忽略
  }
}

/* ------------------------------------------------------------------ */
/* 定时切换（themeScheduledSwitch）                                    */
/* ------------------------------------------------------------------ */

export interface ScheduledSwitch {
  id: string
  mode: ThemeMode
  /** 24h 制，'HH:MM' */
  time: string
  enabled: boolean
}

const schedules: ScheduledSwitch[] = []
let scheduleTimer: ReturnType<typeof setInterval> | null = null

export function addSchedule(switch_: Omit<ScheduledSwitch, 'id'>): ScheduledSwitch {
  const full: ScheduledSwitch = {
    ...switch_,
    id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  }
  schedules.push(full)
  ensureScheduleTimer()
  return full
}

export function removeSchedule(id: string): boolean {
  const idx = schedules.findIndex((s) => s.id === id)
  if (idx < 0) return false
  schedules.splice(idx, 1)
  return true
}

export function listSchedules(): ScheduledSwitch[] {
  return schedules.slice()
}

function ensureScheduleTimer(): void {
  if (scheduleTimer || typeof window === 'undefined') return
  scheduleTimer = setInterval(() => {
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    for (const s of schedules) {
      if (s.enabled && s.time === hhmm) {
        const root = ROOT()
        if (root) root.dataset.theme = s.mode
      }
    }
  }, 60_000)
}

export function stopSchedules(): void {
  if (scheduleTimer) {
    clearInterval(scheduleTimer)
    scheduleTimer = null
  }
}

/* ------------------------------------------------------------------ */
/* 快捷键（themeShortcut）                                             */
/* ------------------------------------------------------------------ */

export interface ThemeShortcut {
  keys: string
  action: 'toggle_mode' | 'apply_preset' | 'open_settings'
  presetId?: string
}

const shortcuts: ThemeShortcut[] = [
  { keys: 'ctrl+shift+d', action: 'toggle_mode' },
  { keys: 'ctrl+shift+t', action: 'open_settings' },
]

const shortcutHandlers = new Map<string, (s: ThemeShortcut) => void>()

export function registerShortcut(shortcut: ThemeShortcut): void {
  shortcuts.push(shortcut)
}

export function onShortcut(
  action: ThemeShortcut['action'],
  handler: (s: ThemeShortcut) => void,
): void {
  shortcutHandlers.set(action, handler)
}

export function setupShortcutListener(): () => void {
  if (typeof window === 'undefined') return () => {}
  const onKey = (e: KeyboardEvent) => {
    const parts: string[] = []
    if (e.ctrlKey) parts.push('ctrl')
    if (e.shiftKey) parts.push('shift')
    if (e.altKey) parts.push('alt')
    if (e.metaKey) parts.push('meta')
    parts.push(e.key.toLowerCase())
    const combo = parts.join('+')
    const matched = shortcuts.find((s) => s.keys === combo)
    if (matched) {
      e.preventDefault()
      const handler = shortcutHandlers.get(matched.action)
      if (handler) handler(matched)
      else if (matched.action === 'toggle_mode') toggleMode()
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}

/* ------------------------------------------------------------------ */
/* 过渡动画（themeTransition）                                         */
/* ------------------------------------------------------------------ */

export function enableTransition(durationMs = 300): () => void {
  if (typeof document === 'undefined') return () => {}
  const root = ROOT()
  if (!root) return () => {}
  const prevTransition = root.style.transition
  root.style.transition = `background-color ${durationMs}ms, color ${durationMs}ms, border-color ${durationMs}ms`
  return () => {
    root.style.transition = prevTransition
  }
}

/* ------------------------------------------------------------------ */
/* 无障碍（themeAccessibility）                                        */
/* ------------------------------------------------------------------ */

export interface AccessibilityOptions {
  highContrast: boolean
  largeText: boolean
  reduceMotion: boolean
}

export function applyAccessibility(opts: AccessibilityOptions): void {
  const root = ROOT()
  if (!root) return
  root.classList.toggle('a11y-high-contrast', opts.highContrast)
  root.classList.toggle('a11y-large-text', opts.largeText)
  root.classList.toggle('a11y-reduce-motion', opts.reduceMotion)
}

export function detectPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function detectPrefersColorScheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/* ------------------------------------------------------------------ */
/* 性能监控（themePerformance）                                        */
/* ------------------------------------------------------------------ */

export interface ThemePerfMetric {
  applyMs: number
  paintMs: number
  timestamp: number
}

export function measureApplyTheme(config: ThemeConfig): ThemePerfMetric {
  const start = performance.now()
  applyTheme(config)
  const applyMs = performance.now() - start
  let paintMs = 0
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      paintMs = performance.now() - start
    })
  }
  return { applyMs, paintMs, timestamp: Date.now() }
}

/* ------------------------------------------------------------------ */
/* 调试（themeDebug）                                                  */
/* ------------------------------------------------------------------ */

export function dumpCurrentTheme(): Record<string, string> {
  const root = ROOT()
  if (!root) return {}
  const styles = window.getComputedStyle(root)
  const keys = [
    '--primary-color',
    '--accent-color',
    '--font-size',
    '--border-radius',
    '--font-family',
  ]
  const result: Record<string, string> = {}
  for (const k of keys) {
    const v = styles.getPropertyValue(k)
    if (v) result[k] = v
  }
  result['data-theme'] = root.dataset.theme ?? ''
  return result
}

/* ------------------------------------------------------------------ */
/* 云同步 / 离线 / 冲突 / 同步历史                                     */
/* ------------------------------------------------------------------ */

export interface SyncResult {
  ok: boolean
  conflict: boolean
  localConfig: ThemeConfig
  remoteConfig?: ThemeConfig
  resolvedConfig: ThemeConfig
  syncedAt: number
}

export interface SyncHistoryEntry {
  id: string
  result: SyncResult
  timestamp: number
}

const syncHistory: SyncHistoryEntry[] = []

/** 离线队列：本地未同步的变更 */
const offlineQueue: ThemeConfig[] = []

export function enqueueOfflineChange(config: ThemeConfig): void {
  offlineQueue.push(config)
}

export function getOfflineQueue(): ThemeConfig[] {
  return offlineQueue.slice()
}

export function clearOfflineQueue(): void {
  offlineQueue.length = 0
}

/** 简单的冲突解决策略：以最新时间戳为准 */
export function resolveConflict(
  local: ThemeConfig & { updatedAt?: number },
  remote: ThemeConfig & { updatedAt?: number },
): ThemeConfig {
  const lt = local.updatedAt ?? 0
  const rt = remote.updatedAt ?? 0
  return rt > lt ? remote : local
}

export function recordSyncResult(result: SyncResult): SyncHistoryEntry {
  const entry: SyncHistoryEntry = {
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    result,
    timestamp: Date.now(),
  }
  syncHistory.push(entry)
  if (syncHistory.length > 100) syncHistory.shift()
  return entry
}

export function getSyncHistory(limit = 20): SyncHistoryEntry[] {
  return syncHistory.slice(-limit)
}
