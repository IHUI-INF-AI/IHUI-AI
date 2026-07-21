import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ChannelManager } from '../src/services/clawdbot/channels.js'
import type { ChannelConfig } from '../src/services/clawdbot/channels.js'

const mockChannel = (
  id: string,
  enabled = true,
  type: ChannelConfig['type'] = 'web',
): ChannelConfig => ({
  id,
  type,
  name: `Channel ${id}`,
  enabled,
  config: {},
})

describe('clawdbot ChannelManager 渠道管理', () => {
  let mgr: ChannelManager

  beforeEach(() => {
    mgr = new ChannelManager()
  })

  describe('注册与注销', () => {
    it('register 注册渠道', () => {
      mgr.register(mockChannel('ch1'))
      expect(mgr.get('ch1')).toBeDefined()
      expect(mgr.get('ch1')!.name).toBe('Channel ch1')
    })

    it('register 触发 registered 事件', () => {
      const handler = vi.fn()
      mgr.on('registered', handler)
      const ch = mockChannel('ch1')
      mgr.register(ch)
      expect(handler).toHaveBeenCalledWith(ch)
    })

    it('unregister 注销渠道返回 true', () => {
      mgr.register(mockChannel('ch1'))
      expect(mgr.unregister('ch1')).toBe(true)
      expect(mgr.get('ch1')).toBeUndefined()
    })

    it('unregister 不存在返回 false', () => {
      expect(mgr.unregister('nonexistent')).toBe(false)
    })

    it('unregister 触发 unregistered 事件', () => {
      mgr.register(mockChannel('ch1'))
      const handler = vi.fn()
      mgr.on('unregistered', handler)
      mgr.unregister('ch1')
      expect(handler).toHaveBeenCalledWith('ch1')
    })
  })

  describe('列表查询', () => {
    it('list 返回所有渠道', () => {
      mgr.register(mockChannel('ch1'))
      mgr.register(mockChannel('ch2'))
      expect(mgr.list().length).toBe(2)
    })

    it('listEnabled 只返回启用的渠道', () => {
      mgr.register(mockChannel('ch1', true))
      mgr.register(mockChannel('ch2', false))
      const enabled = mgr.listEnabled()
      expect(enabled.length).toBe(1)
      expect(enabled[0].id).toBe('ch1')
    })
  })

  describe('消息接收', () => {
    it('receiveMessage 生成完整消息', () => {
      const msg = mgr.receiveMessage({
        channelId: 'ch1',
        channelType: 'web',
        userId: 'user1',
        content: 'hello',
      })
      expect(msg.id).toMatch(/^msg_[a-z0-9]+$/)
      expect(msg.timestamp).toBeGreaterThan(0)
      expect(msg.content).toBe('hello')
    })

    it('receiveMessage 触发 message 事件', () => {
      const handler = vi.fn()
      mgr.on('message', handler)
      mgr.receiveMessage({
        channelId: 'ch1',
        channelType: 'web',
        userId: 'user1',
        content: 'hello',
      })
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].content).toBe('hello')
    })

    it('receiveMessage 保留 attachments 与 replyTo', () => {
      const msg = mgr.receiveMessage({
        channelId: 'ch1',
        channelType: 'web',
        userId: 'user1',
        content: 'hello',
        attachments: [{ type: 'image', url: 'http://img' }],
        replyTo: 'msg_prev',
      })
      expect(msg.attachments?.length).toBe(1)
      expect(msg.replyTo).toBe('msg_prev')
    })
  })

  describe('发送消息', () => {
    it('sendMessage 到已启用渠道返回 true', async () => {
      mgr.register(mockChannel('ch1', true))
      const ok = await mgr.sendMessage('ch1', 'hello')
      expect(ok).toBe(true)
    })

    it('sendMessage 到不存在渠道返回 false', async () => {
      const ok = await mgr.sendMessage('nonexistent', 'hello')
      expect(ok).toBe(false)
    })

    it('sendMessage 到禁用渠道返回 false', async () => {
      mgr.register(mockChannel('ch1', false))
      const ok = await mgr.sendMessage('ch1', 'hello')
      expect(ok).toBe(false)
    })

    it('sendMessage 触发 sent 事件', async () => {
      mgr.register(mockChannel('ch1', true))
      const handler = vi.fn()
      mgr.on('sent', handler)
      await mgr.sendMessage('ch1', 'hello', 'user1')
      expect(handler).toHaveBeenCalledWith({ channelId: 'ch1', content: 'hello', userId: 'user1' })
    })
  })

  describe('广播', () => {
    it('broadcast 发送到所有启用渠道', async () => {
      mgr.register(mockChannel('ch1', true))
      mgr.register(mockChannel('ch2', true))
      mgr.register(mockChannel('ch3', false))
      const sent = await mgr.broadcast('hello')
      expect(sent).toBe(2)
    })

    it('broadcast 带 filter 过滤渠道', async () => {
      mgr.register(mockChannel('ch1', true, 'web'))
      mgr.register(mockChannel('ch2', true, 'wechat'))
      const sent = await mgr.broadcast('hello', (c) => c.type === 'web')
      expect(sent).toBe(1)
    })

    it('broadcast 无启用渠道返回 0', async () => {
      mgr.register(mockChannel('ch1', false))
      const sent = await mgr.broadcast('hello')
      expect(sent).toBe(0)
    })
  })

  describe('统计', () => {
    it('getStats 返回正确统计', () => {
      mgr.register(mockChannel('ch1', true, 'web'))
      mgr.register(mockChannel('ch2', true, 'wechat'))
      mgr.register(mockChannel('ch3', false, 'web'))
      const stats = mgr.getStats()
      expect(stats.total).toBe(3)
      expect(stats.enabled).toBe(2)
      expect(stats.byType.web).toBe(2)
      expect(stats.byType.wechat).toBe(1)
    })
  })

  describe('getChannelManager 单例', () => {
    it('返回同一实例', async () => {
      const mod = await import('../src/services/clawdbot/channels.js')
      expect(mod.getChannelManager()).toBe(mod.getChannelManager())
    })
  })
})
