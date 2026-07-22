/**
 * Clawdbot Service - 主服务
 *
 * 统一的 Clawdbot 服务入口，整合所有模块：
 * - Gateway: 消息网关
 * - Channels: 多渠道适配
 * - Tools: 工具执行
 * - Tasks: 任务管理
 * - Evolution: 自我进化
 * - MessageProcessor: 消息处理
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import { getClawdbotGateway, type GatewayConfig, type GatewayMessage } from './gateway.js'
import { getChannelManager, type ChannelMessage, type ChannelConfig } from './channels.js'
import { getToolExecutor, type ToolExecutionResult } from './tools.js'
import { getTaskExecutor, type Task, type TaskResult } from './task-executor.js'
import { getSelfEvolutionEngine, type SkillInstallation } from './self-evolution.js'
import { getMessageProcessor, type ProcessedMessage, type IntentAnalysis } from './message-processor.js'
import { getMemoryService } from './memory.js'
import { getModelManager } from './models.js'
import { getSystemService } from './system.js'
import { getSkillManager } from './skills.js'
import { getCanvasService } from './canvas.js'
import { getIntegrationManager } from './integrations.js'
import { getMcpClient } from './mcp.js'
import { getNodeExecutor } from './nodes.js'
import { getPairingService } from './pairing.js'
import { getVoiceService } from './voice.js'
import { getBrowserAutomation } from './browser.js'

export interface ClawdbotConfig {
  gateway?: Partial<GatewayConfig>
  channels?: ChannelConfig[]
  autoEvolve?: boolean
  ai?: {
    provider: 'openai' | 'anthropic' | 'gemini' | 'local'
    model: string
    apiKey?: string
    baseUrl?: string
  }
  user?: {
    id: string
    name?: string
    preferences?: Record<string, unknown>
  }
}

export interface ClawdbotStatus {
  initialized: boolean
  gateway: { connected: boolean; activeChannels: number }
  tools: { registered: number; available: string[] }
  tasks: { total: number; running: number; completed: number; failed: number }
  evolution: { skills: number; gaps: number; autoEvolve: boolean }
  messages: { contexts: number; queued: number }
}

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

export class ClawdbotService extends EventEmitter {
  private gateway = getClawdbotGateway()
  private channelManager = getChannelManager()
  private toolExecutor = getToolExecutor()
  private taskExecutor = getTaskExecutor()
  private evolutionEngine = getSelfEvolutionEngine()
  private messageProcessor = getMessageProcessor()
  private memoryService = getMemoryService()
  private modelManager = getModelManager()
  private systemService = getSystemService()
  private skillManager = getSkillManager()
  private canvasService = getCanvasService()
  private integrationManager = getIntegrationManager()
  private mcpClient = getMcpClient()
  private nodeExecutor = getNodeExecutor()
  private pairingService = getPairingService()
  private voiceService = getVoiceService()
  private browserAutomation = getBrowserAutomation()

  private initialized = false
  private config: ClawdbotConfig = {}
  /** 内存对话历史 — 需后续建表持久化(clawdbotSessions 表需 botId,当前接口未传 botId) */
  private conversations = new Map<string, ConversationMessage[]>()

  constructor() {
    super()
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.gateway.on('connected', () => {
      logger.info('[Clawdbot] Gateway connected')
      this.emit('gateway:connected')
    })
    this.gateway.on('disconnected', () => {
      logger.info('[Clawdbot] Gateway disconnected')
      this.emit('gateway:disconnected')
    })
    this.gateway.on('message', (message: GatewayMessage) => {
      void this.handleGatewayMessage(message)
    })
    this.channelManager.on('message', async (message: ChannelMessage) => {
      await this.handleChannelMessage(message)
    })
    this.taskExecutor.on('completed', (task: Task) => {
      logger.info({ task: task.name }, '[Clawdbot] Task completed')
      this.emit('task:completed', task)
    })
    this.taskExecutor.on('failed', (task: Task) => {
      logger.warn({ task: task.name }, '[Clawdbot] Task failed')
      this.emit('task:failed', task)
    })
    this.evolutionEngine.on('skillInstalled', (skill: SkillInstallation) => {
      logger.info({ skill: skill.name }, '[Clawdbot] New skill installed')
      this.emit('evolution:skillInstalled', skill)
    })
  }

  async initialize(config?: ClawdbotConfig): Promise<void> {
    if (config) this.config = config
    if (this.config.gateway) this.gateway.configure(this.config.gateway)
    if (this.config.channels) {
      for (const ch of this.config.channels) this.channelManager.register(ch)
    }
    if (this.config.autoEvolve) this.evolutionEngine.enableAutoEvolution()
    await this.gateway.connect()
    this.initialized = true
    logger.info('[Clawdbot] Initialized')
    this.emit('initialized')
  }

  async shutdown(): Promise<void> {
    await this.gateway.disconnect()
    this.initialized = false
    logger.info('[Clawdbot] Shutdown')
    this.emit('shutdown')
  }

  private async handleGatewayMessage(message: GatewayMessage): Promise<void> {
    const channelMessage: ChannelMessage = {
      id: message.id,
      channelId: message.channel,
      channelType: message.channelType as never,
      userId: message.userId,
      content: message.content,
      timestamp: message.timestamp,
      metadata: message.metadata,
    }
    await this.handleChannelMessage(channelMessage)
  }

  async handleChannelMessage(message: ChannelMessage): Promise<ProcessedMessage> {
    const processed = await this.messageProcessor.process(message)
    this.recordConversation(message.userId, processed)
    this.evolutionEngine.recordBehavior(processed.intent.primary, true, { messageId: message.id })
    this.emit('message:processed', processed)
    return processed
  }

  private recordConversation(userId: string, processed: ProcessedMessage): void {
    if (!this.conversations.has(userId)) this.conversations.set(userId, [])
    const history = this.conversations.get(userId)!
    history.push({
      id: processed.original.id,
      role: 'user',
      content: processed.original.content,
      timestamp: processed.original.timestamp,
      metadata: { intent: processed.intent },
    })
    if (history.length > 100) history.shift()
    this.memoryService.store({
      type: 'short_term',
      content: processed.original.content,
      importance: processed.intent.confidence,
      tags: [processed.intent.primary, processed.original.channelId],
    })
  }

  async chat(userId: string, content: string): Promise<ConversationMessage> {
    const processed = await this.messageProcessor.process({
      id: `msg_${Date.now()}`,
      channelId: 'direct',
      channelType: 'web',
      userId,
      content,
      timestamp: Date.now(),
    })

    const completion = await this.gateway.routeCompletion({
      messages: [
        { role: 'system' as const, content: 'You are Clawdbot, a helpful AI assistant.' },
        ...this.getRecentHistory(userId),
        { role: 'user' as const, content },
      ],
    })

    const response: ConversationMessage = {
      id: `resp_${Date.now()}`,
      role: 'assistant',
      content: completion.content,
      timestamp: Date.now(),
      metadata: { intent: processed.intent },
    }

    if (!this.conversations.has(userId)) this.conversations.set(userId, [])
    this.conversations.get(userId)!.push(response)

    this.emit('chat:response', { userId, response })
    return response
  }

  private getRecentHistory(userId: string): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const history = this.conversations.get(userId) ?? []
    return history.slice(-10).map((m) => ({ role: m.role, content: m.content }))
  }

  async executeTask(name: string, description: string, steps: Array<{ id: string; name: string; type: 'tool'; toolName?: string; toolParams?: Record<string, unknown> }>, context?: Record<string, unknown>): Promise<TaskResult> {
    const task = this.taskExecutor.create({ name, description, steps, context })
    return this.taskExecutor.execute(task.id)
  }

  getConversation(userId: string): ConversationMessage[] {
    return this.conversations.get(userId) ?? []
  }

  getStatus(): ClawdbotStatus {
    const gatewayStats = this.gateway.getStats()
    const taskStats = this.taskExecutor.getStatus()
    const evolutionStats = this.evolutionEngine.getStatus()
    const messageStats = this.messageProcessor.getStatus()
    return {
      initialized: this.initialized,
      gateway: { connected: this.gateway.isConnected, activeChannels: gatewayStats.activeChannels },
      tools: {
        registered: this.toolExecutor.getStats().total,
        available: this.toolExecutor.getAllTools().map((t) => t.name),
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
      messages: { contexts: messageStats.activeContexts, queued: messageStats.queuedMessages },
    }
  }

  // 子服务访问器
  getGateway() { return this.gateway }
  getChannelManager() { return this.channelManager }
  getToolExecutor() { return this.toolExecutor }
  getTaskExecutor() { return this.taskExecutor }
  getEvolutionEngine() { return this.evolutionEngine }
  getMessageProcessor() { return this.messageProcessor }
  getMemoryService() { return this.memoryService }
  getModelManager() { return this.modelManager }
  getSystemService() { return this.systemService }
  getSkillManager() { return this.skillManager }
  getCanvasService() { return this.canvasService }
  getIntegrationManager() { return this.integrationManager }
  getMcpClient() { return this.mcpClient }
  getNodeExecutor() { return this.nodeExecutor }
  getPairingService() { return this.pairingService }
  getVoiceService() { return this.voiceService }
  getBrowserAutomation() { return this.browserAutomation }
}

let instance: ClawdbotService | null = null

export function getClawdbotService(): ClawdbotService {
  if (!instance) instance = new ClawdbotService()
  return instance
}
