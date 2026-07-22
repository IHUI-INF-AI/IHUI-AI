/**
 * Clawdbot Message Processor - 消息处理器
 *
 * 多模态消息解析、路由。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import type { ChannelMessage } from './channels.js'

export type MessageIntent =
  | 'chat'
  | 'question'
  | 'command'
  | 'tool_request'
  | 'task_creation'
  | 'search'
  | 'translation'
  | 'summarization'
  | 'sentiment'
  | 'complaint'
  | 'feedback'
  | 'greeting'
  | 'unknown'

export interface IntentAnalysis {
  primary: MessageIntent
  confidence: number
  secondary?: MessageIntent[]
  sentiment: 'positive' | 'neutral' | 'negative'
  requiresTool: boolean
  suggestedTools?: string[]
  requiresHuman: boolean
  language: string
}

export interface ExtractedEntity {
  type: string
  value: string
  confidence: number
  position?: { start: number; end: number }
}

export interface MessageContext {
  id: string
  userId: string
  channelId: string
  history: ProcessedMessage[]
  metadata: Record<string, unknown>
  createdAt: number
}

export interface ProcessedMessage {
  original: ChannelMessage
  intent: IntentAnalysis
  entities: ExtractedEntity[]
  context: MessageContext
  processedAt: number
}

export class MessageProcessor extends EventEmitter {
  /** 内存消息上下文 — 运行时状态(会话历史,非持久化数据,重启后重新积累) */
  private contexts = new Map<string, MessageContext>()
  private queue: ChannelMessage[] = []

  async process(message: ChannelMessage): Promise<ProcessedMessage> {
    logger.debug({ messageId: message.id, userId: message.userId }, '[Message] Processing')

    const intent = this.analyzeIntent(message.content)
    const entities = this.extractEntities(message.content)
    const context = this.getOrCreateContext(message.userId, message.channelId)

    const processed: ProcessedMessage = {
      original: message,
      intent,
      entities,
      context,
      processedAt: Date.now(),
    }

    context.history.push(processed)
    if (context.history.length > 50) context.history.shift()

    this.emit('processed', processed)
    return processed
  }

  private analyzeIntent(content: string): IntentAnalysis {
    const lower = content.toLowerCase()
    let primary: MessageIntent = 'chat'
    let confidence = 0.5
    const suggestedTools: string[] = []
    let requiresTool = false

    if (/^(你好|hi|hello|hey|嗨)/i.test(content)) {
      primary = 'greeting'
      confidence = 0.9
    } else if (/\?|？|什么是|怎么|如何|为什么|where|what|how|why|when/i.test(content)) {
      primary = 'question'
      confidence = 0.8
    } else if (/^(搜索|查找|search|find|查询)/i.test(content)) {
      primary = 'search'
      confidence = 0.85
      requiresTool = true
      suggestedTools.push('web_search')
    } else if (/^(翻译|translate)/i.test(content)) {
      primary = 'translation'
      confidence = 0.85
      requiresTool = true
      suggestedTools.push('translate')
    } else if (/^(总结|摘要|summarize)/i.test(content)) {
      primary = 'summarization'
      confidence = 0.85
    } else if (/^(创建任务|执行|run|execute|create task)/i.test(content)) {
      primary = 'task_creation'
      confidence = 0.8
      requiresTool = true
      suggestedTools.push('task_executor')
    } else if (/^(运行|执行|调用|call|invoke)/i.test(content)) {
      primary = 'tool_request'
      confidence = 0.75
      requiresTool = true
    } else if (/^[/!]/.test(content)) {
      primary = 'command'
      confidence = 0.9
      requiresTool = true
    } else if (/(投诉|complaint|不满|bug|问题)/i.test(lower)) {
      primary = 'complaint'
      confidence = 0.7
    }

    let sentiment: IntentAnalysis['sentiment'] = 'neutral'
    if (/(好|棒|赞|great|awesome|good|nice)/i.test(lower)) sentiment = 'positive'
    else if (/(差|坏|烂|bad|terrible|awful|投诉|不满)/i.test(lower)) sentiment = 'negative'

    const requiresHuman = primary === 'complaint' || (sentiment === 'negative' && confidence < 0.5)

    return {
      primary,
      confidence,
      sentiment,
      requiresTool,
      suggestedTools: suggestedTools.length ? suggestedTools : undefined,
      requiresHuman,
      language: /[\u4e00-\u9fa5]/.test(content) ? 'zh' : 'en',
    }
  }

  private extractEntities(content: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = []
    const urlRegex = /https?:\/\/[^\s]+/g
    let match: RegExpExecArray | null
    while ((match = urlRegex.exec(content)) !== null) {
      entities.push({ type: 'url', value: match[0], confidence: 0.95, position: { start: match.index, end: match.index + match[0].length } })
    }
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g
    while ((match = emailRegex.exec(content)) !== null) {
      entities.push({ type: 'email', value: match[0], confidence: 0.95 })
    }
    const phoneRegex = /1[3-9]\d{9}/g
    while ((match = phoneRegex.exec(content)) !== null) {
      entities.push({ type: 'phone', value: match[0], confidence: 0.9 })
    }
    return entities
  }

  private getOrCreateContext(userId: string, channelId: string): MessageContext {
    const contextId = `${userId}:${channelId}`
    let context = this.contexts.get(contextId)
    if (!context) {
      context = {
        id: contextId,
        userId,
        channelId,
        history: [],
        metadata: {},
        createdAt: Date.now(),
      }
      this.contexts.set(contextId, context)
    }
    return context
  }

  enqueue(message: ChannelMessage): void {
    this.queue.push(message)
    this.emit('queued', message)
  }

  async processQueue(): Promise<number> {
    let processed = 0
    while (this.queue.length > 0) {
      const message = this.queue.shift()!
      await this.process(message)
      processed++
    }
    return processed
  }

  getContext(userId: string, channelId: string): MessageContext | undefined {
    return this.contexts.get(`${userId}:${channelId}`)
  }

  clearContext(userId: string, channelId: string): boolean {
    return this.contexts.delete(`${userId}:${channelId}`)
  }

  getStatus() {
    return {
      activeContexts: this.contexts.size,
      queuedMessages: this.queue.length,
    }
  }
}

let instance: MessageProcessor | null = null

export function getMessageProcessor(): MessageProcessor {
  if (!instance) instance = new MessageProcessor()
  return instance
}
