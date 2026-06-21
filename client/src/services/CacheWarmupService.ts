import { logger } from '@/utils/logger'

export interface WarmupTask {
  id: string
  name: string
  keys: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  totalKeys: number
  loadedKeys: number
  startTime: number | null
  endTime: number | null
  error?: string
  schedule?: {
    enabled: boolean
    cron?: string
    interval?: number
  }
}

export interface WarmupConfig {
  id: string
  name: string
  description: string
  keys: string[]
  patterns: string[]
  schedule: {
    enabled: boolean
    type: 'interval' | 'cron'
    interval?: number
    cron?: string
  }
  priority: 'low' | 'normal' | 'high'
  enabled: boolean
  lastRun: number | null
  nextRun: number | null
}

export interface WarmupStats {
  totalTasks: number
  completedTasks: number
  failedTasks: number
  totalKeysLoaded: number
  avgLoadTime: number
  lastRunTime: number | null
}

type WarmupEventHandler = (event: { type: string; task: WarmupTask }) => void

class CacheWarmupService {
  private tasks: Map<string, WarmupTask> = new Map()
  private configs: Map<string, WarmupConfig> = new Map()
  private runningTask: WarmupTask | null = null
  private eventHandlers: Set<WarmupEventHandler> = new Set()
  private scheduleTimers: Map<string, ReturnType<typeof setInterval>> = new Map()

  async createConfig(config: Omit<WarmupConfig, 'id' | 'lastRun' | 'nextRun'>): Promise<WarmupConfig> {
    const newConfig: WarmupConfig = {
      ...config,
      id: 'warmup_' + Date.now(),
      lastRun: null,
      nextRun: null
    }
    this.configs.set(newConfig.id, newConfig)
    if (config.schedule.enabled) {
      this.scheduleConfig(newConfig.id)
    }
    return newConfig
  }

  async updateConfig(id: string, updates: Partial<WarmupConfig>): Promise<WarmupConfig | null> {
    const config = this.configs.get(id)
    if (!config) return null
    Object.assign(config, updates)
    if (updates.schedule) {
      this.cancelSchedule(id)
      if (updates.schedule.enabled) {
        this.scheduleConfig(id)
      }
    }
    return config
  }

  async deleteConfig(id: string): Promise<boolean> {
    this.cancelSchedule(id)
    return this.configs.delete(id)
  }

  getConfigs(): WarmupConfig[] {
    return Array.from(this.configs.values())
  }

  getConfig(id: string): WarmupConfig | undefined {
    return this.configs.get(id)
  }

  private scheduleConfig(id: string): void {
    const config = this.configs.get(id)
    if (!config || !config.schedule.enabled) return

    if (config.schedule.type === 'interval' && config.schedule.interval) {
      const timer = setInterval(() => {
        void this.runWarmup(id)
      }, config.schedule.interval * 60 * 1000)
      this.scheduleTimers.set(id, timer)
      config.nextRun = Date.now() + config.schedule.interval * 60 * 1000
    }
  }

  private cancelSchedule(id: string): void {
    const timer = this.scheduleTimers.get(id)
    if (timer) {
      clearInterval(timer)
      this.scheduleTimers.delete(id)
    }
  }

  async runWarmup(configId: string): Promise<WarmupTask> {
    const config = this.configs.get(configId)
    if (!config) {
      throw new Error('Config not found')
    }

    if (this.runningTask) {
      throw new Error('Another warmup task is already running')
    }

    const task: WarmupTask = {
      id: 'task_' + Date.now(),
      name: config.name,
      keys: [...config.keys],
      status: 'running',
      progress: 0,
      totalKeys: config.keys.length,
      loadedKeys: 0,
      startTime: Date.now(),
      endTime: null
    }

    this.tasks.set(task.id, task)
    this.runningTask = task
    this.emitEvent({ type: 'started', task })

    try {
      for (let i = 0; i < config.keys.length; i++) {
        await this.loadKey(config.keys[i])
        task.loadedKeys = i + 1
        task.progress = Math.round((task.loadedKeys / task.totalKeys) * 100)
        this.emitEvent({ type: 'progress', task })
      }

      task.status = 'completed'
      task.endTime = Date.now()
      config.lastRun = task.endTime
      if (config.schedule.enabled && config.schedule.type === 'interval' && config.schedule.interval) {
        config.nextRun = Date.now() + config.schedule.interval * 60 * 1000
      }
      this.emitEvent({ type: 'completed', task })
    } catch (error) {
      task.status = 'failed'
      task.error = String(error)
      task.endTime = Date.now()
      this.emitEvent({ type: 'failed', task })
    } finally {
      this.runningTask = null
    }

    return task
  }

  private async loadKey(key: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 50))
    if (import.meta.env.DEV) logger.warn('[Warmup] Loaded key:', key)
  }

  cancelWarmup(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'running') return false
    task.status = 'failed'
    task.error = 'Cancelled by user'
    task.endTime = Date.now()
    this.runningTask = null
    this.emitEvent({ type: 'cancelled', task })
    return true
  }

  getTasks(): WarmupTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
  }

  getRunningTask(): WarmupTask | null {
    return this.runningTask
  }

  getStats(): WarmupStats {
    const tasks = Array.from(this.tasks.values())
    const completed = tasks.filter(t => t.status === 'completed')
    const totalLoadTime = completed.reduce((sum, t) => sum + ((t.endTime || 0) - (t.startTime || 0)), 0)

    return {
      totalTasks: tasks.length,
      completedTasks: completed.length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
      totalKeysLoaded: completed.reduce((sum, t) => sum + t.loadedKeys, 0),
      avgLoadTime: completed.length > 0 ? totalLoadTime / completed.length : 0,
      lastRunTime: completed.length > 0 ? Math.max(...completed.map(t => t.endTime || 0)) : null
    }
  }

  subscribe(handler: WarmupEventHandler): () => void {
    this.eventHandlers.add(handler)
    return () => this.eventHandlers.delete(handler)
  }

  private emitEvent(event: { type: string; task: WarmupTask }): void {
    this.eventHandlers.forEach(handler => handler(event))
  }

  clearHistory(): void {
    const runningTasks = Array.from(this.tasks.values()).filter(t => t.status === 'running')
    this.tasks.clear()
    runningTasks.forEach(t => this.tasks.set(t.id, t))
  }
}

export const cacheWarmupService = new CacheWarmupService()
