import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  MessageProcessor,
  getMessageProcessor,
} from '../src/services/clawdbot/message-processor.js'
import type { ChannelMessage } from '../src/services/clawdbot/channels.js'

const mockMessage = (content: string, userId = 'u1', channelId = 'web'): ChannelMessage => ({
  id: `msg_${Date.now()}_${Math.random()}`,
  channelId,
  channelType: 'web',
  userId,
  content,
  timestamp: Date.now(),
})

describe('clawdbot MessageProcessor 消息处理器', () => {
  let proc: MessageProcessor

  beforeEach(() => {
    proc = new MessageProcessor()
  })

  describe('process 处理消息', () => {
    it('返回 ProcessedMessage 含 intent/entities/context', async () => {
      const r = await proc.process(mockMessage('hello'))
      expect(r.original.content).toBe('hello')
      expect(r.intent).toBeDefined()
      expect(r.entities).toBeDefined()
      expect(r.context).toBeDefined()
      expect(r.processedAt).toBeGreaterThan(0)
    })

    it('context.history 累加消息', async () => {
      await proc.process(mockMessage('a'))
      await proc.process(mockMessage('b'))
      const ctx = proc.getContext('u1', 'web')
      expect(ctx!.history).toHaveLength(2)
    })

    it('history 超过 50 条时 shift 最旧', async () => {
      for (let i = 0; i < 55; i++) {
        await proc.process(mockMessage(`m${i}`))
      }
      const ctx = proc.getContext('u1', 'web')
      expect(ctx!.history).toHaveLength(50)
    })

    it('触发 processed 事件', async () => {
      const handler = vi.fn()
      proc.on('processed', handler)
      await proc.process(mockMessage('hello'))
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('analyzeIntent 意图识别（通过 process 间接验证）', () => {
    it('greeting 意图', async () => {
      const r = await proc.process(mockMessage('你好'))
      expect(r.intent.primary).toBe('greeting')
      expect(r.intent.language).toBe('zh')
    })

    it('question 意图（含 ?）', async () => {
      const r = await proc.process(mockMessage('what is this?'))
      expect(r.intent.primary).toBe('question')
    })

    it('search 意图 + web_search 工具建议', async () => {
      const r = await proc.process(mockMessage('搜索 AI 新闻'))
      expect(r.intent.primary).toBe('search')
      expect(r.intent.requiresTool).toBe(true)
      expect(r.intent.suggestedTools).toContain('web_search')
    })

    it('translation 意图 + translate 工具建议', async () => {
      const r = await proc.process(mockMessage('翻译 hello world'))
      expect(r.intent.primary).toBe('translation')
      expect(r.intent.suggestedTools).toContain('translate')
    })

    it('summarization 意图', async () => {
      const r = await proc.process(mockMessage('总结这段文字'))
      expect(r.intent.primary).toBe('summarization')
    })

    it('task_creation 意图', async () => {
      const r = await proc.process(mockMessage('创建任务 清理数据'))
      expect(r.intent.primary).toBe('task_creation')
      expect(r.intent.suggestedTools).toContain('task_executor')
    })

    it('tool_request 意图', async () => {
      const r = await proc.process(mockMessage('调用 web_search 工具'))
      expect(r.intent.primary).toBe('tool_request')
    })

    it('command 意图（/ 开头）', async () => {
      const r = await proc.process(mockMessage('/help'))
      expect(r.intent.primary).toBe('command')
      expect(r.intent.requiresTool).toBe(true)
    })

    it('complaint 意图 + requiresHuman', async () => {
      const r = await proc.process(mockMessage('我要投诉 bug 太多'))
      expect(r.intent.primary).toBe('complaint')
      expect(r.intent.requiresHuman).toBe(true)
    })

    it('默认 chat 意图', async () => {
      const r = await proc.process(mockMessage('ok'))
      expect(r.intent.primary).toBe('chat')
    })

    it('正面 sentiment', async () => {
      const r = await proc.process(mockMessage('这个真棒 great'))
      expect(r.intent.sentiment).toBe('positive')
    })

    it('负面 sentiment', async () => {
      const r = await proc.process(mockMessage('太差了 bad'))
      expect(r.intent.sentiment).toBe('negative')
    })

    it('中性 sentiment', async () => {
      const r = await proc.process(mockMessage('hello'))
      expect(r.intent.sentiment).toBe('neutral')
    })

    it('英文文本 language=en', async () => {
      const r = await proc.process(mockMessage('hello world'))
      expect(r.intent.language).toBe('en')
    })
  })

  describe('extractEntities 实体提取', () => {
    it('提取 URL', async () => {
      const r = await proc.process(mockMessage('see https://example.com here'))
      expect(r.entities.some((e) => e.type === 'url' && e.value === 'https://example.com')).toBe(
        true,
      )
    })

    it('提取 email', async () => {
      const r = await proc.process(mockMessage('contact me at a@b.com'))
      expect(r.entities.some((e) => e.type === 'email' && e.value === 'a@b.com')).toBe(true)
    })

    it('提取 phone', async () => {
      const r = await proc.process(mockMessage('call 13800138000'))
      expect(r.entities.some((e) => e.type === 'phone' && e.value === '13800138000')).toBe(true)
    })

    it('无实体时返回空数组', async () => {
      const r = await proc.process(mockMessage('hello'))
      expect(r.entities).toEqual([])
    })
  })

  describe('enqueue / processQueue', () => {
    it('enqueue 加入队列并触发 queued 事件', () => {
      const handler = vi.fn()
      proc.on('queued', handler)
      proc.enqueue(mockMessage('a'))
      expect(proc.getStatus().queuedMessages).toBe(1)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('processQueue 处理全部并返回处理数', async () => {
      proc.enqueue(mockMessage('a'))
      proc.enqueue(mockMessage('b'))
      const n = await proc.processQueue()
      expect(n).toBe(2)
      expect(proc.getStatus().queuedMessages).toBe(0)
    })

    it('processQueue 空队列返回 0', async () => {
      const n = await proc.processQueue()
      expect(n).toBe(0)
    })
  })

  describe('getContext / clearContext', () => {
    it('getContext 返回已创建 context', async () => {
      await proc.process(mockMessage('hi'))
      expect(proc.getContext('u1', 'web')).toBeDefined()
    })

    it('clearContext 删除 context 返回 true', async () => {
      await proc.process(mockMessage('hi'))
      expect(proc.clearContext('u1', 'web')).toBe(true)
      expect(proc.getContext('u1', 'web')).toBeUndefined()
    })

    it('clearContext 不存在返回 false', () => {
      expect(proc.clearContext('u1', 'web')).toBe(false)
    })
  })

  describe('getStatus', () => {
    it('返回 activeContexts 与 queuedMessages', async () => {
      await proc.process(mockMessage('hi'))
      proc.enqueue(mockMessage('b'))
      const s = proc.getStatus()
      expect(s.activeContexts).toBe(1)
      expect(s.queuedMessages).toBe(1)
    })
  })

  describe('单例', () => {
    it('getMessageProcessor 返回同一实例', () => {
      expect(getMessageProcessor()).toBe(getMessageProcessor())
    })
  })
})
