import { EventEmitter } from 'node:events'
import { logger } from './logger.js'

export type MessageIntent =
  'chat' | 'question' | 'command' | 'search' | 'tool_request' | 'task' | 'feedback' | 'unknown'

export interface IntentResult {
  intent: MessageIntent
  confidence: number
  entities: Record<string, string>
}

export interface RouteContext {
  sessionId: string
  userId: string
  botId: string
  content: string
}

export interface RouteResult {
  intent: MessageIntent
  confidence: number
  handler: string
  response: unknown
  timestamp: number
}

export type IntentHandler = (ctx: RouteContext, intent: IntentResult) => Promise<unknown>

export class MessageRouterError extends Error {
  constructor(
    message: string,
    readonly code: 'no_handler' | 'invalid' | 'timeout',
  ) {
    super(message)
    this.name = 'MessageRouterError'
  }
}

const INTENT_KEYWORDS: Record<MessageIntent, string[]> = {
  command: ['执行', '运行', '帮我', '请', 'do', 'run', 'execute'],
  search: ['搜索', '查找', '查询', 'search', 'find', 'lookup'],
  tool_request: ['工具', '调用', 'tool', 'call', 'invoke'],
  task: ['任务', '计划', '步骤', 'task', 'plan', 'step'],
  feedback: ['反馈', '评价', '建议', 'feedback', 'rate'],
  question: ['？', '?', '怎么', '如何', '什么是', '为什么', 'what', 'how', 'why'],
  chat: [],
  unknown: [],
}

export class MessageRouter extends EventEmitter {
  private readonly handlers = new Map<MessageIntent, IntentHandler>()
  private readonly stats = new Map<MessageIntent, number>()

  registerHandler(intent: MessageIntent, handler: IntentHandler): void {
    this.handlers.set(intent, handler)
    logger.info({ intent }, '[MessageRouter] Handler registered')
  }

  unregisterHandler(intent: MessageIntent): boolean {
    return this.handlers.delete(intent)
  }

  recognize(content: string): IntentResult {
    if (!content?.trim()) return { intent: 'unknown', confidence: 0, entities: {} }
    const lower = content.toLowerCase()
    for (const intent of Object.keys(INTENT_KEYWORDS) as MessageIntent[]) {
      const keywords = INTENT_KEYWORDS[intent]
      if (keywords.length === 0) continue
      const matched = keywords.filter((k) => lower.includes(k.toLowerCase()))
      if (matched.length > 0) {
        return {
          intent,
          confidence: Math.min(0.6 + matched.length * 0.15, 0.95),
          entities: { matched: matched.join(',') },
        }
      }
    }
    return { intent: 'chat', confidence: 0.5, entities: {} }
  }

  async route(ctx: RouteContext): Promise<RouteResult> {
    const intent = this.recognize(ctx.content)
    const handler = this.handlers.get(intent.intent)
    if (!handler) throw new MessageRouterError(`无处理器: ${intent.intent}`, 'no_handler')
    this.stats.set(intent.intent, (this.stats.get(intent.intent) ?? 0) + 1)
    try {
      const response = await handler(ctx, intent)
      logger.info({ intent: intent.intent, sessionId: ctx.sessionId }, '[MessageRouter] Routed')
      this.emit('routed', { ctx, intent, response })
      return {
        intent: intent.intent,
        confidence: intent.confidence,
        handler: intent.intent,
        response,
        timestamp: Date.now(),
      }
    } catch (err) {
      logger.error({ err, intent: intent.intent }, '[MessageRouter] Handler failed')
      throw new MessageRouterError(`处理器失败: ${(err as Error).message}`, 'timeout')
    }
  }

  getHandlers(): MessageIntent[] {
    return Array.from(this.handlers.keys())
  }

  getIntentStats(): Record<string, number> {
    return Object.fromEntries(this.stats)
  }

  getTopIntents(limit = 5): Array<{ intent: string; count: number }> {
    return Array.from(this.stats.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
}

let instance: MessageRouter | null = null

export function getMessageRouter(): MessageRouter {
  if (!instance) instance = new MessageRouter()
  return instance
}
