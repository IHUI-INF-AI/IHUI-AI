// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ModelConfig } from '../src/services/clawdbot/models.js'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { completeMock, getDefaultMock, listEnabledMock, wsInstances } = vi.hoisted(() => ({
  completeMock: vi.fn(),
  getDefaultMock: vi.fn(),
  listEnabledMock: vi.fn((): ModelConfig[] => []),
  // F-501:记录每个被构造的 socket,用于断言 connecting 去重与过期代回调丢弃
  wsInstances: [] as unknown[],
}))

vi.mock('../src/services/clawdbot/models.js', () => ({
  getModelManager: () => ({
    complete: completeMock,
    getDefault: getDefaultMock,
    listEnabled: listEnabledMock,
  }),
}))

// Mock ws 模块:MockWebSocket 构造后异步触发 'open' 事件,模拟连接成功
vi.mock('ws', async () => {
  const { EventEmitter } = await import('node:events')
  return {
    default: class MockWebSocket extends EventEmitter {
      constructor(_url: string) {
        super()
        wsInstances.push(this)
        setImmediate(() => this.emit('open'))
      }
      send() {}
      close() {}
    },
  }
})

import { ClawdbotGateway, getClawdbotGateway } from '../src/services/clawdbot/gateway.js'

const mockModel = (
  id: string,
  overrides: Partial<{ costPer1kTokens: { input: number; output: number }; enabled: boolean }> = {},
) => ({
  id,
  name: `Model ${id}`,
  provider: 'openai' as const,
  maxTokens: 4096,
  temperature: 0.7,
  capabilities: ['chat'],
  enabled: true,
  ...overrides,
})

describe('clawdbot ClawdbotGateway AI 网关', () => {
  let gw: ClawdbotGateway

  beforeEach(() => {
    gw = new ClawdbotGateway()
    wsInstances.length = 0
    completeMock.mockReset()
    getDefaultMock.mockReset()
    listEnabledMock.mockReset()
    listEnabledMock.mockReturnValue([])
  })

  describe('configure', () => {
    it('configure 合并配置', () => {
      gw.configure({ wsUrl: 'ws://x' })
      // 配置内部存储不暴露，通过行为验证
      expect(() => gw.configure({ wsUrl: 'ws://y' })).not.toThrow()
    })
  })

  describe('connect / disconnect', () => {
    it('connect 切换状态为 connected', async () => {
      await gw.connect()
      await new Promise((r) => setImmediate(r))
      expect(gw.isConnected).toBe(true)
    })

    it('重复 connect 不抛错', async () => {
      await gw.connect()
      await expect(gw.connect()).resolves.toBeUndefined()
    })

    it('connect 触发 connected 事件', async () => {
      const handler = vi.fn()
      gw.on('connected', handler)
      await gw.connect()
      await new Promise((r) => setImmediate(r))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('disconnect 切换状态为 disconnected', async () => {
      await gw.connect()
      await gw.disconnect()
      expect(gw.isConnected).toBe(false)
    })

    it('disconnect 触发 disconnected 事件', async () => {
      const handler = vi.fn()
      gw.on('disconnected', handler)
      await gw.disconnect()
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('receiveMessage 接收消息', () => {
    it('生成 id 与 timestamp', () => {
      const m = gw.receiveMessage({
        type: 'chat',
        channel: 'web',
        channelType: 'web',
        userId: 'u1',
        content: 'hi',
      })
      expect(m.id).toMatch(/^gw_[a-z0-9]+$/)
      expect(m.timestamp).toBeGreaterThan(0)
      expect(m.content).toBe('hi')
    })

    it('触发 message 事件', () => {
      const handler = vi.fn()
      gw.on('message', handler)
      gw.receiveMessage({
        type: 'chat',
        channel: 'web',
        channelType: 'web',
        userId: 'u1',
        content: 'hi',
      })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('routeCompletion 路由补全', () => {
    it('failover 策略使用默认模型', async () => {
      getDefaultMock.mockReturnValue(mockModel('m1'))
      completeMock.mockResolvedValueOnce({
        modelId: 'm1',
        content: 'ok',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
      })
      const r = await gw.routeCompletion({ messages: [] })
      expect(r.modelId).toBe('m1')
    })

    it('failover 无默认模型抛错', async () => {
      await expect(gw.routeCompletion({ messages: [] })).rejects.toThrow('All models failed')
    })

    it('failover 主模型失败时回退到 fallbackModels', async () => {
      completeMock.mockRejectedValueOnce(new Error('primary fail')).mockResolvedValueOnce({
        modelId: 'm2',
        content: 'fb',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
      })
      gw.configure({ routing: { strategy: 'failover', fallbackModels: ['m2'] } })
      const r = await gw.routeCompletion({ messages: [], modelId: 'm1' })
      expect(r.modelId).toBe('m2')
    })

    it('failover 全部失败时抛错', async () => {
      completeMock.mockRejectedValue(new Error('all fail'))
      gw.configure({ routing: { strategy: 'failover', fallbackModels: ['m2'] } })
      await expect(gw.routeCompletion({ messages: [], modelId: 'm1' })).rejects.toThrow('all fail')
    })

    it('round_robin 策略轮询 enabled 模型', async () => {
      listEnabledMock.mockReturnValue([mockModel('m1'), mockModel('m2')])
      completeMock
        .mockResolvedValueOnce({
          modelId: 'm1',
          content: 'a',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          modelId: 'm2',
          content: 'b',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop',
        })
      gw.configure({ routing: { strategy: 'round_robin' } })
      const r1 = await gw.routeCompletion({ messages: [] })
      const r2 = await gw.routeCompletion({ messages: [] })
      expect(r1.modelId).toBe('m1')
      expect(r2.modelId).toBe('m2')
    })

    it('round_robin 无 enabled 模型抛错', async () => {
      listEnabledMock.mockReturnValue([])
      gw.configure({ routing: { strategy: 'round_robin' } })
      await expect(gw.routeCompletion({ messages: [] })).rejects.toThrow('No models available')
    })

    it('least_latency 策略使用最快模型（无统计数据时返回默认）', async () => {
      getDefaultMock.mockReturnValue(mockModel('m1'))
      completeMock.mockResolvedValueOnce({
        modelId: 'm1',
        content: 'a',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
      })
      gw.configure({ routing: { strategy: 'least_latency' } })
      const r = await gw.routeCompletion({ messages: [] })
      expect(r.modelId).toBe('m1')
    })

    it('cost_optimized 策略使用最便宜模型', async () => {
      listEnabledMock.mockReturnValue([
        mockModel('m1', { costPer1kTokens: { input: 0.01, output: 0.02 } }),
        mockModel('m2', { costPer1kTokens: { input: 0.001, output: 0.002 } }),
      ])
      completeMock.mockResolvedValueOnce({
        modelId: 'm2',
        content: 'a',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
      })
      gw.configure({ routing: { strategy: 'cost_optimized' } })
      const r = await gw.routeCompletion({ messages: [] })
      expect(r.modelId).toBe('m2')
    })
  })

  describe('F-501 connect 竞态与 socket 代次', () => {
    it('connecting 窗口内重复 connect 只开一条 socket', async () => {
      // 原判据只看 connected:connecting 期第二次 connect 会开第二条 socket 泄漏
      await Promise.all([gw.connect(), gw.connect()])
      await new Promise((r) => setImmediate(r))
      expect(wsInstances).toHaveLength(1)
      expect(gw.isConnected).toBe(true)
      expect(gw.state_).toBe('connected')
    })

    it('disconnect 后旧 socket 迟到的 close 不得清掉新代连接', async () => {
      await gw.connect()
      await new Promise((r) => setImmediate(r))
      const firstSocket = wsInstances[0] as NodeJS.EventEmitter
      await gw.disconnect()
      expect(gw.isConnected).toBe(false)

      await gw.connect()
      await new Promise((r) => setImmediate(r))
      expect(wsInstances).toHaveLength(2)
      expect(gw.isConnected).toBe(true)

      // shutdown→initialize 竞态:旧代 socket 的 close 迟到触发
      firstSocket.emit('close', 1006, Buffer.from('stale'))
      expect(gw.isConnected).toBe(true)
      expect(gw.state_).toBe('connected')
    })

    it('重连换代后旧 socket 的后续事件被代次校验丢弃', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] })
      try {
        await gw.connect()
        await new Promise((r) => setImmediate(r))
        expect(gw.isConnected).toBe(true)
        const oldSocket = wsInstances[0] as NodeJS.EventEmitter

        const messageHandler = vi.fn()
        gw.on('message', messageHandler)

        // 服务端断开 → 计划重连(旧 socket 监听器仍在册,靠代次兜底)
        oldSocket.emit('close', 1006, Buffer.from('drop'))
        expect(gw.isConnected).toBe(false)
        expect(gw.state_).toBe('reconnecting')
        vi.advanceTimersByTime(1000) // 退避 1s 到点 → 开出新一代 socket
        expect(wsInstances).toHaveLength(2)
        await new Promise((r) => setImmediate(r))
        expect(gw.isConnected).toBe(true)

        // 旧代 socket 迟到的 close/message:不得改写新代状态、不得上抛分发
        oldSocket.emit('close', 1006, Buffer.from('stale'))
        oldSocket.emit('message', Buffer.from(JSON.stringify({ id: 'stale', type: 'chat' })))
        expect(gw.isConnected).toBe(true)
        expect(gw.state_).toBe('connected')
        expect(messageHandler).not.toHaveBeenCalled()
        // wsClient 仍指向新代:send 只有在新代在册时才为 true
        expect(gw.send({ type: 'chat', channel: 'web' })).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('getStats', () => {
    it('返回 connected/state/activeChannels/latencyStats', async () => {
      await gw.connect()
      await new Promise((r) => setImmediate(r))
      const s = gw.getStats()
      expect(s.connected).toBe(true)
      expect(s.state).toBe('connected')
      expect(s.activeChannels).toBe(0)
      expect(Array.isArray(s.latencyStats)).toBe(true)
    })
  })

  describe('单例', () => {
    it('getClawdbotGateway 返回同一实例', () => {
      expect(getClawdbotGateway()).toBe(getClawdbotGateway())
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
