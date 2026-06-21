import { StorageManager } from '@/utils/storage'
import { tourVersionControl, type TourVersionData } from './tourVersionControl'

export interface BackupRecord {
  id: string
  tourId: string
  type: 'auto' | 'manual' | 'pre_update' | 'pre_delete'
  timestamp: number
  data: TourVersionData
  reason: string
  size: number
  verified: boolean
}

export interface RollbackResult {
  success: boolean
  backupId: string
  restoredData: TourVersionData | null
  timestamp: number
  error?: string
}

export interface RollbackPoint {
  id: string
  tourId: string
  description: string
  createdAt: number
  data: TourVersionData
  canRollback: boolean
}

export interface RollbackConfig {
  autoBackupEnabled: boolean
  maxBackups: number
  backupInterval: number
  verifyOnRestore: boolean
  keepPublishedVersions: boolean
}

const BACKUPS_KEY = 'tour_backups'
const ROLLBACK_POINTS_KEY = 'tour_rollback_points'
const CONFIG_KEY = 'tour_rollback_config'

const DEFAULT_CONFIG: RollbackConfig = {
  autoBackupEnabled: true,
  maxBackups: 20,
  backupInterval: 60 * 60 * 1000,
  verifyOnRestore: true,
  keepPublishedVersions: true,
}

class TourRollbackService {
  private backups: Map<string, BackupRecord> = new Map()
  private rollbackPoints: Map<string, RollbackPoint> = new Map()
  private config: RollbackConfig
  private autoBackupTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.config = this.loadConfig()
    this.load()
    if (this.config.autoBackupEnabled) {
      this.startAutoBackup()
    }
  }

  private load(): void {
    const backups = StorageManager.getItem<Record<string, BackupRecord>>(BACKUPS_KEY)
    if (backups) {
      Object.entries(backups).forEach(([id, backup]) => {
        this.backups.set(id, backup)
      })
    }

    const points = StorageManager.getItem<Record<string, RollbackPoint>>(ROLLBACK_POINTS_KEY)
    if (points) {
      Object.entries(points).forEach(([id, point]) => {
        this.rollbackPoints.set(id, point)
      })
    }
  }

  private save(): void {
    const backupsObj: Record<string, BackupRecord> = {}
    this.backups.forEach((backup, id) => {
      backupsObj[id] = backup
    })
    StorageManager.setItem(BACKUPS_KEY, backupsObj)

    const pointsObj: Record<string, RollbackPoint> = {}
    this.rollbackPoints.forEach((point, id) => {
      pointsObj[id] = point
    })
    StorageManager.setItem(ROLLBACK_POINTS_KEY, pointsObj)
  }

  private loadConfig(): RollbackConfig {
    const stored = StorageManager.getItem<RollbackConfig>(CONFIG_KEY)
    return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG
  }

  private saveConfig(): void {
    StorageManager.setItem(CONFIG_KEY, this.config)
  }

  createBackup(
    tourId: string,
    data: TourVersionData,
    type: BackupRecord['type'] = 'manual',
    reason: string = ''
  ): BackupRecord {
    this.cleanupOldBackups(tourId)

    const backup: BackupRecord = {
      id: `backup-${Date.now()}`,
      tourId,
      type,
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(data)),
      reason,
      size: JSON.stringify(data).length,
      verified: false,
    }

    this.backups.set(backup.id, backup)
    this.save()
    return backup
  }

  private cleanupOldBackups(tourId: string): void {
    const tourBackups = this.getBackups(tourId)
    
    if (tourBackups.length >= this.config.maxBackups) {
      const toRemove = tourBackups
        .filter(b => b.type !== 'pre_delete' || !this.config.keepPublishedVersions)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, tourBackups.length - this.config.maxBackups + 1)

      toRemove.forEach(backup => {
        this.backups.delete(backup.id)
      })
    }
  }

  getBackups(tourId: string): BackupRecord[] {
    return Array.from(this.backups.values())
      .filter(b => b.tourId === tourId)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  getBackup(backupId: string): BackupRecord | undefined {
    return this.backups.get(backupId)
  }

  deleteBackup(backupId: string): boolean {
    if (this.backups.has(backupId)) {
      this.backups.delete(backupId)
      this.save()
      return true
    }
    return false
  }

  async rollback(backupId: string): Promise<RollbackResult> {
    const backup = this.backups.get(backupId)
    
    if (!backup) {
      return {
        success: false,
        backupId,
        restoredData: null,
        timestamp: Date.now(),
        error: 'Backup not found',
      }
    }

    if (this.config.verifyOnRestore) {
      const verification = this.verifyBackup(backup)
      if (!verification.valid) {
        return {
          success: false,
          backupId,
          restoredData: null,
          timestamp: Date.now(),
          error: `Verification failed: ${verification.error}`,
        }
      }
    }

    const restoredData = JSON.parse(JSON.stringify(backup.data))

    return {
      success: true,
      backupId,
      restoredData,
      timestamp: Date.now(),
    }
  }

  quickRollback(tourId: string): RollbackResult {
    const backups = this.getBackups(tourId)
    if (backups.length === 0) {
      return {
        success: false,
        backupId: '',
        restoredData: null,
        timestamp: Date.now(),
        error: 'No backups available',
      }
    }

    const latestBackup = backups[0]
    return this.rollback(latestBackup.id) as unknown as RollbackResult
  }

  createRollbackPoint(
    tourId: string,
    description: string,
    data: TourVersionData
  ): RollbackPoint {
    const point: RollbackPoint = {
      id: `point-${Date.now()}`,
      tourId,
      description,
      createdAt: Date.now(),
      data: JSON.parse(JSON.stringify(data)),
      canRollback: true,
    }

    this.rollbackPoints.set(point.id, point)
    this.save()
    return point
  }

  getRollbackPoints(tourId: string): RollbackPoint[] {
    return Array.from(this.rollbackPoints.values())
      .filter(p => p.tourId === tourId)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  rollbackToPoint(pointId: string): RollbackResult {
    const point = this.rollbackPoints.get(pointId)
    
    if (!point || !point.canRollback) {
      return {
        success: false,
        backupId: pointId,
        restoredData: null,
        timestamp: Date.now(),
        error: 'Rollback point not available',
      }
    }

    const restoredData = JSON.parse(JSON.stringify(point.data))

    return {
      success: true,
      backupId: pointId,
      restoredData,
      timestamp: Date.now(),
    }
  }

  deleteRollbackPoint(pointId: string): boolean {
    if (this.rollbackPoints.has(pointId)) {
      this.rollbackPoints.delete(pointId)
      this.save()
      return true
    }
    return false
  }

  verifyBackup(backup: BackupRecord): { valid: boolean; error?: string } {
    if (!backup.data) {
      return { valid: false, error: 'No data in backup' }
    }

    if (!backup.data.steps || !Array.isArray(backup.data.steps)) {
      return { valid: false, error: 'Invalid steps data' }
    }

    for (const step of backup.data.steps) {
      if (!step.id || !step.title) {
        return { valid: false, error: 'Invalid step structure' }
      }
    }

    backup.verified = true
    this.save()
    return { valid: true }
  }

  private startAutoBackup(): void {
    if (this.autoBackupTimer) return

    this.autoBackupTimer = setInterval(() => {
      this.performAutoBackup()
    }, this.config.backupInterval)
  }

  private stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer)
      this.autoBackupTimer = null
    }
  }

  private performAutoBackup(): void {
    const tourIds = this.getActiveTourIds()
    tourIds.forEach(tourId => {
      const currentVersion = tourVersionControl.getCurrentVersion(tourId)
      if (currentVersion) {
        this.createBackup(tourId, currentVersion.data, 'auto', 'Automatic backup')
      }
    })
  }

  private getActiveTourIds(): string[] {
    const tourIds = new Set<string>()
    this.backups.forEach(backup => tourIds.add(backup.tourId))
    this.rollbackPoints.forEach(point => tourIds.add(point.tourId))
    return Array.from(tourIds)
  }

  setConfig(updates: Partial<RollbackConfig>): void {
    this.config = { ...this.config, ...updates }
    this.saveConfig()

    if (updates.autoBackupEnabled !== undefined) {
      if (updates.autoBackupEnabled) {
        this.startAutoBackup()
      } else {
        this.stopAutoBackup()
      }
    }
  }

  getConfig(): RollbackConfig {
    return { ...this.config }
  }

  getStorageUsage(): {
    totalBackups: number
    totalSize: number
    byTour: Record<string, { count: number; size: number }>
  } {
    let totalSize = 0
    const byTour: Record<string, { count: number; size: number }> = {}

    this.backups.forEach(backup => {
      totalSize += backup.size
      if (!byTour[backup.tourId]) {
        byTour[backup.tourId] = { count: 0, size: 0 }
      }
      byTour[backup.tourId].count++
      byTour[backup.tourId].size += backup.size
    })

    return {
      totalBackups: this.backups.size,
      totalSize,
      byTour,
    }
  }

  exportBackup(backupId: string): string {
    const backup = this.backups.get(backupId)
    if (!backup) return '{}'
    return JSON.stringify(backup, null, 2)
  }

  importBackup(json: string): BackupRecord | null {
    try {
      const data = JSON.parse(json)
      const backup: BackupRecord = {
        ...data,
        id: `backup-${Date.now()}`,
        timestamp: Date.now(),
        verified: false,
      }
      this.backups.set(backup.id, backup)
      this.save()
      return backup
    } catch {
      return null
    }
  }

  clearAllBackups(tourId?: string): void {
    if (tourId) {
      const toRemove = Array.from(this.backups.values())
        .filter(b => b.tourId === tourId)
        .map(b => b.id)
      toRemove.forEach(id => this.backups.delete(id))
    } else {
      this.backups.clear()
    }
    this.save()
  }

  destroy(): void {
    this.stopAutoBackup()
  }
}

export const tourRollbackService = new TourRollbackService()
