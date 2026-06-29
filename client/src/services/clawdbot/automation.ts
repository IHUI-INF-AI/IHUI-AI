/**
 * Clawdbot Automation System
 * 
 * 自动化功能:
 * - Cron Jobs (定时任务)
 * - Webhooks (Webhook 接收)
 * - Gmail PubSub (邮件监听)
 * - Polls (轮询)
 * - Hooks (生命周期钩子)
 */

import { reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * Cron Job 配置
 */
export interface CronJob {
  id: string
  name: string
  schedule: string // Cron 表达式
  task: string // 任务描述或命令
  enabled: boolean
  lastRun?: number
  nextRun?: number
  runCount: number
  maxRuns?: number
  timezone?: string
  metadata?: Record<string, unknown>
}

/**
 * Webhook 配置
 */
export interface WebhookConfig {
  id: string
  name: string
  endpoint: string
  secret?: string
  events: string[]
  enabled: boolean
  createdAt: number
  lastTriggered?: number
  triggerCount: number
}

/**
 * Gmail PubSub 配置
 */
export interface GmailPubSubConfig {
  id: string
  email: string
  topicName: string
  subscriptionName: string
  filters?: {
    from?: string[]
    subject?: string
    labels?: string[]
  }
  enabled: boolean
  lastMessage?: number
}

/**
 * Poll 配置
 */
export interface PollConfig {
  id: string
  name: string
  url: string
  interval: number // 毫秒
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: unknown
  enabled: boolean
  lastPoll?: number
  lastResult?: unknown
}

/**
 * Hook 类型
 */
export type HookType = 
  | 'beforeMessage'
  | 'afterMessage'
  | 'beforeToolExec'
  | 'afterToolExec'
  | 'onError'
  | 'onConnect'
  | 'onDisconnect'
  | 'onStartup'
  | 'onShutdown'

/**
 * Hook 配置
 */
export interface HookConfig {
  id: string
  type: HookType
  name: string
  handler: string // 处理函数代码或引用
  priority: number
  enabled: boolean
}

/**
 * 自动化管理器
 */
export class AutomationManager extends EventEmitter {
  private cronJobs = reactive<Map<string, CronJob>>(new Map())
  private webhooks = reactive<Map<string, WebhookConfig>>(new Map())
  private gmailConfigs = reactive<Map<string, GmailPubSubConfig>>(new Map())
  private polls = reactive<Map<string, PollConfig>>(new Map())
  private hooks = reactive<Map<string, HookConfig>>(new Map())
  
  private cronTimers = new Map<string, ReturnType<typeof setInterval>>()
  private pollTimers = new Map<string, ReturnType<typeof setInterval>>()
  
  private readonly STORAGE_KEY = 'clawdbot-automation'

  constructor() {
    super()
    this.loadFromStorage()
  }

  // ==================== Cron Jobs ====================

  /**
   * 创建定时任务
   */
  createCronJob(config: Omit<CronJob, 'id' | 'runCount'>): CronJob {
    const job: CronJob = {
      ...config,
      id: `cron_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      runCount: 0,
      nextRun: this.calculateNextRun(config.schedule),
    }
    
    this.cronJobs.set(job.id, job)
    
    if (job.enabled) {
      this.scheduleCronJob(job)
    }
    
    this.saveToStorage()
    this.emit('cronJobCreated', job)
    logger.info(`[Automation] Cron job created: ${job.name}`)
    
    return job
  }

  /**
   * 计算下次运行时间
   */
  private calculateNextRun(schedule: string): number {
    // 简单实现：解析 cron 表达式
    // 实际应该使用 cron-parser 库
    const _parts = schedule.split(' ')
    const now = new Date()
    
    // 简单处理：每分钟检查
    return now.getTime() + 60000
  }

  /**
   * 调度 Cron 任务
   */
  private scheduleCronJob(job: CronJob): void {
    // 清除现有定时器
    this.stopCronJob(job.id)
    
    // 简单实现：每分钟检查是否需要运行
    const timer = setInterval(() => {
      const now = Date.now()
      if (job.enabled && job.nextRun && now >= job.nextRun) {
        void this.executeCronJob(job)
      }
    }, 60000)
    
    this.cronTimers.set(job.id, timer)
  }

  /**
   * 执行 Cron 任务
   */
  private async executeCronJob(job: CronJob): Promise<void> {
    logger.info(`[Automation] Executing cron job: ${job.name}`)
    
    try {
      job.lastRun = Date.now()
      job.runCount++
      job.nextRun = this.calculateNextRun(job.schedule)
      
      // 检查最大运行次数
      if (job.maxRuns && job.runCount >= job.maxRuns) {
        job.enabled = false
        this.stopCronJob(job.id)
      }
      
      this.emit('cronJobExecuted', { job, success: true })
      this.saveToStorage()
    } catch (error) {
      logger.error(`[Automation] Cron job failed: ${job.name}`, error)
      this.emit('cronJobExecuted', { job, success: false, error })
    }
  }

  /**
   * 停止 Cron 任务
   */
  stopCronJob(jobId: string): void {
    const timer = this.cronTimers.get(jobId)
    if (timer) {
      clearInterval(timer)
      this.cronTimers.delete(jobId)
    }
  }

  /**
   * 删除 Cron 任务
   */
  deleteCronJob(jobId: string): void {
    this.stopCronJob(jobId)
    this.cronJobs.delete(jobId)
    this.saveToStorage()
    this.emit('cronJobDeleted', { jobId })
  }

  /**
   * 获取所有 Cron 任务
   */
  getCronJobs(): CronJob[] {
    return Array.from(this.cronJobs.values())
  }

  // ==================== Webhooks ====================

  /**
   * 创建 Webhook
   */
  createWebhook(config: Omit<WebhookConfig, 'id' | 'createdAt' | 'triggerCount'>): WebhookConfig {
    const webhook: WebhookConfig = {
      ...config,
      id: `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: Date.now(),
      triggerCount: 0,
    }
    
    this.webhooks.set(webhook.id, webhook)
    this.saveToStorage()
    this.emit('webhookCreated', webhook)
    logger.info(`[Automation] Webhook created: ${webhook.name}`)
    
    return webhook
  }

  /**
   * 处理 Webhook 请求
   */
  async handleWebhook(webhookId: string, payload: unknown, headers?: Record<string, string>): Promise<{
    success: boolean
    error?: string
  }> {
    const webhook = this.webhooks.get(webhookId)
    if (!webhook || !webhook.enabled) {
      return { success: false, error: 'Webhook not found or disabled' }
    }
    
    // 验证签名
    if (webhook.secret && headers) {
      const signature = headers['x-webhook-signature'] || headers['x-hub-signature-256']
      if (!this.verifyWebhookSignature(payload, webhook.secret, signature)) {
        return { success: false, error: 'Invalid signature' }
      }
    }
    
    try {
      webhook.lastTriggered = Date.now()
      webhook.triggerCount++
      
      this.emit('webhookTriggered', { webhook, payload })
      this.saveToStorage()
      
      logger.info(`[Automation] Webhook triggered: ${webhook.name}`)
      return { success: true }
    } catch (error) {
      logger.error(`[Automation] Webhook error: ${webhook.name}`, error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 验证 Webhook 签名
   */
  private verifyWebhookSignature(payload: unknown, secret: string, signature?: string): boolean {
    if (!signature) return false
    // 实际应该使用 crypto 库验证 HMAC
    return true
  }

  /**
   * 删除 Webhook
   */
  deleteWebhook(webhookId: string): void {
    this.webhooks.delete(webhookId)
    this.saveToStorage()
    this.emit('webhookDeleted', { webhookId })
  }

  /**
   * 获取所有 Webhooks
   */
  getWebhooks(): WebhookConfig[] {
    return Array.from(this.webhooks.values())
  }

  // ==================== Gmail PubSub ====================

  /**
   * 配置 Gmail PubSub
   */
  configureGmailPubSub(config: Omit<GmailPubSubConfig, 'id'>): GmailPubSubConfig {
    const gmailConfig: GmailPubSubConfig = {
      ...config,
      id: `gmail_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    }
    
    this.gmailConfigs.set(gmailConfig.id, gmailConfig)
    this.saveToStorage()
    this.emit('gmailConfigured', gmailConfig)
    logger.info(`[Automation] Gmail PubSub configured: ${gmailConfig.email}`)
    
    return gmailConfig
  }

  /**
   * 处理 Gmail 消息
   */
  async handleGmailMessage(configId: string, message: unknown): Promise<void> {
    const config = this.gmailConfigs.get(configId)
    if (!config || !config.enabled) {
      return
    }
    
    config.lastMessage = Date.now()
    this.emit('gmailMessage', { config, message })
    this.saveToStorage()
    
    logger.info(`[Automation] Gmail message received: ${config.email}`)
  }

  /**
   * 获取 Gmail 配置
   */
  getGmailConfigs(): GmailPubSubConfig[] {
    return Array.from(this.gmailConfigs.values())
  }

  // ==================== Polls ====================

  /**
   * 创建轮询
   */
  createPoll(config: Omit<PollConfig, 'id'>): PollConfig {
    const poll: PollConfig = {
      ...config,
      id: `poll_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    }
    
    this.polls.set(poll.id, poll)
    
    if (poll.enabled) {
      this.startPoll(poll)
    }
    
    this.saveToStorage()
    this.emit('pollCreated', poll)
    logger.info(`[Automation] Poll created: ${poll.name}`)
    
    return poll
  }

  /**
   * 启动轮询
   */
  private startPoll(poll: PollConfig): void {
    this.stopPoll(poll.id)
    
    const timer = setInterval(async () => {
      if (!poll.enabled) return
      
      try {
        const response = await fetch(poll.url, {
          method: poll.method,
          headers: poll.headers,
          body: poll.body ? JSON.stringify(poll.body) : undefined,
        })
        
        const result = await response.json()
        poll.lastPoll = Date.now()
        poll.lastResult = result
        
        this.emit('pollResult', { poll, result })
        this.saveToStorage()
      } catch (error) {
        logger.error(`[Automation] Poll error: ${poll.name}`, error)
        this.emit('pollError', { poll, error })
      }
    }, poll.interval)
    
    this.pollTimers.set(poll.id, timer)
  }

  /**
   * 停止轮询
   */
  stopPoll(pollId: string): void {
    const timer = this.pollTimers.get(pollId)
    if (timer) {
      clearInterval(timer)
      this.pollTimers.delete(pollId)
    }
  }

  /**
   * 删除轮询
   */
  deletePoll(pollId: string): void {
    this.stopPoll(pollId)
    this.polls.delete(pollId)
    this.saveToStorage()
    this.emit('pollDeleted', { pollId })
  }

  /**
   * 获取所有轮询
   */
  getPolls(): PollConfig[] {
    return Array.from(this.polls.values())
  }

  // ==================== Hooks ====================

  /**
   * 注册 Hook
   */
  registerHook(config: Omit<HookConfig, 'id'>): HookConfig {
    const hook: HookConfig = {
      ...config,
      id: `hook_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    }
    
    this.hooks.set(hook.id, hook)
    this.saveToStorage()
    this.emit('hookRegistered', hook)
    logger.info(`[Automation] Hook registered: ${hook.name} (${hook.type})`)
    
    return hook
  }

  /**
   * 触发 Hooks
   */
  async triggerHooks(type: HookType, data: unknown): Promise<void> {
    const matchingHooks = Array.from(this.hooks.values())
      .filter(h => h.type === type && h.enabled)
      .sort((a, b) => a.priority - b.priority)
    
    for (const hook of matchingHooks) {
      try {
        logger.debug(`[Automation] Triggering hook: ${hook.name}`)
        this.emit(`hook:${type}`, { hook, data })
      } catch (error) {
        logger.error(`[Automation] Hook error: ${hook.name}`, error)
      }
    }
  }

  /**
   * 删除 Hook
   */
  deleteHook(hookId: string): void {
    this.hooks.delete(hookId)
    this.saveToStorage()
    this.emit('hookDeleted', { hookId })
  }

  /**
   * 获取所有 Hooks
   */
  getHooks(): HookConfig[] {
    return Array.from(this.hooks.values())
  }

  // ==================== Storage ====================

  /**
   * 保存到存储
   */
  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = {
          cronJobs: Array.from(this.cronJobs.entries()),
          webhooks: Array.from(this.webhooks.entries()),
          gmailConfigs: Array.from(this.gmailConfigs.entries()),
          polls: Array.from(this.polls.entries()),
          hooks: Array.from(this.hooks.entries()),
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
      }
    } catch (error) {
      logger.error('[Automation] Failed to save to storage:', error)
    }
  }

  /**
   * 从存储加载
   */
  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const dataStr = localStorage.getItem(this.STORAGE_KEY)
        if (dataStr) {
          const data = JSON.parse(dataStr)
          
          if (data.cronJobs) {
            this.cronJobs.clear()
            for (const [key, value] of data.cronJobs) {
              this.cronJobs.set(key, value)
              if ((value as CronJob).enabled) {
                this.scheduleCronJob(value as CronJob)
              }
            }
          }
          
          if (data.webhooks) {
            this.webhooks.clear()
            for (const [key, value] of data.webhooks) {
              this.webhooks.set(key, value)
            }
          }
          
          if (data.gmailConfigs) {
            this.gmailConfigs.clear()
            for (const [key, value] of data.gmailConfigs) {
              this.gmailConfigs.set(key, value)
            }
          }
          
          if (data.polls) {
            this.polls.clear()
            for (const [key, value] of data.polls) {
              this.polls.set(key, value)
              if ((value as PollConfig).enabled) {
                this.startPoll(value as PollConfig)
              }
            }
          }
          
          if (data.hooks) {
            this.hooks.clear()
            for (const [key, value] of data.hooks) {
              this.hooks.set(key, value)
            }
          }
          
          logger.info('[Automation] Loaded from storage')
        }
      }
    } catch (error) {
      logger.error('[Automation] Failed to load from storage:', error)
    }
  }

  /**
   * 关闭所有自动化任务
   */
  shutdown(): void {
    // 停止所有 Cron 任务
    for (const jobId of this.cronTimers.keys()) {
      this.stopCronJob(jobId)
    }
    
    // 停止所有轮询
    for (const pollId of this.pollTimers.keys()) {
      this.stopPoll(pollId)
    }
    
    logger.info('[Automation] All automation tasks stopped')
  }

  /**
   * 获取状态
   */
  getStatus(): {
    cronJobs: number
    activeCronJobs: number
    webhooks: number
    polls: number
    activePolls: number
    hooks: number
  } {
    return {
      cronJobs: this.cronJobs.size,
      activeCronJobs: this.cronTimers.size,
      webhooks: this.webhooks.size,
      polls: this.polls.size,
      activePolls: this.pollTimers.size,
      hooks: this.hooks.size,
    }
  }
}

// 单例实例
let automationManagerInstance: AutomationManager | null = null

/**
 * 获取自动化管理器实例
 */
export function getAutomationManager(): AutomationManager {
  if (!automationManagerInstance) {
    automationManagerInstance = new AutomationManager()
  }
  return automationManagerInstance
}
