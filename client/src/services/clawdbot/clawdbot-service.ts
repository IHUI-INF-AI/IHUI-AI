/**
 * Clawdbot Service
 * 
 * 统一的 Clawdbot 服务入口，整合所有模块:
 * - Gateway: 消息网关
 * - Channels: 多渠道适配
 * - Tools: 工具执行
 * - Tasks: 任务管理
 * - Evolution: 自我进化
 * - MessageProcessor: 消息处理
 */

import { ref, reactive, computed } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'
import { getClawdbotGateway } from './gateway'
import { getChannelManager, type ChannelMessage, type ChannelConfig } from './channels'
import { getToolExecutor, type ToolDefinition, type ToolExecutionResult } from './tools'
import { getTaskExecutor, type Task, type TaskResult } from './task-executor'
import { getSelfEvolutionEngine, type SkillInstallation } from './self-evolution'
import { getMessageProcessor, type ProcessedMessage, type IntentAnalysis } from './message-processor'
import type { GatewayConfig } from './gateway'

/**
 * Clawdbot 配置
 */
export interface ClawdbotConfig {
  /** 网关配置 */
  gateway?: Partial<GatewayConfig>
  /** 渠道配置 */
  channels?: ChannelConfig[]
  /** 是否启用自动进化 */
  autoEvolve?: boolean
  /** AI 模型配置 */
  ai?: {
    provider: 'openai' | 'anthropic' | 'gemini' | 'local'
    model: string
    apiKey?: string
    baseUrl?: string
  }
  /** 用户配置 */
  user?: {
    id: string
    name?: string
    preferences?: Record<string, unknown>
  }
}

/**
 * Clawdbot 状态
 */
export interface ClawdbotStatus {
  /** 是否已初始化 */
  initialized: boolean
  /** 网关状态 */
  gateway: {
    connected: boolean
    activeChannels: number
  }
  /** 工具状态 */
  tools: {
    registered: number
    available: string[]
  }
  /** 任务状态 */
  tasks: {
    total: number
    running: number
    completed: number
    failed: number
  }
  /** 进化状态 */
  evolution: {
    skills: number
    gaps: number
    autoEvolve: boolean
  }
  /** 消息处理状态 */
  messages: {
    contexts: number
    queued: number
  }
}

/**
 * 对话消息
 */
export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  metadata?: {
    intent?: IntentAnalysis
    toolCalls?: Array<{ name: string; result: ToolExecutionResult }>
    taskId?: string
  }
}

/**
 * Clawdbot 服务
 */
export class ClawdbotService extends EventEmitter {
  // 子服务
  private gateway = getClawdbotGateway()
  private channelManager = getChannelManager()
  private toolExecutor = getToolExecutor()
  private taskExecutor = getTaskExecutor()
  private evolutionEngine = getSelfEvolutionEngine()
  private messageProcessor = getMessageProcessor()
  
  // 状态
  private initialized = ref(false)
  private config = ref<ClawdbotConfig>({})
  private conversations = reactive<Map<string, ConversationMessage[]>>(new Map())
  
  // 计算属性
  public status = computed<ClawdbotStatus>(() => {
    const gatewayStats = this.gateway.getStats()
    const taskStats = this.taskExecutor.getStatus()
    const evolutionStats = this.evolutionEngine.getStatus()
    const messageStats = this.messageProcessor.getStatus()
    
    return {
      initialized: this.initialized.value,
      gateway: {
        connected: this.gateway.isConnected,
        activeChannels: gatewayStats.activeChannels,
      },
      tools: {
        registered: this.toolExecutor.getAllTools().length,
        available: this.toolExecutor.getAllTools().map(t => t.name),
      },
      tasks: {
        total: taskStats.totalTasks,
        running: taskStats.runningTasks,
        completed: taskStats.completedTasks,
        failed: taskStats.failedTasks,
      },
      evolution: {
        skills: evolutionStats.skillsCount,
        gaps: evolutionStats.gapsCount,
        autoEvolve: evolutionStats.autoEvolve,
      },
      messages: {
        contexts: messageStats.activeContexts,
        queued: messageStats.queuedMessages,
      },
    }
  })

  constructor() {
    super()
    this.setupEventListeners()
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 网关事件
    this.gateway.on('connected', () => {
      logger.info('[Clawdbot] Gateway connected')
      this.emit('gateway:connected')
    })
    
    this.gateway.on('disconnected', () => {
      logger.info('[Clawdbot] Gateway disconnected')
      this.emit('gateway:disconnected')
    })
    
    this.gateway.on('message', (message) => {
      void this.handleGatewayMessage(message)
    })
    
    // 渠道事件
    this.channelManager.on('message', async (message: ChannelMessage) => {
      await this.handleChannelMessage(message)
    })
    
    // 任务事件
    this.taskExecutor.on('taskCompleted', (task: Task) => {
      logger.info(`[Clawdbot] Task completed: ${task.name}`)
      this.emit('task:completed', task)
    })
    
    this.taskExecutor.on('taskFailed', (task: Task) => {
      logger.warn(`[Clawdbot] Task failed: ${task.name}`)
      this.emit('task:failed', task)
    })
    
    // 进化事件
    this.evolutionEngine.on('skillInstalled', (skill: SkillInstallation) => {
      logger.info(`[Clawdbot] New skill installed: ${skill.name}`)
      this.emit('evolution:skillInstalled', skill)
    })
  }

  /**
   * 初始化服务
   */
  async initialize(config: ClawdbotConfig = {}): Promise<boolean> {
    if (this.initialized.value) {
      logger.warn('[Clawdbot] Service already initialized')
      return true
    }
    
    logger.info('[Clawdbot] Starting service initialization...')
    this.config.value = config
    
    try {
      // 连接网关
      if (config.gateway?.wsUrl) {
        await this.gateway.connect(config.gateway.wsUrl)
      } else {
        // 本地模式
        await this.gateway.connect()
      }
      
      // 注册渠道
      if (config.channels) {
        for (const channelConfig of config.channels) {
          await this.channelManager.registerChannel(channelConfig)
        }
      }
      
      // 注册默认的 WebChat 渠道
      await this.channelManager.registerChannel({
        type: 'webchat',
        id: 'default-webchat',
        name: 'Web Chat',
        enabled: true,
      })
      
      // 配置进化引擎
      if (config.autoEvolve !== undefined) {
        this.evolutionEngine.updateConfig({ autoEvolve: config.autoEvolve })
      }
      
      this.initialized.value = true
      logger.info('[Clawdbot] Service initialization completed')
      this.emit('initialized')
      
      return true
    } catch (error) {
      logger.error('[Clawdbot] Service initialization failed:', error)
      return false
    }
  }

  /**
   * 处理网关消息
   */
  private async handleGatewayMessage(message: unknown): Promise<void> {
    logger.debug('[Clawdbot] Received gateway message:', message)
    this.emit('gateway:message', message)
  }

  /**
   * 处理渠道消息
   */
  private async handleChannelMessage(message: ChannelMessage): Promise<void> {
    logger.info(`[Clawdbot] Received channel message: [${message.channelType}] ${message.content.substring(0, 50)}`)
    
    try {
      // 处理消息
      const processed = await this.messageProcessor.processMessage(message)
      
      // 路由到处理器
      const route = await this.messageProcessor.routeMessage(processed)
      
      // 执行处理
      let result: unknown
      
      switch (route.handler) {
        case 'tool':
          result = await this.toolExecutor.executeTool(
            route.params.toolName as string,
            this.extractToolParams(processed),
            {
              userId: message.userId,
              conversationId: message.conversationId || message.userId,
            }
          )
          break
          
        case 'task': {
          const task = this.taskExecutor.getTask(route.params.taskId as string)
          if (task) {
            result = await this.taskExecutor.executeTask(task.id)
          }
          break
        }
          
        case 'human':
          // 需要人工处理
          this.emit('humanRequired', { message, reason: route.params.reason })
          result = { success: false, needsHuman: true }
          break
          
        case 'evolution':
          // 触发进化
          result = { success: true, evolving: true }
          break
          
        default:
          // 默认 AI 聊天处理
          result = await this.handleChat(message, processed)
      }
      
      // 生成响应
      const response = await this.messageProcessor.generateResponse(processed, result)
      
      // 发送响应
      await this.sendResponse(message, response)
      
      // 保存对话
      this.saveConversation(message.conversationId || message.userId, message, response, processed)
      
    } catch (error) {
      logger.error('[Clawdbot] Message processing failed:', error)
      await this.sendResponse(message, '抱歉，处理您的请求时遇到了问题。请稍后重试。')
    }
  }

  /**
   * 提取工具参数
   */
  private extractToolParams(processed: ProcessedMessage): Record<string, unknown> {
    const params: Record<string, unknown> = {}
    
    for (const entity of processed.entities) {
      switch (entity.type) {
        case 'url':
          params.url = entity.value
          break
        case 'file_path':
          params.path = entity.value
          break
        case 'code':
          params.command = entity.value
          break
        default:
          params[entity.type] = entity.value
      }
    }
    
    return params
  }

  /**
   * 处理聊天
   */
  private async handleChat(message: ChannelMessage, _processed: ProcessedMessage): Promise<{ success: boolean; response?: string }> {
    // 这里可以集成实际的 AI 聊天服务
    // 目前返回简单响应
    return {
      success: true,
      response: `收到您的消息：${message.content}`,
    }
  }

  /**
   * 发送响应
   */
  private async sendResponse(originalMessage: ChannelMessage, response: string): Promise<void> {
    // 通过原渠道发送响应
    try {
      await this.channelManager.sendMessage(originalMessage.channelId, {
        content: response,
        conversationId: originalMessage.conversationId,
        userId: 'assistant',
        replyTo: originalMessage.id,
      })
    } catch (error) {
      logger.error('[Clawdbot] Failed to send response:', error)
    }
  }

  /**
   * 保存对话
   */
  private saveConversation(
    conversationId: string,
    message: ChannelMessage,
    response: string,
    processed: ProcessedMessage
  ): void {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, [])
    }
    
    const messages = this.conversations.get(conversationId)!
    
    // 添加用户消息
    messages.push({
      id: message.id,
      role: 'user',
      content: message.content,
      timestamp: message.timestamp,
      metadata: {
        intent: processed.intent,
      },
    })
    
    // 添加助手响应
    messages.push({
      id: `resp_${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    })
    
    // 限制历史长度
    if (messages.length > 100) {
      messages.splice(0, messages.length - 100)
    }
  }

  // ==================== 公开 API ====================

  /**
   * 发送消息（主要入口）
   */
  async sendMessage(
    content: string,
    options: {
      conversationId?: string
      userId?: string
      channelType?: string
      attachments?: ChannelMessage['attachments']
    } = {}
  ): Promise<string> {
    const {
      conversationId = `conv_${Date.now()}`,
      userId = this.config.value.user?.id || 'user',
      channelType = 'webchat',
    } = options
    
    // 构造消息
    const message: ChannelMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      channelType: channelType as ChannelMessage['channelType'],
      channelId: 'default-webchat',
      userId,
      content,
      messageType: 'text',
      attachments: options.attachments,
      conversationId,
      timestamp: Date.now(),
    }
    
    // 通过 WebChat 适配器处理
    const webChatAdapter = this.channelManager.getWebChatAdapter()
    if (webChatAdapter) {
      webChatAdapter.handleWebMessage({
        userId,
        content,
        conversationId,
        attachments: options.attachments,
      })
    }
    
    return message.id
  }

  /**
   * 执行工具
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    context?: { userId?: string; conversationId?: string }
  ): Promise<ToolExecutionResult> {
    return this.toolExecutor.executeTool(toolName, params, {
      userId: context?.userId || 'user',
      conversationId: context?.conversationId || 'default',
      env: {},
      workingDirectory: '.',
      log: (level, msg) => logger[level](`[Tool:${toolName}] ${msg}`),
    })
  }

  /**
   * 创建任务
   */
  async createTask(description: string): Promise<Task> {
    return this.taskExecutor.createTaskFromNL(description)
  }

  /**
   * 执行任务
   */
  async executeTask(taskId: string): Promise<TaskResult> {
    return this.taskExecutor.executeTask(taskId)
  }

  /**
   * 注册自定义工具
   */
  registerTool(tool: ToolDefinition): void {
    this.toolExecutor.registerTool(tool)
  }

  /**
   * 获取对话历史
   */
  getConversationHistory(conversationId: string): ConversationMessage[] {
    return this.conversations.get(conversationId) || []
  }

  /**
   * 清除对话
   */
  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId)
    this.messageProcessor.clearContext(`webchat_${conversationId}`)
  }

  /**
   * 获取所有工具
   */
  getTools(): ToolDefinition[] {
    return this.toolExecutor.getAllTools()
  }

  /**
   * 获取所有任务
   */
  getTasks(): Task[] {
    return this.taskExecutor.getAllTasks()
  }

  /**
   * 获取已安装的技能
   */
  getSkills(): SkillInstallation[] {
    return this.evolutionEngine.getInstalledSkills()
  }

  /**
   * 安装技能
   */
  async installSkill(spec: {
    name: string
    description: string
    code: string
    version?: string
  }): Promise<SkillInstallation> {
    return this.evolutionEngine.createSkill(spec)
  }

  /**
   * 卸载技能
   */
  async uninstallSkill(name: string): Promise<void> {
    return this.evolutionEngine.uninstallSkill(name)
  }

  /**
   * 注册渠道
   */
  async registerChannel(config: ChannelConfig): Promise<boolean> {
    return this.channelManager.registerChannel(config)
  }

  /**
   * 获取服务状态
   */
  getStatus(): ClawdbotStatus {
    return this.status.value
  }

  /**
   * 关闭服务
   */
  async shutdown(): Promise<void> {
    logger.info('[Clawdbot] Shutting down service...')
    
    // 断开所有渠道
    await this.channelManager.disconnectAll()
    
    // 断开网关
    this.gateway.disconnect()
    
    this.initialized.value = false
    logger.info('[Clawdbot] Service shut down')
    this.emit('shutdown')
  }
}

// 单例实例
let clawdbotServiceInstance: ClawdbotService | null = null

/**
 * 获取 Clawdbot 服务实例
 */
export function getClawdbotService(): ClawdbotService {
  if (!clawdbotServiceInstance) {
    clawdbotServiceInstance = new ClawdbotService()
  }
  return clawdbotServiceInstance
}
