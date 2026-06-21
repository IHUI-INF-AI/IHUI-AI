import { idbStorage } from './idbStorage'
import { logger } from './logger'

export interface SyncHistoryRecord {
  id: string
  timestamp: number
  action: 'upload' | 'download' | 'conflict_resolved'
  status: 'success' | 'failed' | 'cancelled'
  themeMode: string
  deviceId: string
  errorMessage?: string
  duration: number
}

const HISTORY_STORE = 'sync-history'
const LEGACY_STORAGE_KEY = 'theme-sync-history'
const DEFAULT_MAX_RECORDS = 100

class ThemeSyncHistoryService {
  private maxRecords: number = DEFAULT_MAX_RECORDS
  private initialized = false

  async init(): Promise<void> {
    if (this.initialized) return
    
    try {
      await idbStorage.init()
      await this.migrateFromLocalStorage()
      this.initialized = true
    } catch (error) {
      logger.error('Failed to initialize sync history:', error)
    }
  }

  private async migrateFromLocalStorage(): Promise<void> {
    try {
      const saved = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (saved) {
        const legacyData = JSON.parse(saved)
        if (legacyData.records && legacyData.records.length > 0) {
          for (const record of legacyData.records) {
            await idbStorage.addRecord(HISTORY_STORE, record)
          }
          localStorage.removeItem(LEGACY_STORAGE_KEY)
        }
      }
    } catch (error) {
      logger.error('Failed to migrate from localStorage:', error)
    }
  }

  async addRecord(record: Omit<SyncHistoryRecord, 'id' | 'timestamp'>): Promise<SyncHistoryRecord> {
    await this.init()
    
    const newRecord: SyncHistoryRecord = {
      ...record,
      id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }

    try {
      await idbStorage.addRecord(HISTORY_STORE, newRecord)
      await this.trimRecords()
    } catch (error) {
      logger.error('Failed to add sync record:', error)
    }

    return newRecord
  }

  private async trimRecords(): Promise<void> {
    try {
      const count = await idbStorage.getRecordCount(HISTORY_STORE)
      if (count > this.maxRecords) {
        const records = await this.getRecords(count - this.maxRecords + 1)
        for (const record of records.slice(0, count - this.maxRecords)) {
          await idbStorage.deleteRecord(HISTORY_STORE, (record as SyncHistoryRecord).id)
        }
      }
    } catch (error) {
      logger.error('Failed to trim records:', error)
    }
  }

  async getRecords(limit?: number): Promise<SyncHistoryRecord[]> {
    await this.init()
    
    try {
      const records = await idbStorage.getRecords(HISTORY_STORE, limit)
      return records as SyncHistoryRecord[]
    } catch (error) {
      logger.error('Failed to get records:', error)
      return []
    }
  }

  async getRecordById(id: string): Promise<SyncHistoryRecord | undefined> {
    await this.init()
    
    try {
      const record = await idbStorage.getRecordById(HISTORY_STORE, id)
      return record as SyncHistoryRecord | undefined
    } catch (error) {
      console.error('Failed to get record:', error)
      return undefined
    }
  }

  async getRecordsByDate(startDate: Date, endDate: Date): Promise<SyncHistoryRecord[]> {
    const records = await this.getRecords()
    return records.filter(r => {
      const recordDate = new Date(r.timestamp)
      return recordDate >= startDate && recordDate <= endDate
    })
  }

  async getRecordsByStatus(status: SyncHistoryRecord['status']): Promise<SyncHistoryRecord[]> {
    const records = await this.getRecords()
    return records.filter(r => r.status === status)
  }

  async getSuccessCount(): Promise<number> {
    const records = await this.getRecords()
    return records.filter(r => r.status === 'success').length
  }

  async getFailedCount(): Promise<number> {
    const records = await this.getRecords()
    return records.filter(r => r.status === 'failed').length
  }

  async getLastSuccessfulSync(): Promise<SyncHistoryRecord | undefined> {
    const records = await this.getRecords()
    return records.find(r => r.status === 'success')
  }

  async getLastSync(): Promise<SyncHistoryRecord | undefined> {
    const records = await this.getRecords(1)
    return records[0]
  }

  async clearHistory(): Promise<void> {
    await this.init()
    
    try {
      await idbStorage.clearStore(HISTORY_STORE)
    } catch (error) {
      logger.error('Failed to clear history:', error)
    }
  }

  async deleteRecord(id: string): Promise<boolean> {
    await this.init()
    
    try {
      await idbStorage.deleteRecord(HISTORY_STORE, id)
      return true
    } catch (error) {
      logger.error('Failed to delete record:', error)
      return false
    }
  }

  async getStats(): Promise<{
    total: number
    success: number
    failed: number
    cancelled: number
    averageDuration: number
  }> {
    const records = await this.getRecords()
    const success = records.filter(r => r.status === 'success').length
    const failed = records.filter(r => r.status === 'failed').length
    const cancelled = records.filter(r => r.status === 'cancelled').length
    
    const successRecords = records.filter(r => r.status === 'success')
    const totalDuration = successRecords.reduce((sum, r) => sum + r.duration, 0)
    const averageDuration = successRecords.length > 0 
      ? totalDuration / successRecords.length 
      : 0

    return {
      total: records.length,
      success,
      failed,
      cancelled,
      averageDuration
    }
  }

  setMaxRecords(max: number): void {
    this.maxRecords = max
  }

  async exportHistory(): Promise<string> {
    const records = await this.getRecords()
    return JSON.stringify(records, null, 2)
  }

  async exportAsCSV(): Promise<string> {
    const records = await this.getRecords()
    if (records.length === 0) return ''
    
    const headers = ['ID', 'Timestamp', 'Action', 'Status', 'Theme Mode', 'Device ID', 'Duration (ms)', 'Error']
    const rows = records.map(r => [
      r.id,
      new Date(r.timestamp).toISOString(),
      r.action,
      r.status,
      r.themeMode,
      r.deviceId,
      r.duration.toString(),
      r.errorMessage || ''
    ])
    
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  }
}

export const themeSyncHistoryService = new ThemeSyncHistoryService()
