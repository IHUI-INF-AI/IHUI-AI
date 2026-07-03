import type { ThemeMode } from '@/stores/darkMode'
import type { ThemePreset } from './themePreset'
import { syncThemeToCloud as apiSyncToCloud, syncThemeFromCloud as apiSyncFromCloud, type ThemeSyncData } from '@/api/settings'

export interface CloudSyncStatus {
  isSyncing: boolean
  lastSyncedAt: number | null
  error: string | null
  hasLocalChanges: boolean
}

type CloudSyncListener = (status: CloudSyncStatus) => void

const CLOUD_SYNC_KEY = 'theme-cloud-sync'
const LOCAL_CHANGES_KEY = 'theme-local-changes'

class ThemeCloudSyncService {
  private status: CloudSyncStatus = {
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
    hasLocalChanges: false
  }
  private listeners: Set<CloudSyncListener> = new Set()
  private syncInterval: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.loadStatus()
  }

  private loadStatus(): void {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(CLOUD_SYNC_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        this.status.lastSyncedAt = parsed.lastSyncedAt || null
        this.status.hasLocalChanges = localStorage.getItem(LOCAL_CHANGES_KEY) === 'true'
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  private saveStatus(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(CLOUD_SYNC_KEY, JSON.stringify({
        lastSyncedAt: this.status.lastSyncedAt,
        isSyncing: this.status.isSyncing
      }))
    } catch {
      // Ignore storage quota exceeded
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.status })
      } catch {
        // Ignore listener errors
      }
    })
  }

  subscribe(listener: CloudSyncListener): () => void {
    this.listeners.add(listener)
    listener({ ...this.status })
    return () => this.listeners.delete(listener)
  }

  getStatus(): CloudSyncStatus {
    return { ...this.status }
  }

  markLocalChanges(): void {
    this.status.hasLocalChanges = true
    localStorage.setItem(LOCAL_CHANGES_KEY, 'true')
    this.notifyListeners()
  }

  clearLocalChanges(): void {
    this.status.hasLocalChanges = false
    localStorage.removeItem(LOCAL_CHANGES_KEY)
    this.notifyListeners()
  }

  async syncToCloud(_userId: string, themeMode: ThemeMode, presets: ThemePreset[], activePresetId: string | null): Promise<boolean> {
    if (this.status.isSyncing) return false

    this.status.isSyncing = true
    this.status.error = null
    this.notifyListeners()

    try {
      const deviceId = this.getDeviceId()
      const data: ThemeSyncData = {
        themeMode,
        presets: presets.filter(p => !p.isDefault).map(p => ({
          id: p.id,
          name: p.name,
          mode: p.mode,
          customColors: p.customColors,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        })),
        activePresetId,
        updatedAt: Date.now(),
        deviceId
      }

      const response = await apiSyncToCloud(data)
      
      if (response.code === 0) {
        this.status.lastSyncedAt = response.data?.syncedAt || Date.now()
        this.status.hasLocalChanges = false
        this.clearLocalChanges()
        this.saveStatus()
        return true
      } else {
        throw new Error(response.message || 'Sync failed')
      }
    } catch (error) {
      this.status.error = String(error)
      return false
    } finally {
      this.status.isSyncing = false
      this.notifyListeners()
    }
  }

  async syncFromCloud(_userId: string): Promise<ThemeSyncData | null> {
    if (this.status.isSyncing) return null

    this.status.isSyncing = true
    this.status.error = null
    this.notifyListeners()

    try {
      const response = await apiSyncFromCloud()
      
      if (response.code === 0 && response.data) {
        this.status.lastSyncedAt = Date.now()
        this.saveStatus()
        return response.data
      } else {
        throw new Error(response.message || 'Sync failed')
      }
    } catch (error) {
      this.status.error = String(error)
      return null
    } finally {
      this.status.isSyncing = false
      this.notifyListeners()
    }
  }

  private getDeviceId(): string {
    let deviceId = localStorage.getItem('theme-device-id')
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      localStorage.setItem('theme-device-id', deviceId)
    }
    return deviceId
  }

  startAutoSync(userId: string, intervalMs: number = 60000): void {
    this.stopAutoSync()
    this.syncInterval = setInterval(() => {
      if (this.status.hasLocalChanges) {
        void this.syncToCloud(userId, 'light', [], null)
      }
    }, intervalMs)
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  clearSyncData(): void {
    this.status = {
      isSyncing: false,
      lastSyncedAt: null,
      error: null,
      hasLocalChanges: false
    }
    localStorage.removeItem(CLOUD_SYNC_KEY)
    localStorage.removeItem(LOCAL_CHANGES_KEY)
    this.notifyListeners()
  }
}

export const themeCloudSync = new ThemeCloudSyncService()
