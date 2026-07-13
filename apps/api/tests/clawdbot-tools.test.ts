import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ToolExecutor } from '../src/services/clawdbot/tools.js'
import type { ToolDefinition, ToolHandler, ToolContext } from '../src/services/clawdbot/tools.js'

const mockDef = (name: string, enabled = true, permissions?: string[]): ToolDefinition => ({
  name,
  description: `Tool ${name}`,
  category: 'test',
  parameters: {},
  permissions,
  enabled,
})

const successHandler: ToolHandler = async () => ({ success: true, output: 'ok' })

describe('clawdbot ToolExecutor 工具系统', () => {
  let exec: ToolExecutor

  beforeEach(() => {
    exec = new ToolExecutor()
  })

  describe('注册与注销', () => {
    it('register 注册工具', () => {
      exec.register(mockDef('tool1'), successHandler)
      expect(exec.getTool('tool1')).toBeDefined()
    })

    it('register 触发 registered 事件', () => {
      const handler = vi.fn()
      exec.on('registered', handler)
      const def = mockDef('tool1')
      exec.register(def, successHandler)
      expect(handler).toHaveBeenCalledWith(def)
    })

    it('unregister 注销工具返回 true', () => {
      exec.register(mockDef('tool1'), successHandler)
      expect(exec.unregister('tool1')).toBe(true)
      expect(exec.getTool('tool1')).toBeUndefined()
    })

    it('unregister 不存在返回 false', () => {
      expect(exec.unregister('nonexistent')).toBe(false)
    })

    it('unregister 触发 unregistered 事件', () => {
      exec.register(mockDef('tool1'), successHandler)
      const handler = vi.fn()
      exec.on('unregistered', handler)
      exec.unregister('tool1')
      expect(handler).toHaveBeenCalledWith('tool1')
    })
  })

  describe('执行工具', () => {
    it('execute 成功返回结果', async () => {
      exec.register(mockDef('tool1'), successHandler)
      const result = await exec.execute('tool1', {})
      expect(result.success).toBe(true)
      expect(result.output).toBe('ok')
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('execute 不存在的工具返回错误', async () => {
      const result = await exec.execute('nonexistent', {})
      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('execute 禁用的工具返回错误', async () => {
      exec.register(mockDef('tool1', false), successHandler)
      const result = await exec.execute('tool1', {})
      expect(result.success).toBe(false)
      expect(result.error).toContain('disabled')
    })

    it('execute handler 抛错时返回错误', async () => {
      const errHandler: ToolHandler = async () => {
        throw new Error('handler error')
      }
      exec.register(mockDef('tool1'), errHandler)
      const result = await exec.execute('tool1', {})
      expect(result.success).toBe(false)
      expect(result.error).toBe('handler error')
    })

    it('execute 触发 executed 事件', async () => {
      exec.register(mockDef('tool1'), successHandler)
      const handler = vi.fn()
      exec.on('executed', handler)
      await exec.execute('tool1', {})
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('execute 传递 params 与 context 给 handler', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true })
      exec.register(mockDef('tool1'), handler)
      const ctx: ToolContext = { userId: 'u1', sessionId: 's1' }
      await exec.execute('tool1', { key: 'val' }, ctx)
      expect(handler).toHaveBeenCalledWith({ key: 'val' }, ctx)
    })
  })

  describe('权限检查', () => {
    it('无权限要求的工具直接放行', async () => {
      exec.register(mockDef('tool1', true), successHandler)
      const result = await exec.execute('tool1', {})
      expect(result.success).toBe(true)
    })

    it('有权限要求但 context 无权限时拒绝', async () => {
      exec.register(mockDef('tool1', true, ['admin']), successHandler)
      const result = await exec.execute('tool1', {})
      expect(result.success).toBe(false)
      expect(result.error).toBe('Permission denied')
    })

    it('context 权限不包含所需权限时拒绝', async () => {
      exec.register(mockDef('tool1', true, ['admin']), successHandler)
      const result = await exec.execute('tool1', {}, { permissions: ['user'] })
      expect(result.success).toBe(false)
    })

    it('context 权限包含所有所需权限时放行', async () => {
      exec.register(mockDef('tool1', true, ['read', 'write']), successHandler)
      const result = await exec.execute('tool1', {}, { permissions: ['read', 'write', 'admin'] })
      expect(result.success).toBe(true)
    })

    it('缺少部分所需权限时拒绝', async () => {
      exec.register(mockDef('tool1', true, ['read', 'write']), successHandler)
      const result = await exec.execute('tool1', {}, { permissions: ['read'] })
      expect(result.success).toBe(false)
    })
  })

  describe('查询与统计', () => {
    it('getTool 返回工具定义', () => {
      exec.register(mockDef('tool1'), successHandler)
      const def = exec.getTool('tool1')
      expect(def).toBeDefined()
      expect(def!.name).toBe('tool1')
    })

    it('getTool 不存在返回 undefined', () => {
      expect(exec.getTool('nonexistent')).toBeUndefined()
    })

    it('getAllTools 返回所有工具', () => {
      exec.register(mockDef('tool1'), successHandler)
      exec.register(mockDef('tool2'), successHandler)
      expect(exec.getAllTools().length).toBe(2)
    })

    it('getToolsByCategory 按分类过滤', () => {
      exec.register(mockDef('tool1'), successHandler)
      const def2 = mockDef('tool2')
      def2.category = 'other'
      exec.register(def2, successHandler)
      expect(exec.getToolsByCategory('test').length).toBe(1)
      expect(exec.getToolsByCategory('other').length).toBe(1)
    })

    it('getStats 返回统计', () => {
      exec.register(mockDef('tool1', true), successHandler)
      exec.register(mockDef('tool2', false), successHandler)
      const stats = exec.getStats()
      expect(stats.total).toBe(2)
      expect(stats.enabled).toBe(1)
      expect(stats.categories).toContain('test')
    })
  })

  describe('getToolExecutor 单例', () => {
    it('返回同一实例', async () => {
      const mod = await import('../src/services/clawdbot/tools.js')
      expect(mod.getToolExecutor()).toBe(mod.getToolExecutor())
    })
  })
})
