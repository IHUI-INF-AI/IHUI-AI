/**
 * 生成队列服务
 *
 * 统一管理 AI 生成任务（图片、视频、3D 模型等），提供：
 * - 并发控制（maxConcurrent）
 * - 任务间隔（delayBetweenTasks）
 * - 自动重试（autoRetryOnFailure / maxRetries）
 * - 进度持久化（saveProgress）
 * - 事件订阅
 *
 * 纯 TypeScript 实现，无框架依赖。
 *
 * @module services/generation-queue-service
 */

// ============================================================================
// 类型定义
// ============================================================================

export type GenerationType = 'image' | 'video' | 'audio' | 'music' | '3d' | 'text' | 'code'

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type Priority = 'urgent' | 'high' | 'normal' | 'low'

export interface GenerationTask {
  id: string
  type: GenerationType
  model: string
  prompt: string
  params: Record<string, unknown>
  priority: Priority
  status: TaskStatus
  progress: number
  error?: string
  result?: { url: string; metadata?: Record<string, unknown> }
  retryCount: number
  createdAt: string
  startedAt?: string
  completedAt?: string
}

/** 入队任务输入（id / status / progress / retryCount / createdAt 由队列内部管理） */
export type TaskInput = Omit<
  GenerationTask,
  'id' | 'status' | 'progress' | 'retryCount' | 'createdAt' | 'priority'
> & { priority?: Priority }

export type ProgressCallback = (progress: number, message?: string) => void

export type TaskHandler = (
  task: GenerationTask,
  onProgress: ProgressCallback,
) => Promise<{ url?: string; metadata?: Record<string, unknown> } | undefined>

export interface QueueConfig {
  /** 最大并发数 */
  maxConcurrent: number
  /** 任务间隔（毫秒） */
  delayBetweenTasks: number
  /** 失败自动重试 */
  autoRetryOnFailure: boolean
  /** 最大重试次数 */
  maxRetries: number
  /** 进度保存到 localStorage */
  saveProgress: boolean
}

export interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  total: number
}

export type QueueEvent =
  | 'task:added'
  | 'task:started'
  | 'task:progress'
  | 'task:completed'
  | 'task:failed'
  | 'task:cancelled'
  | 'queue:empty'

type EventListener = (task: GenerationTask, data?: unknown) => void

// ============================================================================
// 默认配置 & 常量
// ============================================================================

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 2,
  delayBetweenTasks: 1000,
  autoRetryOnFailure: true,
  maxRetries: 3,
  saveProgress: true,
}

const PRIORITY_WEIGHTS: Record<Priority, number> = {
  urgent: 100,
  high: 75,
  normal: 50,
  low: 25,
}

const STORAGE_KEY = 'ihui-generation-queue'

// ============================================================================
// 生成队列类
// ============================================================================

/**
 * 生成队列服务
 *
 * 管理任务生命周期：入队 → 按优先级排序 → 并发处理 → 重试/完成 → 进度持久化
 */
export class GenerationQueue {
  private queue: GenerationTask[] = []
  private processing: Map<string, GenerationTask> = new Map()
  private completed: GenerationTask[] = []
  private failed: GenerationTask[] = []

  private config: QueueConfig
  private isRunning = false
  private isPaused = false
  private processTimer: ReturnType<typeof setTimeout> | null = null

  private handlers: Map<GenerationType, TaskHandler> = new Map()
  private listeners: Map<QueueEvent, Set<EventListener>> = new Map()

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ==========================================================================
  // 任务管理
  // ==========================================================================

  /** 入队任务（按优先级插入） */
  enqueue(task: TaskInput): string {
    const id = this.generateId()
    const newTask: GenerationTask = {
      ...task,
      id,
      priority: task.priority ?? 'normal',
      status: 'pending',
      progress: 0,
      retryCount: 0,
      createdAt: new Date().toISOString(),
    }
    this.insertByPriority(newTask)
    this.emit('task:added', newTask)
    if (!this.isRunning && !this.isPaused) {
      this.start()
    }
    return id
  }

  /** 出队下一个任务（仅取出，不处理） */
  dequeue(): GenerationTask | undefined {
    return this.queue.shift()
  }

  /** 取消任务 */
  cancel(taskId: string): boolean {
    const idx = this.queue.findIndex((t) => t.id === taskId)
    if (idx >= 0) {
      const task = this.queue.splice(idx, 1)[0]
      if (task) {
        task.status = 'cancelled'
        this.emit('task:cancelled', task)
      }
      return true
    }
    return false
  }

  /** 获取任务 */
  getTask(taskId: string): GenerationTask | undefined {
    return (
      this.queue.find((t) => t.id === taskId) ??
      this.processing.get(taskId) ??
      this.completed.find((t) => t.id === taskId) ??
      this.failed.find((t) => t.id === taskId)
    )
  }

  // ==========================================================================
  // 队列控制
  // ==========================================================================

  /** 开始处理队列 */
  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.isPaused = false
    this.processNext()
  }

  /** 暂停队列 */
  pause(): void {
    this.isPaused = true
  }

  /** 恢复队列 */
  resume(): void {
    if (!this.isPaused) return
    this.isPaused = false
    this.processNext()
  }

  /** 停止队列 */
  stop(): void {
    this.isRunning = false
    this.isPaused = false
    if (this.processTimer) {
      clearTimeout(this.processTimer)
      this.processTimer = null
    }
  }

  /** 清空待处理队列 */
  clear(): void {
    this.queue.forEach((t) => {
      t.status = 'cancelled'
      this.emit('task:cancelled', t)
    })
    this.queue = []
  }

  // ==========================================================================
  // 处理器注册
  // ==========================================================================

  /** 注册任务处理器 */
  registerHandler(type: GenerationType, handler: TaskHandler): void {
    this.handlers.set(type, handler)
  }

  /** 移除任务处理器 */
  removeHandler(type: GenerationType): void {
    this.handlers.delete(type)
  }

  // ==========================================================================
  // 事件
  // ==========================================================================

  /** 订阅事件，返回取消订阅函数 */
  on(event: QueueEvent, listener: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    return () => {
      this.listeners.get(event)?.delete(listener)
    }
  }

  /** 取消订阅 */
  off(event: QueueEvent, listener: EventListener): void {
    this.listeners.get(event)?.delete(listener)
  }

  // ==========================================================================
  // 统计
  // ==========================================================================

  getStats(): QueueStats {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.length,
      failed: this.failed.length,
      total: this.queue.length + this.processing.size + this.completed.length + this.failed.length,
    }
  }

  getPendingTasks(): GenerationTask[] {
    return [...this.queue]
  }

  getProcessingTasks(): GenerationTask[] {
    return Array.from(this.processing.values())
  }

  // ==========================================================================
  // 进度持久化
  // ==========================================================================

  /** 保存进度到 localStorage */
  saveProgress(): void {
    if (!this.config.saveProgress) return
    try {
      const state = {
        queue: this.queue,
        failed: this.failed,
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // localStorage 不可用或配额已满，静默忽略
    }
  }

  /** 恢复进度 */
  restoreProgress(): boolean {
    if (!this.config.saveProgress) return false
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return false
      const state = JSON.parse(saved) as {
        queue: GenerationTask[]
        failed: GenerationTask[]
      }
      state.queue?.forEach((task) => {
        if (task.status === 'pending' || task.status === 'processing') {
          task.status = 'pending'
          task.progress = 0
          this.queue.push(task)
        }
      })
      state.failed?.forEach((task) => {
        this.failed.push(task)
      })
      return this.queue.length > 0
    } catch {
      return false
    }
  }

  // ==========================================================================
  // 内部方法
  // ==========================================================================

  private generateId(): string {
    return `gen-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  private insertByPriority(task: GenerationTask): void {
    const weight = PRIORITY_WEIGHTS[task.priority]
    const idx = this.queue.findIndex((t) => PRIORITY_WEIGHTS[t.priority] < weight)
    if (idx === -1) {
      this.queue.push(task)
    } else {
      this.queue.splice(idx, 0, task)
    }
  }

  /** 处理下一个任务 */
  processNext(): void {
    if (!this.isRunning || this.isPaused) return
    if (this.processing.size >= this.config.maxConcurrent) return

    const task = this.queue.shift()
    if (!task) {
      if (this.processing.size === 0) {
        this.emit('queue:empty', {} as GenerationTask)
        this.saveProgress()
      }
      return
    }

    void this.processTask(task)

    // 检查是否可以继续处理更多任务
    if (this.processing.size < this.config.maxConcurrent && this.queue.length > 0) {
      this.processTimer = setTimeout(() => {
        this.processNext()
      }, this.config.delayBetweenTasks)
    }
  }

  private async processTask(task: GenerationTask): Promise<void> {
    const handler = this.handlers.get(task.type)
    if (!handler) {
      task.status = 'failed'
      task.error = `Handler not found: ${task.type}`
      this.failed.push(task)
      this.emit('task:failed', task, { error: task.error })
      this.processNext()
      return
    }

    task.status = 'processing'
    task.startedAt = new Date().toISOString()
    this.processing.set(task.id, task)
    this.emit('task:started', task)

    const onProgress: ProgressCallback = (progress, message) => {
      task.progress = progress
      this.emit('task:progress', task, { progress, message })
    }

    try {
      const result = await handler(task, onProgress)

      task.status = 'completed'
      task.progress = 100
      task.completedAt = new Date().toISOString()
      task.result = {
        url: result?.url ?? '',
        metadata: result?.metadata,
      }

      this.processing.delete(task.id)
      this.completed.push(task)
      this.emit('task:completed', task, result)
    } catch (error) {
      task.error = error instanceof Error ? error.message : String(error)
      this.processing.delete(task.id)

      // 自动重试
      if (this.config.autoRetryOnFailure && task.retryCount < this.config.maxRetries) {
        task.retryCount += 1
        task.status = 'pending'
        task.error = undefined
        this.insertByPriority(task)
      } else {
        task.status = 'failed'
        task.completedAt = new Date().toISOString()
        this.failed.push(task)
        this.emit('task:failed', task, { error: task.error })
      }
    }

    this.processNext()
  }

  private emit(event: QueueEvent, task: GenerationTask, data?: unknown): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(task, data)
      } catch {
        // 监听器异常静默忽略，不影响队列处理
      }
    })
  }
}

// ============================================================================
// 单例辅助
// ============================================================================

let singleton: GenerationQueue | null = null

/** 获取生成队列单例 */
export function getGenerationQueue(config?: Partial<QueueConfig>): GenerationQueue {
  if (!singleton) {
    singleton = new GenerationQueue(config)
    singleton.restoreProgress()
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        singleton?.saveProgress()
      })
    }
  }
  return singleton
}

export default GenerationQueue
