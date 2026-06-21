import type { ThemeMode } from '@/stores/darkMode'

export interface SyncConflictData {
  localData: {
    themeMode: ThemeMode
    updatedAt: number
    deviceId: string
  }
  cloudData: {
    themeMode: ThemeMode
    updatedAt: number
    deviceId: string
  }
}

export type ConflictResolution = 'local' | 'cloud' | 'merge'

export interface ConflictResult {
  hasConflict: boolean
  resolution: ConflictResolution | null
  resolvedData: {
    themeMode: ThemeMode
  } | null
}

const CONFLICT_THRESHOLD_MS = 60000

class ThemeSyncConflictService {
  detectConflict(
    localUpdatedAt: number,
    cloudUpdatedAt: number,
    localDeviceId: string,
    cloudDeviceId: string
  ): boolean {
    if (localDeviceId === cloudDeviceId) {
      return false
    }
    
    const timeDiff = Math.abs(localUpdatedAt - cloudUpdatedAt)
    return timeDiff < CONFLICT_THRESHOLD_MS
  }

  resolveConflict(
    localData: SyncConflictData['localData'],
    cloudData: SyncConflictData['cloudData'],
    resolution: ConflictResolution
  ): { themeMode: ThemeMode } {
    switch (resolution) {
      case 'local':
        return { themeMode: localData.themeMode }
      case 'cloud':
        return { themeMode: cloudData.themeMode }
      case 'merge':
        return this.mergeData(localData, cloudData)
      default:
        return { themeMode: cloudData.themeMode }
    }
  }

  private mergeData(
    localData: SyncConflictData['localData'],
    cloudData: SyncConflictData['cloudData']
  ): { themeMode: ThemeMode } {
    if (localData.updatedAt > cloudData.updatedAt) {
      return { themeMode: localData.themeMode }
    }
    return { themeMode: cloudData.themeMode }
  }

  getAutoResolution(
    localData: SyncConflictData['localData'],
    cloudData: SyncConflictData['cloudData']
  ): ConflictResolution {
    if (localData.updatedAt > cloudData.updatedAt) {
      return 'local'
    }
    return 'cloud'
  }

  shouldPromptUser(
    localData: SyncConflictData['localData'],
    cloudData: SyncConflictData['cloudData']
  ): boolean {
    const timeDiff = Math.abs(localData.updatedAt - cloudData.updatedAt)
    return timeDiff < CONFLICT_THRESHOLD_MS && 
           localData.deviceId !== cloudData.deviceId
  }
}

export const themeSyncConflictService = new ThemeSyncConflictService()
