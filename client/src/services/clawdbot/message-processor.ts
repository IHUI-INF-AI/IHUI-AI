/**
 * Clawdbot Message Processor
 * 
 * 统一消息处理器，负责:
 * - 意图识别和分类
 * - 消息路由
 * - 上下文管理
 * - 响应生成
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'
import { getToolExecutor } from './tools'
import { getTaskExecutor } from './task-executor'
import { getSelfEvolutionEngine } from './self-evolution'
import type { ChannelMessage } from './channels'

/**
 * 处理后的消息
 */
export interface ProcessedMessage {
  /** 原始消息 */
  original: ChannelMessage
  /** 意图分析结果 */
  intent: IntentAnalysis
  /** 提取的实体 */
  entities: ExtractedEntity[]
  /** 消息上下文 */
  context: MessageContext
  /** 处理时间 */
  processedAt: number
}

/**
 * 意图分析
 */
export interface IntentAnalysis {
  /** 主要意图 */
  primary: MessageIntent
  /** 置信度 */
  confidence: number
  /** 次要意图 */
  secondary?: MessageIntent[]
  /** 情感 */
  sentiment: 'positive' | 'neutral' | 'negative'
  /** 是否需要工具 */
  requiresTool: boolean
  /** 建议的工具 */
  suggestedTools?: string[]
  /** 是否需要人工介入 */
  requiresHuman: boolean
}

/**
 * 消息意图类型
 */
export type MessageIntent = 
  | 'chat'           // 普通聊天
  | 'question'       // 提问
  | 'command'        // 命令执行
  | 'task'           // 任务请求
  | 'search'         // 搜索
  | 'create'         // 创建内容
  | 'edit'           // 编辑内容
  | 'delete'         // 删除
  | 'analyze'        // 分析
  | 'summarize'      // 总结
  | 'translate'      // 翻译
  | 'code'           // 代码相关
  | 'image'          // 图像处理
  | 'file'           // 文件操作
  | 'web'            // 网页操作
  | 'email'          // 邮件操作
  | 'calendar'       // 日历操作
  | 'reminder'       // 提醒
  | 'settings'       // 设置
  | 'help'           // 帮助
  | 'feedback'       // 反馈
  | 'unknown'        // 未知

/**
 * 提取的实体
 */
export interface ExtractedEntity {
  /** 实体类型 */
  type: 'url' | 'email' | 'date' | 'time' | 'number' | 'file_path' | 'code' | 'person' | 'location' | 'organization' | 'custom'
  /** 实体值 */
  value: string
  /** 在文本中的位置 */
  position: { start: number; end: number }
  /** 置信度 */
  confidence: number
}

/**
 * 消息上下文
 */
export interface MessageContext {
  /** 用户 ID */
  userId: string
  /** 会话 ID */
  conversationId: string
  /** 渠道类型 */
  channelType: string
  /** 历史消息 */
  history: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: number
  }>
  /** 用户偏好 */
  userPreferences: Record<string, unknown>
  /** 会话变量 */
  sessionVariables: Record<string, unknown>
  /** 当前任务 */
  currentTask?: string
}

/**
 * 响应生成配置
 */
interface ResponseConfig {
  /** 响应风格 */
  style: 'formal' | 'casual' | 'technical' | 'friendly'
  /** 最大长度 */
  maxLength?: number
  /** 是否包含建议 */
  includeSuggestions?: boolean
  /** 语言 */
  language?: string
}

/**
 * 消息处理器
 */
export class MessageProcessor extends EventEmitter {
  private contexts = reactive<Map<string, MessageContext>>(new Map())
  private processingQueue = ref<ProcessedMessage[]>([])
  
  // 意图关键词映射
  private intentKeywords: Record<MessageIntent, string[]> = {
    chat: ['你好', '嗨', '聊聊', 'hello', 'hi', 'hey', '晚安', '早安'],
    question: ['什么', '为什么', '怎么', '如何', '哪里', '谁', 'what', 'why', 'how', 'where', 'who', '?', '？'],
    command: ['执行', '运行', '打开', '关闭', '启动', '停止', 'run', 'execute', 'start', 'stop', 'open', 'close'],
    task: ['帮我', '请', '能不能', '可以', 'help', 'please', 'can you', 'would you', '任务', 'task'],
    search: ['搜索', '查找', '找', '搜', 'search', 'find', 'look for', '查询'],
    create: ['创建', '新建', '生成', '制作', 'create', 'generate', 'make', 'new'],
    edit: ['编辑', '修改', '更新', '改', 'edit', 'modify', 'update', 'change'],
    delete: ['删除', '移除', '清除', 'delete', 'remove', 'clear'],
    analyze: ['分析', '检查', '诊断', 'analyze', 'check', 'diagnose', '审查'],
    summarize: ['总结', '概括', '摘要', 'summarize', 'summary', 'brief'],
    translate: ['翻译', '转换', 'translate', 'convert'],
    code: ['代码', '编程', '函数', '脚本', 'code', 'program', 'function', 'script', 'debug', '调试'],
    image: ['图片', '图像', '截图', '照片', 'image', 'picture', 'screenshot', 'photo'],
    file: ['文件', '文档', '目录', '文件夹', 'file', 'document', 'folder', 'directory'],
    web: ['网页', '网站', '浏览', '访问', 'web', 'website', 'browse', 'visit', 'url'],
    email: ['邮件', '邮箱', 'email', 'mail', '发送邮件'],
    calendar: ['日历', '日程', '会议', 'calendar', 'schedule', 'meeting', '预约'],
    reminder: ['提醒', '闹钟', '定时', 'remind', 'alarm', 'timer', '通知'],
    settings: ['设置', '配置', '偏好', 'settings', 'config', 'preference', '选项'],
    help: ['帮助', '说明', '教程', 'help', 'guide', 'tutorial', '怎么用'],
    feedback: ['反馈', '建议', '问题', 'feedback', 'suggestion', 'issue', '报告'],
    unknown: [],
  }

  constructor() {
    super()
  }

  /**
   * 处理消息
   */
  async processMessage(message: ChannelMessage): Promise<ProcessedMessage> {
    logger.info('[MessageProcessor] Processing message:', message.content.substring(0, 50))
    
    const startTime = Date.now()
    
    // 获取或创建上下文
    const context = this.getOrCreateContext(message)
    
    // 分析意图
    const intent = await this.analyzeIntent(message.content, context)
    
    // 提取实体
    const entities = this.extractEntities(message.content)
    
    // 更新上下文
    this.updateContext(context, message, intent)
    
    const processed: ProcessedMessage = {
      original: message,
      intent,
      entities,
      context,
      processedAt: Date.now(),
    }
    
    // 添加到处理队列
    this.processingQueue.value.push(processed)
    if (this.processingQueue.value.length > 100) {
      this.processingQueue.value.shift()
    }
    
    this.emit('messageProcessed', processed)
    
    logger.info(`[MessageProcessor] Message processing completed (${Date.now() - startTime}ms), intent: ${intent.primary}`)
    
    return processed
  }

  /**
   * 分析意图
   */
  async analyzeIntent(content: string, context: MessageContext): Promise<IntentAnalysis> {
    const lowerContent = content.toLowerCase()
    const intentScores: Record<MessageIntent, number> = {} as Record<MessageIntent, number>
    
    // 初始化分数
    for (const intent of Object.keys(this.intentKeywords) as MessageIntent[]) {
      intentScores[intent] = 0
    }
    
    // 关键词匹配计分
    for (const [intent, keywords] of Object.entries(this.intentKeywords)) {
      for (const keyword of keywords) {
        if (lowerContent.includes(keyword.toLowerCase())) {
          intentScores[intent as MessageIntent] += 1
        }
      }
    }
    
    // 考虑上下文
    if (context.currentTask) {
      intentScores.task += 2
    }
    
    // 找出最高分的意图
    let primaryIntent: MessageIntent = 'chat'
    let maxScore = 0
    
    for (const [intent, score] of Object.entries(intentScores)) {
      if (score > maxScore) {
        maxScore = score
        primaryIntent = intent as MessageIntent
      }
    }
    
    // 如果没有明确意图，检查是否是问题
    if (maxScore === 0 && (content.includes('?') || content.includes('？'))) {
      primaryIntent = 'question'
      maxScore = 1
    }
    
    // 计算置信度
    const totalScore = Object.values(intentScores).reduce((a, b) => a + b, 0)
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.5
    
    // 情感分析（简单版本）
    const sentiment = this.analyzeSentiment(content)
    
    // 检查是否需要工具
    const toolIntents: MessageIntent[] = ['command', 'task', 'file', 'web', 'email', 'code', 'image']
    const requiresTool = toolIntents.includes(primaryIntent)
    
    // 建议工具
    const suggestedTools = requiresTool ? this.suggestTools(primaryIntent, content) : undefined
    
    // 检查是否需要人工介入
    const requiresHuman = confidence < 0.3 || content.includes('人工') || content.includes('客服')
    
    // 次要意图
    const secondaryIntents = Object.entries(intentScores)
      .filter(([intent, score]) => intent !== primaryIntent && score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([intent]) => intent as MessageIntent)
    
    return {
      primary: primaryIntent,
      confidence,
      secondary: secondaryIntents.length > 0 ? secondaryIntents : undefined,
      sentiment,
      requiresTool,
      suggestedTools,
      requiresHuman,
    }
  }

  /**
   * 情感分析
   */
  private analyzeSentiment(content: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['好', '棒', '喜欢', '感谢', '谢谢', '赞', '爱', 'good', 'great', 'love', 'thanks', 'awesome', '开心', '高兴']
    const negativeWords = ['差', '坏', '讨厌', '烦', '恨', '糟', 'bad', 'hate', 'terrible', 'awful', '生气', '愤怒', '失望']
    
    const lowerContent = content.toLowerCase()
    let positiveScore = 0
    let negativeScore = 0
    
    for (const word of positiveWords) {
      if (lowerContent.includes(word)) positiveScore++
    }
    
    for (const word of negativeWords) {
      if (lowerContent.includes(word)) negativeScore++
    }
    
    if (positiveScore > negativeScore) return 'positive'
    if (negativeScore > positiveScore) return 'negative'
    return 'neutral'
  }

  /**
   * 建议工具
   */
  private suggestTools(intent: MessageIntent, _content: string): string[] {
    const toolMap: Record<string, string[]> = {
      command: ['execute_command'],
      task: ['execute_command', 'http_request'],
      file: ['read_file', 'write_file', 'list_directory', 'search_files'],
      web: ['browser_navigate', 'browser_click', 'browser_type', 'browser_screenshot'],
      email: ['http_request'],
      code: ['execute_command', 'read_file', 'write_file'],
      image: ['browser_screenshot', 'http_request'],
    }
    
    return toolMap[intent] || []
  }

  /**
   * 提取实体
   */
  extractEntities(content: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = []
    
    // URL 提取
    const urlRegex = /https?:\/\/[^\s]+/g
    let match
    while ((match = urlRegex.exec(content)) !== null) {
      entities.push({
        type: 'url',
        value: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.95,
      })
    }
    
    // Email 提取
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g
    while ((match = emailRegex.exec(content)) !== null) {
      entities.push({
        type: 'email',
        value: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.95,
      })
    }
    
    // 文件路径提取
    const pathRegex = /(?:\/|\\)?[\w.-]+(?:\/|\\)[\w./\\-]+/g
    while ((match = pathRegex.exec(content)) !== null) {
      entities.push({
        type: 'file_path',
        value: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.8,
      })
    }
    
    // 代码块提取
    const codeRegex = /`([^`]+)`/g
    while ((match = codeRegex.exec(content)) !== null) {
      entities.push({
        type: 'code',
        value: match[1],
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.9,
      })
    }
    
    // 数字提取
    const numberRegex = /\b\d+(?:\.\d+)?\b/g
    while ((match = numberRegex.exec(content)) !== null) {
      entities.push({
        type: 'number',
        value: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.85,
      })
    }
    
    // 日期提取（简单格式）
    const dateRegex = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/g
    while ((match = dateRegex.exec(content)) !== null) {
      entities.push({
        type: 'date',
        value: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.9,
      })
    }
    
    // 时间提取
    const timeRegex = /\d{1,2}:\d{2}(?::\d{2})?/g
    while ((match = timeRegex.exec(content)) !== null) {
      entities.push({
        type: 'time',
        value: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        confidence: 0.9,
      })
    }
    
    return entities
  }

  /**
   * 获取或创建上下文
   */
  getOrCreateContext(message: ChannelMessage): MessageContext {
    const contextId = `${message.channelType}_${message.conversationId || message.userId}`
    
    let context = this.contexts.get(contextId)
    if (!context) {
      context = {
        userId: message.userId,
        conversationId: message.conversationId || message.userId,
        channelType: message.channelType,
        history: [],
        userPreferences: {},
        sessionVariables: {},
      }
      this.contexts.set(contextId, context)
    }
    
    return context
  }

  /**
   * 更新上下文
   */
  private updateContext(context: MessageContext, message: ChannelMessage, intent: IntentAnalysis): void {
    // 添加到历史
    context.history.push({
      role: 'user',
      content: message.content,
      timestamp: message.timestamp,
    })
    
    // 限制历史长度
    if (context.history.length > 50) {
      context.history = context.history.slice(-50)
    }
    
    // 更新会话变量
    if (intent.primary === 'task') {
      context.sessionVariables.lastTaskIntent = intent
    }
  }

  /**
   * 添加助手响应到上下文
   */
  addAssistantResponse(contextId: string, response: string): void {
    const context = this.contexts.get(contextId)
    if (context) {
      context.history.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      })
    }
  }

  /**
   * 路由消息到处理器
   */
  async routeMessage(processed: ProcessedMessage): Promise<{
    handler: 'chat' | 'tool' | 'task' | 'human' | 'evolution'
    params: Record<string, unknown>
  }> {
    const { intent } = processed
    
    // 需要人工介入
    if (intent.requiresHuman) {
      return {
        handler: 'human',
        params: { reason: '需要人工处理', confidence: intent.confidence },
      }
    }
    
    // 需要工具执行
    if (intent.requiresTool && intent.suggestedTools && intent.suggestedTools.length > 0) {
      const toolExecutor = getToolExecutor()
      const tool = toolExecutor.getTool(intent.suggestedTools[0])
      
      if (tool) {
        return {
          handler: 'tool',
          params: { 
            toolName: intent.suggestedTools[0],
            entities: processed.entities,
          },
        }
      } else {
        // 没有找到工具，触发自我进化
        const evolutionEngine = getSelfEvolutionEngine()
        await evolutionEngine.analyzeCapabilityGap(
          processed.original.content,
          `没有找到合适的工具处理: ${intent.primary}`
        )
        
        return {
          handler: 'evolution',
          params: { 
            reason: '能力缺口',
            intent: intent.primary,
          },
        }
      }
    }
    
    // 任务请求
    if (intent.primary === 'task') {
      const taskExecutor = getTaskExecutor()
      const task = await taskExecutor.createTaskFromNL(processed.original.content)
      
      return {
        handler: 'task',
        params: { taskId: task.id },
      }
    }
    
    // 默认聊天处理
    return {
      handler: 'chat',
      params: { 
        intent: intent.primary,
        sentiment: intent.sentiment,
      },
    }
  }

  /**
   * 生成响应
   */
  async generateResponse(
    processed: ProcessedMessage,
    result: any,
    config: Partial<ResponseConfig> = {}
  ): Promise<string> {
    const { style = 'friendly', includeSuggestions = true } = config
    
    // 根据意图和结果生成响应
    let response = ''
    
    // 根据风格调整语气
    const greeting = style === 'formal' ? '您好，' : style === 'casual' ? '嗨！' : ''
    
    if (result && typeof result === 'object' && 'success' in result) {
      const toolResult = result as { success: boolean; output?: string; error?: string }
      
      if (toolResult.success) {
        response = `${greeting}操作已完成。${toolResult.output || ''}`
      } else {
        response = `${greeting}抱歉，操作遇到了问题：${toolResult.error || '未知错误'}`
      }
    } else {
      response = `${greeting}我理解您想要${processed.intent.primary}。`
    }
    
    // 添加建议
    if (includeSuggestions && processed.intent.confidence < 0.7) {
      response += '\n\n如果这不是您想要的，请告诉我更多细节。'
    }
    
    // 更新上下文
    const contextId = `${processed.original.channelType}_${processed.context.conversationId}`
    this.addAssistantResponse(contextId, response)
    
    return response
  }

  /**
   * 获取上下文
   */
  getContext(contextId: string): MessageContext | undefined {
    return this.contexts.get(contextId)
  }

  /**
   * 清除上下文
   */
  clearContext(contextId: string): void {
    this.contexts.delete(contextId)
  }

  /**
   * 获取处理队列
   */
  getProcessingQueue(): ProcessedMessage[] {
    return [...this.processingQueue.value]
  }

  /**
   * 获取状态
   */
  getStatus(): {
    activeContexts: number
    queuedMessages: number
  } {
    return {
      activeContexts: this.contexts.size,
      queuedMessages: this.processingQueue.value.length,
    }
  }
}

// 单例实例
let messageProcessorInstance: MessageProcessor | null = null

/**
 * 获取消息处理器实例
 */
export function getMessageProcessor(): MessageProcessor {
  if (!messageProcessorInstance) {
    messageProcessorInstance = new MessageProcessor()
  }
  return messageProcessorInstance
}
