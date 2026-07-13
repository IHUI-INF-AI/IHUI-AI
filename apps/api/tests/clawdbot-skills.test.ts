import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }))

vi.mock('../src/services/clawdbot/tools.js', () => ({
  getToolExecutor: () => ({ execute: executeMock }),
}))

import { SkillManager, getSkillManager } from '../src/services/clawdbot/skills.js'
import type { SkillDefinition } from '../src/services/clawdbot/skills.js'

const mockSkill = (
  name: string,
  overrides: Partial<SkillDefinition> = {},
): Omit<SkillDefinition, 'installedAt'> => ({
  name,
  description: `Skill ${name}`,
  version: '1.0.0',
  category: 'test',
  steps: [],
  enabled: true,
  source: 'custom',
  ...overrides,
})

describe('clawdbot SkillManager 技能系统', () => {
  let mgr: SkillManager

  beforeEach(() => {
    mgr = new SkillManager()
    executeMock.mockReset()
  })

  describe('install / uninstall', () => {
    it('install 注册技能并设置 installedAt', () => {
      mgr.install(mockSkill('s1'))
      const s = mgr.get('s1')
      expect(s).toBeDefined()
      expect(s!.installedAt).toBeGreaterThan(0)
    })

    it('install 触发 installed 事件', () => {
      const handler = vi.fn()
      mgr.on('installed', handler)
      mgr.install(mockSkill('s1'))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('uninstall 删除技能返回 true', () => {
      mgr.install(mockSkill('s1'))
      expect(mgr.uninstall('s1')).toBe(true)
      expect(mgr.get('s1')).toBeUndefined()
    })

    it('uninstall 不存在返回 false', () => {
      expect(mgr.uninstall('not_exist')).toBe(false)
    })

    it('uninstall 触发 uninstalled 事件', () => {
      const handler = vi.fn()
      mgr.on('uninstalled', handler)
      mgr.install(mockSkill('s1'))
      mgr.uninstall('s1')
      expect(handler).toHaveBeenCalledWith('s1')
    })
  })

  describe('list / listByCategory', () => {
    it('list 返回全部', () => {
      mgr.install(mockSkill('s1', { category: 'a' }))
      mgr.install(mockSkill('s2', { category: 'b' }))
      expect(mgr.list()).toHaveLength(2)
    })

    it('listByCategory 过滤分类', () => {
      mgr.install(mockSkill('s1', { category: 'a' }))
      mgr.install(mockSkill('s2', { category: 'b' }))
      mgr.install(mockSkill('s3', { category: 'a' }))
      expect(mgr.listByCategory('a')).toHaveLength(2)
    })
  })

  describe('execute 执行', () => {
    it('技能不存在抛错', async () => {
      await expect(mgr.execute('not_exist', {})).rejects.toThrow('not found')
    })

    it('技能禁用抛错', async () => {
      mgr.install(mockSkill('s1', { enabled: false }))
      await expect(mgr.execute('s1', {})).rejects.toThrow('disabled')
    })

    it('执行空步骤技能返回 success', async () => {
      mgr.install(mockSkill('s1'))
      const r = await mgr.execute('s1', {})
      expect(r.success).toBe(true)
      expect(r.stepResults).toEqual([])
    })

    it('执行带 tool 步骤的技能（成功）', async () => {
      executeMock.mockResolvedValueOnce({ success: true, output: 'ok', duration: 5 })
      mgr.install(
        mockSkill('s1', {
          steps: [
            { id: 'step1', name: 'S1', toolName: 'tool1', toolParams: { x: 1 }, outputKey: 'out' },
          ],
        }),
      )
      const r = await mgr.execute('s1', {})
      expect(r.success).toBe(true)
      expect(r.outputs.out).toBe('ok')
    })

    it('工具失败时技能失败', async () => {
      executeMock.mockResolvedValueOnce({ success: false, error: 'tool failed', duration: 0 })
      mgr.install(
        mockSkill('s1', {
          steps: [{ id: 'step1', name: 'S1', toolName: 'tool1' }],
        }),
      )
      const r = await mgr.execute('s1', {})
      expect(r.success).toBe(false)
    })

    it('condition 不匹配时步骤跳过', async () => {
      executeMock.mockResolvedValueOnce({ success: true, output: 'ok', duration: 1 })
      mgr.install(
        mockSkill('s1', {
          steps: [
            { id: 's_cond', name: 'Cond', condition: 'ctx.flag === true' },
            { id: 's_tool', name: 'Tool', toolName: 'tool1' },
          ],
        }),
      )
      const r = await mgr.execute('s1', { flag: false })
      expect(r.success).toBe(true)
      expect(r.stepResults[0]!.output).toBe('skipped')
    })

    it('resolveParams 解析 ${path} 模板', async () => {
      executeMock.mockResolvedValueOnce({ success: true, output: 'ok', duration: 1 })
      mgr.install(
        mockSkill('s1', {
          steps: [
            {
              id: 's1',
              name: 'S1',
              toolName: 'tool1',
              toolParams: { user: '${user.name}' },
            },
          ],
        }),
      )
      await mgr.execute('s1', { user: { name: 'alice' } })
      expect(executeMock).toHaveBeenCalledWith('tool1', { user: 'alice' }, undefined)
    })
  })

  describe('getStats', () => {
    it('返回 total/enabled/categories', () => {
      mgr.install(mockSkill('s1', { category: 'a' }))
      mgr.install(mockSkill('s2', { category: 'a', enabled: false }))
      const s = mgr.getStats()
      expect(s.total).toBe(2)
      expect(s.enabled).toBe(1)
      expect(s.categories).toContain('a')
    })
  })

  describe('单例', () => {
    it('getSkillManager 返回同一实例', () => {
      expect(getSkillManager()).toBe(getSkillManager())
    })
  })
})
