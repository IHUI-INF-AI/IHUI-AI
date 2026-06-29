import { t } from '@/utils/i18n'

/**
 * 统一生成队列服务
 * 
 * 功能：
 * 1. 统一管理所有AI生成任务（图片、视频、3D模型）
 * 2. 优先级队列和并发控制
 * 3. 进度追踪和状态管理
 * 4. 失败重试和错误处理
 * 5. 资源限制和成本控制
 * 
 * @module services/GenerationQueueService
 * @version 1.0.0
 */

import { ref } from 'vue'
import { logger } from '@/utils/logger'
import { useNotificationCenter } from '@/composables/useNotificationCenter'
import type {
  GenerationTask,
  GenerationType,
  QueueConfig,
  QueueStats,
  Priority,
  UUID,
  ProgressCallback,
} from '@/types/ai-platform.types'

// ============================================================================
// 配置
// ============================================================================

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 2,
  defaultPriority: 'normal',
  delayBetweenTasks: 2000,
  autoRetryOnFailure: true,
  maxRetries: 3,
  saveProgress: true,
}

// 优先级权重
const PRIORITY_WEIGHTS: Record<Priority, number> = {
  urgent: 100,
  high: 75,
  normal: 50,
  low: 25,
}

// ============================================================================
// 类型定义
// ============================================================================

/** 任务处理器 */
type TaskHandler<T = unknown> = (
  task: GenerationTask,
  onProgress: ProgressCallback
) => Promise<T>

/** 任务事件 */
type TaskEvent = 
  | 'task:added'
  | 'task:started'
  | 'task:progress'
  | 'task:completed'
  | 'task:failed'
  | 'task:cancelled'
  | 'queue:empty'
  | 'queue:paused'
  | 'queue:resumed'

/** 事件监听器 */
type EventListener = (task: GenerationTask, data?: unknown) => void

// ============================================================================
// 生成队列服务类
// ============================================================================

export class GenerationQueueService {
  // 状态
  private queue: GenerationTask[] = []
  private processing: Map<UUID, GenerationTask> = new Map()
  private completed: GenerationTask[] = []
  private failed: GenerationTask[] = []
  
  // 配置
  private config: QueueConfig
  
  // 控制
  private isRunning = false
  private isPaused = false
  private processTimer: ReturnType<typeof setTimeout> | null = null
  
  // 处理器
  private handlers: Map<GenerationType, TaskHandler> = new Map()
  
  // 事件监听
  private listeners: Map<TaskEvent, Set<EventListener>> = new Map()
  
  // 通知
  private notifications = useNotificationCenter()
  
  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  // ==========================================================================
  // 任务管理
  // ==========================================================================
  
  /**
   * 添加任务
   */
  addTask(task: Omit<GenerationTask, 'id' | 'status' | 'createdAt'>): UUID {
    const id = this.generateId()
    
    const newTask: GenerationTask = {
      ...task,
      id,
      priority: task.priority || this.config.defaultPriority,
      status: {
        status: 'pending',
        progress: 0,
      },
      createdAt: new Date().toISOString(),
    }
    
    // 按优先级插入队列
    this.insertByPriority(newTask)
    
    // 触发事件
    this.emit('task:added', newTask)
    
    // 自动开始处理
    if (!this.isRunning && !this.isPaused) {
      this.start()
    }
    
    logger.info(`Task added to queue: ${id} (${task.type})`)
    return id
  }
  
  /**
   * 批量添加任务
   */
  addTasks(tasks: Array<Omit<GenerationTask, 'id' | 'status' | 'createdAt'>>): UUID[] {
    return tasks.map(task => this.addTask(task))
  }
  
  /**
   * 取消任务
   */
  cancelTask(taskId: UUID): boolean {
    // 从待处理队列中移除
    const queueIndex = this.queue.findIndex(t => t.id === taskId)
    if (queueIndex >= 0) {
      const task = this.queue.splice(queueIndex, 1)[0]
      task.status.status = 'cancelled'
      this.emit('task:cancelled', task)
      logger.info(`Task cancelled: ${taskId}`)
      return true
    }
    
    // Cannot cancel task in progress
    if (this.processing.has(taskId)) {
      logger.warn(`Cannot cancel task in progress: ${taskId}`)
      return false
    }
    
    return false
  }
  
  /**
   * 更新任务优先级
   */
  updatePriority(taskId: UUID, priority: Priority): boolean {
    const task = this.queue.find(t => t.id === taskId)
    if (task) {
      task.priority = priority
      // 重新排序
      this.queue.sort((a, b) => 
        PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
      )
      return true
    }
    return false
  }
  
  /**
   * 获取任务状态
   */
  getTask(taskId: UUID): GenerationTask | undefined {
    return this.queue.find(t => t.id === taskId)
      || this.processing.get(taskId)
      || this.completed.find(t => t.id === taskId)
      || this.failed.find(t => t.id === taskId)
  }
  
  // ==========================================================================
  // 队列控制
  // ==========================================================================
  
  /**
   * 开始处理队列
   */
  start(): void {
    if (this.isRunning) return
    
    this.isRunning = true
    this.isPaused = false
    logger.info('Queue started processing')
    
    this.processNext()
  }
  
  /**
   * 暂停队列
   */
  pause(): void {
    this.isPaused = true
    this.emit('queue:paused', {} as GenerationTask)
    logger.info('Queue paused')
  }
  
  /**
   * 恢复队列
   */
  resume(): void {
    if (!this.isPaused) return
    
    this.isPaused = false
    this.emit('queue:resumed', {} as GenerationTask)
    logger.info('Queue resumed')
    
    this.processNext()
  }
  
  /**
   * 停止队列
   */
  stop(): void {
    this.isRunning = false
    this.isPaused = false
    
    if (this.processTimer) {
      clearTimeout(this.processTimer)
      this.processTimer = null
    }
    
    logger.info('Queue stopped')
  }
  
  /**
   * 清空队列
   */
  clear(): void {
    // 取消所有待处理任务
    this.queue.forEach(task => {
      task.status.status = 'cancelled'
      this.emit('task:cancelled', task)
    })
    
    this.queue = []
    logger.info('Queue cleared')
  }
  
  // ==========================================================================
  // 处理器注册
  // ==========================================================================
  
  /**
   * 注册任务处理器
   */
  registerHandler<T>(type: GenerationType, handler: TaskHandler<T>): void {
    this.handlers.set(type, handler as TaskHandler)
    logger.info(`Handler registered: ${type}`)
  }
  
  /**
   * 移除任务处理器
   */
  removeHandler(type: GenerationType): void {
    this.handlers.delete(type)
  }
  
  // ==========================================================================
  // 事件监听
  // ==========================================================================
  
  /**
   * 订阅事件
   */
  on(event: TaskEvent, listener: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener)
    
    // 返回取消订阅函数
    return () => {
      this.listeners.get(event)?.delete(listener)
    }
  }
  
  /**
   * 取消订阅
   */
  off(event: TaskEvent, listener: EventListener): void {
    this.listeners.get(event)?.delete(listener)
  }
  
  /**
   * 触发事件
   */
  private emit(event: TaskEvent, task: GenerationTask, data?: unknown): void {
    this.listeners.get(event)?.forEach(listener => {
      try {
        listener(task, data)
      } catch (error) {
        logger.error(`Event listener error (${event}):`, error)
      }
    })
  }
  
  // ==========================================================================
  // 统计信息
  // ==========================================================================
  
  /**
   * 获取队列统计
   */
  getStats(): QueueStats {
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.length,
      failed: this.failed.length,
      total: this.queue.length + this.processing.size + this.completed.length + this.failed.length,
    }
  }
  
  /**
   * 获取处理中的任务
   */
  getProcessingTasks(): GenerationTask[] {
    return Array.from(this.processing.values())
  }
  
  /**
   * 获取待处理任务
   */
  getPendingTasks(): GenerationTask[] {
    return [...this.queue]
  }
  
  // ==========================================================================
  // 内部方法
  // ==========================================================================
  
  /**
   * 生成唯一ID
   */
  private generateId(): UUID {
    return `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
  
  /**
   * 按优先级插入
   */
  private insertByPriority(task: GenerationTask): void {
    const weight = PRIORITY_WEIGHTS[task.priority]
    const insertIndex = this.queue.findIndex(
      t => PRIORITY_WEIGHTS[t.priority] < weight
    )
    
    if (insertIndex === -1) {
      this.queue.push(task)
    } else {
      this.queue.splice(insertIndex, 0, task)
    }
  }
  
  /**
   * 处理下一个任务
   */
  private processNext(): void {
    if (!this.isRunning || this.isPaused) return
    
    // 检查并发限制
    if (this.processing.size >= this.config.maxConcurrent) {
      return
    }
    
    // 获取下一个任务
    const task = this.queue.shift()
    if (!task) {
      // 队列为空
      if (this.processing.size === 0) {
        this.emit('queue:empty', {} as GenerationTask)
        logger.info('Queue processing completed')
      }
      return
    }
    
    // 开始处理
    void this.processTask(task)
    
    // 检查是否可以处理更多任务
    if (this.processing.size < this.config.maxConcurrent && this.queue.length > 0) {
      // 任务间延迟
      this.processTimer = setTimeout(() => {
        this.processNext()
      }, this.config.delayBetweenTasks)
    }
  }
  
  /**
   * 处理单个任务
   */
  private async processTask(task: GenerationTask): Promise<void> {
    const handler = this.handlers.get(task.type)
    if (!handler) {
      logger.error(`Handler not found: ${task.type}`)
      task.status.status = 'failed'
      task.status.error = `Handler not found: ${task.type}`
      this.failed.push(task)
      this.emit('task:failed', task, { error: task.status.error })
      this.processNext()
      return
    }
    
    // 更新状态
    task.status.status = 'processing'
    task.status.startedAt = new Date().toISOString()
    this.processing.set(task.id, task)
    
    this.emit('task:started', task)
    logger.info(`Starting to process task: ${task.id} (${task.type})`)
    
    // 进度回调
    const onProgress: ProgressCallback = (progress, message) => {
      task.status.progress = progress
      task.status.stage = message
      this.emit('task:progress', task, { progress, message })
    }
    
    try {
      // 执行任务
      const result = await handler(task, onProgress)
      
      // 完成
      task.status.status = 'completed'
      task.status.progress = 100
      task.status.completedAt = new Date().toISOString()
      
      const typedResult = result as { url?: string; metadata?: { size: number; format: string; model: string; prompt: string } } | undefined
      task.result = {
        id: this.generateId(),
        type: task.type,
        url: typedResult?.url || '',
        metadata: typedResult?.metadata || { size: 0, format: 'unknown', model: task.model, prompt: task.prompt },
        createdAt: new Date().toISOString(),
      }
      
      this.processing.delete(task.id)
      this.completed.push(task)
      
      this.emit('task:completed', task, result)
      logger.info(`Task completed: ${task.id}`)
      
      // 发送通知
      this.notifications.showGenerationComplete(task.type as 'image' | 'video' | '3d', {
        url: task.result.url,
      })
      
    } catch (error) {
      logger.error(`Task failed: ${task.id}`, error)
      
      // 更新状态
      task.status.status = 'failed'
      task.status.error = error instanceof Error ? error.message : String(error)
      task.status.completedAt = new Date().toISOString()
      
      this.processing.delete(task.id)
      
      // 检查是否需要重试
      const taskWithRetry = task as GenerationTask & { _retryCount?: number }
      const retryCount = taskWithRetry._retryCount || 0
      if (this.config.autoRetryOnFailure && retryCount < this.config.maxRetries) {
        taskWithRetry._retryCount = retryCount + 1
        task.status.status = 'pending'
        task.status.error = undefined
        
        // 重新加入队列
        this.insertByPriority(task)
        logger.info(`Task will retry: ${task.id} (attempt ${retryCount + 1})`)
      } else {
        this.failed.push(task)
        this.emit('task:failed', task, { error: task.status.error })
        
        // 发送错误通知
        this.notifications.showError(
          `生成失败: ${task.status.error}`,
          `${task.type}生成失败`,
          {
            actions: [
              {
                id: 'retry',
                label: t('text.generation_queue_service.重试'),
                type: 'primary',
                handler: () => {
                  this.retryTask(task.id)
                },
              },
            ],
          }
        )
      }
    }
    
    // 继续处理下一个
    this.processNext()
  }
  
  /**
   * 重试失败的任务
   */
  retryTask(taskId: UUID): boolean {
    const index = this.failed.findIndex(t => t.id === taskId)
    if (index >= 0) {
      const task = this.failed.splice(index, 1)[0]
      task.status.status = 'pending'
      task.status.progress = 0
      task.status.error = undefined
      const taskWithRetry = task as GenerationTask & { _retryCount?: number }
      taskWithRetry._retryCount = 0
      
      this.insertByPriority(task)
      
      if (!this.isRunning) {
        this.start()
      }
      
      logger.info(`Task re-added to queue: ${taskId}`)
      return true
    }
    return false
  }
  
  /**
   * 保存进度到本地存储
   */
  saveProgress(): void {
    if (!this.config.saveProgress) return
    
    try {
      const state = {
        queue: this.queue,
        failed: this.failed,
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem('generation-queue-progress', JSON.stringify(state))
    } catch (error) {
      logger.warn('Failed to save queue progress:', error)
    }
  }
  
  /**
   * 恢复进度
   */
  restoreProgress(): boolean {
    if (!this.config.saveProgress) return false
    
    try {
      const saved = localStorage.getItem('generation-queue-progress')
      if (!saved) return false
      
      const state = JSON.parse(saved)
      
      // 恢复待处理任务
      state.queue?.forEach((task: GenerationTask) => {
        if (task.status.status === 'pending' || task.status.status === 'processing') {
          task.status.status = 'pending'
          task.status.progress = 0
          this.queue.push(task)
        }
      })
      
      // 恢复失败任务
      state.failed?.forEach((task: GenerationTask) => {
        this.failed.push(task)
      })
      
      logger.info('Queue progress restored')
      return this.queue.length > 0
    } catch (error) {
      logger.warn('Failed to restore queue progress:', error)
      return false
    }
  }
}

// ============================================================================
// Vue Composable
// ============================================================================

// 单例实例
let instance: GenerationQueueService | null = null

/**
 * 使用生成队列服务
 */
export function useGenerationQueue(config?: Partial<QueueConfig>) {
  if (!instance) {
    instance = new GenerationQueueService(config)
    
    // 尝试恢复进度
    instance.restoreProgress()
    
    // 页面卸载时保存进度
    window.addEventListener('beforeunload', () => {
      instance?.saveProgress()
    })
  }
  
  // 响应式状态
  const stats = ref(instance.getStats())
  const processingTasks = ref(instance.getProcessingTasks())
  const pendingTasks = ref(instance.getPendingTasks())
  
  // 更新状态的方法
  const updateStats = () => {
    stats.value = instance!.getStats()
    processingTasks.value = instance!.getProcessingTasks()
    pendingTasks.value = instance!.getPendingTasks()
  }
  
  // 订阅事件更新状态
  instance.on('task:added', updateStats)
  instance.on('task:started', updateStats)
  instance.on('task:completed', updateStats)
  instance.on('task:failed', updateStats)
  instance.on('task:cancelled', updateStats)
  
  return {
    // 服务实例
    service: instance,
    
    // 响应式状态
    stats,
    processingTasks,
    pendingTasks,
    
    // 便捷方法
    addTask: instance.addTask.bind(instance),
    addTasks: instance.addTasks.bind(instance),
    cancelTask: instance.cancelTask.bind(instance),
    getTask: instance.getTask.bind(instance),
    
    start: instance.start.bind(instance),
    pause: instance.pause.bind(instance),
    resume: instance.resume.bind(instance),
    stop: instance.stop.bind(instance),
    clear: instance.clear.bind(instance),
    
    registerHandler: instance.registerHandler.bind(instance),
    on: instance.on.bind(instance),
    off: instance.off.bind(instance),
    
    retryTask: instance.retryTask.bind(instance),
  }
}

// 默认导出
export default GenerationQueueService
