import { useDarkModeStore, type ThemeMode } from '@/stores/darkMode'
import { logger } from '@/utils/logger'

export interface ThemeBackup {
  id: string
  timestamp: number
  name: string
  data: ThemeBackupData
  auto?: boolean
}

export interface ThemeBackupData {
  themeMode: ThemeMode
  presets: any[]
  schedules: any[]
  shortcuts: any[]
  transition: any
  customVariables: Record<string, string>
}

export interface ThemeBackupConfig {
  enabled: boolean
  interval: number
  maxBackups: number
  includePresets: boolean
  includeSchedules: boolean
  includeShortcuts: boolean
  includeTransition: boolean
}

type BackupChangeHandler = (backups: ThemeBackup[]) => void

const STORAGE_KEY = 'theme-backups'
const CONFIG_KEY = 'theme-backup-config'
const LAST_BACKUP_KEY = 'theme-last-backup-time'

const DEFAULT_CONFIG: ThemeBackupConfig = {
  enabled: true,
  interval: 24 * 60 * 60 * 1000,
  maxBackups: 10,
  includePresets: true,
  includeSchedules: true,
  includeShortcuts: true,
  includeTransition: true
}

class ThemeBackupManager {
  private backups: ThemeBackup[] = []
  private config: ThemeBackupConfig
  private lastBackupTime: number = 0
  private intervalId: ReturnType<typeof setInterval> | null = null
  private handlers: BackupChangeHandler[] = []

  constructor() {
    this.config = this.loadConfig()
    this.backups = this.loadBackups()
    this.lastBackupTime = this.loadLastBackupTime()
  }

  private loadConfig(): ThemeBackupConfig {
    if (typeof window === 'undefined') return { ...DEFAULT_CONFIG }
    try {
      const stored = localStorage.getItem(CONFIG_KEY)
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) }
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_CONFIG }
  }

  private saveConfig(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config))
    } catch {
      // ignore
    }
  }

  private loadBackups(): ThemeBackup[] {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch {
      // ignore
    }
    return []
  }

  private saveBackups(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.backups))
      this.notifyHandlers()
    } catch {
      this.backups = this.backups.slice(-this.config.maxBackups / 2)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.backups))
      } catch {
        // ignore
      }
    }
  }

  private loadLastBackupTime(): number {
    if (typeof window === 'undefined') return 0
    try {
      const stored = localStorage.getItem(LAST_BACKUP_KEY)
      if (stored) {
        return parseInt(stored, 10)
      }
    } catch {
      // ignore
    }
    return 0
  }

  private saveLastBackupTime(): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(LAST_BACKUP_KEY, Date.now().toString())
    } catch {
      // ignore
    }
  }

  private notifyHandlers(): void {
    this.handlers.forEach(handler => handler([...this.backups]))
  }

  private collectBackupData(): ThemeBackupData {
    const data: ThemeBackupData = {
      themeMode: 'light',
      presets: [],
      schedules: [],
      shortcuts: [],
      transition: null,
      customVariables: {}
    }

    try {
      const store = useDarkModeStore()
      data.themeMode = store.themeMode
    } catch {
      // store not available
    }

    if (this.config.includePresets) {
      try {
        const presets = localStorage.getItem('theme-presets')
        if (presets) data.presets = JSON.parse(presets)
      } catch {
        // ignore
      }
    }

    if (this.config.includeSchedules) {
      try {
        const schedules = localStorage.getItem('theme-schedules')
        if (schedules) data.schedules = JSON.parse(schedules)
      } catch {
        // ignore
      }
    }

    if (this.config.includeShortcuts) {
      try {
        const shortcuts = localStorage.getItem('theme-shortcuts-config')
        if (shortcuts) data.shortcuts = JSON.parse(shortcuts)
      } catch {
        // ignore
      }
    }

    if (this.config.includeTransition) {
      try {
        const transition = localStorage.getItem('theme-transition-config')
        if (transition) data.transition = JSON.parse(transition)
      } catch {
        // ignore
      }
    }

    return data
  }

  private cleanupOldBackups(): void {
    if (this.backups.length > this.config.maxBackups) {
      const autoBackups = this.backups.filter(b => b.auto)
      const manualBackups = this.backups.filter(b => !b.auto)

      while (autoBackups.length > this.config.maxBackups - manualBackups.length) {
        const oldest = autoBackups.shift()
        if (oldest) {
          const index = this.backups.findIndex(b => b.id === oldest.id)
          if (index > -1) {
            this.backups.splice(index, 1)
          }
        }
      }
    }
  }

  createBackup(name?: string, auto: boolean = false): ThemeBackup {
    const backup: ThemeBackup = {
      id: `backup-${Date.now()}`,
      timestamp: Date.now(),
      name: name || (auto ? '自动备份' : '手动备份'),
      data: this.collectBackupData(),
      auto
    }

    this.backups.push(backup)
    this.cleanupOldBackups()
    this.saveBackups()
    this.lastBackupTime = Date.now()
    this.saveLastBackupTime()

    logger.info(`[ThemeBackup] Created backup: ${backup.id}`)
    return backup
  }

  restoreBackup(backupId: string): boolean {
    const backup = this.backups.find(b => b.id === backupId)
    if (!backup) return false

    try {
      const store = useDarkModeStore()
      store.setThemeMode(backup.data.themeMode, 'backup', true)
    } catch {
      // store not available
    }

    if (backup.data.presets && Array.isArray(backup.data.presets)) {
      try {
        localStorage.setItem('theme-presets', JSON.stringify(backup.data.presets))
      } catch {
        // ignore
      }
    }

    if (backup.data.schedules && Array.isArray(backup.data.schedules)) {
      try {
        localStorage.setItem('theme-schedules', JSON.stringify(backup.data.schedules))
      } catch {
        // ignore
      }
    }

    if (backup.data.shortcuts) {
      try {
        localStorage.setItem('theme-shortcuts-config', JSON.stringify(backup.data.shortcuts))
      } catch {
        // ignore
      }
    }

    if (backup.data.transition) {
      try {
        localStorage.setItem('theme-transition-config', JSON.stringify(backup.data.transition))
      } catch {
        // ignore
      }
    }

    logger.info(`[ThemeBackup] Restored backup: ${backupId}`)
    return true
  }

  deleteBackup(backupId: string): boolean {
    const index = this.backups.findIndex(b => b.id === backupId)
    if (index === -1) return false

    this.backups.splice(index, 1)
    this.saveBackups()
    logger.info(`[ThemeBackup] Deleted backup: ${backupId}`)
    return true
  }

  getBackups(): ThemeBackup[] {
    return [...this.backups].sort((a, b) => b.timestamp - a.timestamp)
  }

  getBackup(backupId: string): ThemeBackup | undefined {
    return this.backups.find(b => b.id === backupId)
  }

  getConfig(): ThemeBackupConfig {
    return { ...this.config }
  }

  setConfig(config: Partial<ThemeBackupConfig>): void {
    this.config = { ...this.config, ...config }
    this.saveConfig()

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.config.enabled) {
      this.startAutoBackup()
    }
  }

  startAutoBackup(): void {
    if (typeof window === 'undefined') return
    if (this.intervalId) return

    const timeSinceLastBackup = Date.now() - this.lastBackupTime
    if (timeSinceLastBackup >= this.config.interval) {
      this.createBackup(undefined, true)
    }

    this.intervalId = setInterval(() => {
      if (this.config.enabled) {
        this.createBackup(undefined, true)
      }
    }, this.config.interval)

    logger.info(`[ThemeBackup] Auto backup started, interval: ${this.config.interval}ms`)
  }

  stopAutoBackup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      logger.info('[ThemeBackup] Auto backup stopped')
    }
  }

  shouldBackup(): boolean {
    if (!this.config.enabled) return false
    return Date.now() - this.lastBackupTime >= this.config.interval
  }

  getLastBackupTime(): number {
    return this.lastBackupTime
  }

  getNextBackupTime(): number | null {
    if (!this.config.enabled) return null
    return this.lastBackupTime + this.config.interval
  }

  exportBackup(backupId: string): string | null {
    const backup = this.getBackup(backupId)
    if (!backup) return null

    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      backup
    }, null, 2)
  }

  importBackup(jsonString: string): ThemeBackup | null {
    try {
      const parsed = JSON.parse(jsonString)
      if (!parsed.backup) return null

      const backup: ThemeBackup = {
        ...parsed.backup,
        id: `imported-${Date.now()}`,
        timestamp: Date.now(),
        auto: false
      }

      this.backups.push(backup)
      this.cleanupOldBackups()
      this.saveBackups()

      logger.info(`[ThemeBackup] Imported backup: ${backup.id}`)
      return backup
    } catch {
      logger.error('[ThemeBackup] Failed to import backup')
      return null
    }
  }

  clearAllBackups(): void {
    this.backups = []
    this.saveBackups()
    logger.info('[ThemeBackup] All backups cleared')
  }

  onChange(handler: BackupChangeHandler): () => void {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }

  getStorageSize(): number {
    if (typeof window === 'undefined') return 0
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? new Blob([stored]).size : 0
    } catch {
      return 0
    }
  }
}

export const themeBackupManager = new ThemeBackupManager()
