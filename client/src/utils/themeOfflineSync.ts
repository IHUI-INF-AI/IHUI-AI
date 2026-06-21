import type { ThemeMode } from '@/stores/darkMode'
import { logger } from './logger'

export interface OfflineSyncTask {
  id: string
  userId: string
  themeMode: ThemeMode
  createdAt: number
  retryCount: number
  status: 'pending' | 'syncing' | 'failed' | 'completed'
}

interface OfflineSyncQueue {
  tasks: OfflineSyncTask[]
  lastProcessedAt: number | null
}

const QUEUE_STORAGE_KEY = 'theme-offline-sync-queue'
const MAX_RETRY_COUNT = 3
const RETRY_DELAY_MS = 5000

class ThemeOfflineSyncService {
  private queue: OfflineSyncQueue
  private isProcessing = false
  private onOnlineCallback: (() => void) | null = null

  constructor() {
    this.queue = this.loadQueue()
    this.setupNetworkListeners()
  }

  private loadQueue(): OfflineSyncQueue {
    try {
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {
      console.error('Failed to load offline sync queue')
    }
    return { tasks: [], lastProcessedAt: null }
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue))
    } catch {
      logger.error('Failed to save offline sync queue')
    }
  }

  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.processQueue()
      })

      this.onOnlineCallback = () => this.processQueue()
    }
  }

  addTask(userId: string, themeMode: ThemeMode): OfflineSyncTask {
    const task: OfflineSyncTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      themeMode,
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending'
    }

    const existingPending = this.queue.tasks.find(
      t => t.userId === userId && t.status === 'pending'
    )

    if (existingPending) {
      existingPending.themeMode = themeMode
      existingPending.createdAt = Date.now()
      this.saveQueue()
      return existingPending
    }

    this.queue.tasks.push(task)
    this.saveQueue()

    if (navigator.onLine) {
      void this.processQueue()
    }

    return task
  }

  removeTask(taskId: string): void {
    this.queue.tasks = this.queue.tasks.filter(t => t.id !== taskId)
    this.saveQueue()
  }

  clearCompletedTasks(): void {
    this.queue.tasks = this.queue.tasks.filter(t => t.status !== 'completed')
    this.saveQueue()
  }

  getPendingTasks(): OfflineSyncTask[] {
    return this.queue.tasks.filter(t => t.status === 'pending')
  }

  getFailedTasks(): OfflineSyncTask[] {
    return this.queue.tasks.filter(t => t.status === 'failed')
  }

  getAllTasks(): OfflineSyncTask[] {
    return [...this.queue.tasks]
  }

  getQueueLength(): number {
    return this.queue.tasks.filter(t => t.status === 'pending' || t.status === 'failed').length
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) {
      return
    }

    this.isProcessing = true

    const pendingTasks = [
      ...this.queue.tasks.filter(t => t.status === 'pending'),
      ...this.queue.tasks.filter(t => t.status === 'failed' && t.retryCount < MAX_RETRY_COUNT)
    ]

    for (const task of pendingTasks) {
      try {
        task.status = 'syncing'
        this.saveQueue()

        const { themeCloudSync } = await import('./themeCloudSync')
        const success = await themeCloudSync.syncToCloud(
          task.userId,
          task.themeMode,
          [],
          null
        )

        if (success) {
          task.status = 'completed'
          this.queue.lastProcessedAt = Date.now()
        } else {
          throw new Error('Sync failed')
        }
      } catch {
        task.retryCount++
        task.status = task.retryCount >= MAX_RETRY_COUNT ? 'failed' : 'pending'
      }

      this.saveQueue()

      if (task.status === 'pending') {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }

    this.isProcessing = false
  }

  retryFailedTasks(): void {
    const failedTasks = this.queue.tasks.filter(t => t.status === 'failed')
    
    failedTasks.forEach(task => {
      task.retryCount = 0
      task.status = 'pending'
    })

    this.saveQueue()

    if (navigator.onLine) {
      void this.processQueue()
    }
  }

  isOfflineMode(): boolean {
    return !navigator.onLine
  }

  hasPendingTasks(): boolean {
    return this.getQueueLength() > 0
  }

  destroy(): void {
    if (this.onOnlineCallback) {
      window.removeEventListener('online', this.onOnlineCallback)
    }
  }
}

export const themeOfflineSyncService = new ThemeOfflineSyncService()
