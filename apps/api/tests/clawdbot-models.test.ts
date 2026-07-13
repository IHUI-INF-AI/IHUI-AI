import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ModelManager, getModelManager } from '../src/services/clawdbot/models.js'
import type { ModelConfig } from '../src/services/clawdbot/models.js'

const mockModel = (id: string, overrides: Partial<ModelConfig> = {}): ModelConfig => ({
  id,
  name: `Model ${id}`,
  provider: 'openai',
  maxTokens: 4096,
  temperature: 0.7,
  capabilities: ['chat'],
  enabled: true,
  ...overrides,
})

describe('clawdbot ModelManager 模型管理', () => {
  let mgr: ModelManager

  beforeEach(() => {
    mgr = new ModelManager()
  })

  describe('register 注册', () => {
    it('注册模型', () => {
      mgr.register(mockModel('m1'))
      expect(mgr.get('m1')).toBeDefined()
    })

    it('首个模型设为默认', () => {
      mgr.register(mockModel('m1'))
      expect(mgr.getDefault()?.id).toBe('m1')
    })

    it('isDefault=true 设为默认', () => {
      mgr.register(mockModel('m1'))
      mgr.register(mockModel('m2', { isDefault: true }))
      expect(mgr.getDefault()?.id).toBe('m2')
    })

    it('触发 registered 事件', () => {
      const handler = vi.fn()
      mgr.on('registered', handler)
      mgr.register(mockModel('m1'))
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('unregister 注销', () => {
    it('删除模型', () => {
      mgr.register(mockModel('m1'))
      expect(mgr.unregister('m1')).toBe(true)
      expect(mgr.get('m1')).toBeUndefined()
    })

    it('若为默认模型则清空默认', () => {
      mgr.register(mockModel('m1'))
      mgr.unregister('m1')
      expect(mgr.getDefault()).toBeUndefined()
    })

    it('不存在返回 false', () => {
      expect(mgr.unregister('not_exist')).toBe(false)
    })
  })

  describe('setDefault 设置默认', () => {
    it('设置存在模型为默认', () => {
      mgr.register(mockModel('m1'))
      mgr.register(mockModel('m2'))
      expect(mgr.setDefault('m2')).toBe(true)
      expect(mgr.getDefault()?.id).toBe('m2')
    })

    it('设置不存在模型返回 false', () => {
      expect(mgr.setDefault('not_exist')).toBe(false)
    })

    it('触发 defaultChanged 事件', () => {
      const handler = vi.fn()
      mgr.on('defaultChanged', handler)
      mgr.register(mockModel('m1'))
      mgr.register(mockModel('m2'))
      mgr.setDefault('m2')
      expect(handler).toHaveBeenCalledWith('m2')
    })
  })

  describe('list / listEnabled', () => {
    it('list 返回全部', () => {
      mgr.register(mockModel('m1'))
      mgr.register(mockModel('m2', { enabled: false }))
      expect(mgr.list()).toHaveLength(2)
    })

    it('listEnabled 只返回 enabled', () => {
      mgr.register(mockModel('m1'))
      mgr.register(mockModel('m2', { enabled: false }))
      expect(mgr.listEnabled()).toHaveLength(1)
      expect(mgr.listEnabled()[0]!.id).toBe('m1')
    })
  })

  describe('complete 补全', () => {
    it('使用默认模型', async () => {
      mgr.register(mockModel('m1'))
      const r = await mgr.complete({ messages: [{ role: 'user', content: 'hi' }] })
      expect(r.modelId).toBe('m1')
      expect(r.finishReason).toBe('stop')
    })

    it('使用指定模型', async () => {
      mgr.register(mockModel('m1'))
      mgr.register(mockModel('m2'))
      const r = await mgr.complete({ modelId: 'm2', messages: [{ role: 'user', content: 'hi' }] })
      expect(r.modelId).toBe('m2')
    })

    it('无默认模型抛错', async () => {
      await expect(mgr.complete({ messages: [] })).rejects.toThrow('No model configured')
    })

    it('模型不存在抛错', async () => {
      mgr.register(mockModel('m1'))
      await expect(mgr.complete({ modelId: 'not_exist', messages: [] })).rejects.toThrow(
        'not found',
      )
    })

    it('模型禁用抛错', async () => {
      mgr.register(mockModel('m1', { enabled: false }))
      await expect(mgr.complete({ messages: [] })).rejects.toThrow('disabled')
    })

    it('触发 completionRequested 事件', async () => {
      const handler = vi.fn()
      mgr.on('completionRequested', handler)
      mgr.register(mockModel('m1'))
      await mgr.complete({ messages: [] })
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('selectByCapability 能力路由', () => {
    it('返回具备能力的首个 enabled 模型', () => {
      mgr.register(mockModel('m1', { capabilities: ['chat'] }))
      mgr.register(mockModel('m2', { capabilities: ['chat', 'vision'] }))
      const m = mgr.selectByCapability('vision')
      expect(m?.id).toBe('m2')
    })

    it('无匹配返回 undefined', () => {
      mgr.register(mockModel('m1', { capabilities: ['chat'] }))
      expect(mgr.selectByCapability('vision')).toBeUndefined()
    })

    it('跳过禁用模型', () => {
      mgr.register(mockModel('m1', { capabilities: ['vision'], enabled: false }))
      mgr.register(mockModel('m2', { capabilities: ['vision'] }))
      const m = mgr.selectByCapability('vision')
      expect(m?.id).toBe('m2')
    })
  })

  describe('getStats 统计', () => {
    it('返回 total/enabled/providers/defaultModel', () => {
      mgr.register(mockModel('m1', { provider: 'openai' }))
      mgr.register(mockModel('m2', { provider: 'anthropic', enabled: false }))
      const s = mgr.getStats()
      expect(s.total).toBe(2)
      expect(s.enabled).toBe(1)
      expect(s.providers).toContain('openai')
      expect(s.providers).toContain('anthropic')
      expect(s.defaultModel).toBe('m1')
    })
  })

  describe('单例', () => {
    it('getModelManager 返回同一实例', () => {
      expect(getModelManager()).toBe(getModelManager())
    })
  })
})
