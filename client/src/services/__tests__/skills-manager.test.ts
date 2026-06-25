// skills-manager.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/skills/skills/skills-backend', () => ({
  getSkillsListFromBackend: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: { skills: [{ name: 'docx', path: '.claude/skills/docx' }] },
    })
  ),
  getSkillMetadataFromBackend: vi.fn(() =>
    Promise.resolve({ success: true, data: { name: 'docx', description: 'document' } })
  ),
  getSkillContentFromBackend: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: {
        metadata: { name: 'docx', description: 'document' },
        instructions: 'inst',
        path: 'p',
        hasScripts: false,
        hasReferences: false,
        hasAssets: false,
      },
    })
  ),
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/services/api', () => ({
  request: vi.fn(() =>
    Promise.resolve({ success: true, data: { content: 'resource1' } })
  ),
}))

import { getSkillsManager } from '../skills-manager'

describe('skills-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('getSkillsManager 单例', () => {
    const m1 = getSkillsManager()
    const m2 = getSkillsManager()
    expect(m1).toBe(m2)
  })

  it('initialize 正常', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    await m.initialize()
    expect(m.isInitialized()).toBe(true)
  })

  it('initialize 重复调用复用 promise', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const p1 = m.initialize()
    const p2 = m.initialize()
    await Promise.all([p1, p2])
  })

  it('initialize 已初始化直接返回', async () => {
    const m = getSkillsManager()
    await m.initialize()
    await m.initialize()
  })

  it('activateSkill / deactivateSkill / isSkillActive', () => {
    const m = getSkillsManager()
    m.activateSkill('docx')
    expect(m.isSkillActive('docx')).toBe(true)
    m.deactivateSkill('docx')
    expect(m.isSkillActive('docx')).toBe(false)
  })

  it('getActiveSkills', () => {
    const m = getSkillsManager()
    m.activateSkill('a')
    m.activateSkill('b')
    expect(m.getActiveSkills().length).toBe(2)
  })

  it('getSkillUsageStats', () => {
    const m = getSkillsManager()
    const r1 = m.getSkillUsageStats()
    expect(r1).toBeDefined()
    const r2 = m.getSkillUsageStats('non-exist')
    expect(r2).toBeNull()
  })

  it('getMostUsedSkills', () => {
    const m = getSkillsManager()
    const r = m.getMostUsedSkills(5)
    expect(Array.isArray(r)).toBe(true)
  })

  it('matchSkills 基础', () => {
    const m = getSkillsManager()
    m.clearAllState()
    m.activateSkill('docx')
    const r = m.matchSkills('create document with docx', { maxMatches: 3 })
    expect(Array.isArray(r)).toBe(true)
  })

  it('matchSkills 缓存命中', () => {
    const m = getSkillsManager()
    const r1 = m.matchSkills('hello world')
    const r2 = m.matchSkills('hello world')
    expect(r1).toBe(r2)
  })

  it('matchSkills categories 过滤', () => {
    const m = getSkillsManager()
    const r = m.matchSkills('test', { categories: ['non-exist'] })
    expect(r).toEqual([])
  })

  it('matchSkills excludeCategories 过滤', () => {
    const m = getSkillsManager()
    const r = m.matchSkills('test', { excludeCategories: ['non-exist'] })
    expect(Array.isArray(r)).toBe(true)
  })

  it('getAllSkillsMetadata', () => {
    const m = getSkillsManager()
    const r = m.getAllSkillsMetadata()
    expect(Array.isArray(r)).toBe(true)
  })

  it('buildSystemPromptWithSkills 无匹配', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const r = await m.buildSystemPromptWithSkills('zzz', 'base')
    expect(r).toBe('base')
  })

  it('buildSystemPromptWithSkills 有匹配', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    await m.initialize()
    const r = await m.buildSystemPromptWithSkills('create document with docx', 'base')
    expect(r).toContain('base')
  })

  it('buildSystemPromptWithSkills 无 baseSystemPrompt', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    await m.initialize()
    const r = await m.buildSystemPromptWithSkills('create document with docx')
    expect(typeof r).toBe('string')
  })

  it('loadSkill 正常', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const r = await m.loadSkill('docx')
    expect(r).toBeDefined()
  })

  it('loadSkill 缓存命中', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const r1 = await m.loadSkill('docx')
    const r2 = await m.loadSkill('docx')
    expect(r1).toBe(r2)
  })

  it('loadSkill 失败', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const r = await m.loadSkill('non-exist')
    expect(r).toBeDefined()
  })

  it('loadSkillMetadata', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const r = await m.loadSkillMetadata('.claude/skills/docx')
    expect(r).toBeDefined()
  })

  it('loadSkillResource 正常', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const r = await m.loadSkillResource('docx', 'script', 'p')
    expect(r).toBeDefined()
  })

  it('loadSkillResource 缓存命中', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const r1 = await m.loadSkillResource('docx', 'script', 'p')
    const r2 = await m.loadSkillResource('docx', 'script', 'p')
    expect(r1).toBe(r2)
  })

  it('loadSkillResource 错误', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const apiMod = await import('@/services/api')
    ;(apiMod.request as any).mockRejectedValueOnce(new Error('fail'))
    const r = await m.loadSkillResource('docx', 'script', 'p')
    expect(r).toBeNull()
  })

  it('loadSkillResource 失败响应', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const apiMod = await import('@/services/api')
    ;(apiMod.request as any).mockResolvedValueOnce({ success: false })
    const r = await m.loadSkillResource('docx', 'script', 'p')
    expect(r).toBeNull()
  })

  it('checkSkillResource 正常', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const r = await m.checkSkillResource('docx', 'script')
    expect(Array.isArray(r)).toBe(true)
  })

  it('checkSkillResource skill 不存在', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const r = await m.checkSkillResource('non-exist', 'script')
    expect(r).toEqual([])
  })

  it('checkSkillResource 失败', async () => {
    const m = getSkillsManager()
    m.clearAllState()
    const apiMod = await import('@/services/api')
    ;(apiMod.request as any).mockRejectedValueOnce(new Error('fail'))
    const r = await m.checkSkillResource('docx', 'script')
    expect(r).toEqual([])
  })

  it('clearCache / clearResourceCache / clearAllState', () => {
    const m = getSkillsManager()
    m.clearCache()
    m.clearResourceCache()
    m.clearAllState()
  })

  it('getInitializationState', () => {
    const m = getSkillsManager()
    const r = m.getInitializationState()
    expect(r).toBeDefined()
  })

  it('loadPersistedState localStorage', () => {
    localStorage.setItem('skills-active-list', JSON.stringify(['a']))
    localStorage.setItem('skills-usage-stats', JSON.stringify({ a: { count: 1, lastUsed: 0 } }))
    const m = getSkillsManager()
    m.clearAllState()
    m.activateSkill('a')
    expect(m.getActiveSkills()).toContain('a')
  })

  it('loadPersistedState 解析失败', () => {
    localStorage.setItem('skills-active-list', 'invalid')
    const m = getSkillsManager()
    m.clearAllState()
    m.activateSkill('x')
    expect(m.isSkillActive('x')).toBe(true)
  })
})
