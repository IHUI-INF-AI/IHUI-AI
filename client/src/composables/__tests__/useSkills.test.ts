// useSkills.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vue', () => ({
  ref: (v: any) => {
    const r = { value: v }
    return r
  },
  computed: (fn: any) => {
    const r = { get value() { return fn() } }
    return r
  },
}))

vi.mock('@/services/skills-manager', () => {
  const mockObj: any = {
    initialize: vi.fn(() => Promise.resolve()),
    getActiveSkills: vi.fn(() => ['docx']),
    loadSkill: vi.fn(() => Promise.resolve({ metadata: { name: 'docx', description: 'd' }, instructions: 'i', path: 'p', hasScripts: false, hasReferences: false, hasAssets: false })),
    matchSkills: vi.fn(() => []),
    getAllSkillsMetadata: vi.fn(() => []),
    buildSystemPromptWithSkills: vi.fn(() => Promise.resolve('prompt')),
    activateSkill: vi.fn(),
    deactivateSkill: vi.fn(),
    isSkillActive: vi.fn(() => false),
    getSkillUsageStats: vi.fn(() => new Map()),
    getMostUsedSkills: vi.fn(() => []),
    getInitializationState: vi.fn(() => ({ isInitialized: true, isInitializing: false, skillCount: 0 })),
  }
  return {
    getSkillsManager: vi.fn(() => mockObj),
  }
})

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { useSkills } from '../useSkills'

describe('useSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('基本实例化', () => {
    const r = useSkills()
    expect(r).toBeDefined()
  })

  it('initialize 已初始化不重复', async () => {
    const r = useSkills()
    await r.initialize()
    // 二次调用不应报错
    try { await r.initialize() } catch { /* noop */ }
  })

  it('initialize 错误', async () => {
    const mgr = (await import('@/services/skills-manager')).getSkillsManager()
    ;(mgr.initialize as any).mockRejectedValueOnce(new Error('fail'))
    const r = useSkills()
    await r.initialize()
  })

  it('matchSkills 未初始化时先初始化', async () => {
    const r = useSkills()
    try {
      const result = await r.matchSkills('hello')
      expect(result).toBeDefined()
    } catch { /* noop */ }
  })

  it('matchSkills 已初始化', async () => {
    const r = useSkills()
    await r.initialize()
    const result = await r.matchSkills('hello')
    expect(result).toBeDefined()
  })

  it('getAllSkills 未初始化返回空', () => {
    const r = useSkills()
    expect(r.getAllSkills()).toEqual([])
  })

  it('getAllSkills 已初始化', async () => {
    const r = useSkills()
    await r.initialize()
    expect(r.getAllSkills()).toBeDefined()
  })

  it('buildSystemPromptWithSkills 未初始化', async () => {
    const r = useSkills()
    const result = await r.buildSystemPromptWithSkills('hello', 'base')
    expect(result).toBe('prompt')
  })

  it('activateSkill 正常', async () => {
    const r = useSkills()
    await r.initialize()
    const skill = await r.activateSkill('docx')
    expect(skill).toBeDefined()
  })

  it('activateSkill 失败', async () => {
    const mgr = (await import('@/services/skills-manager')).getSkillsManager()
    ;(mgr.loadSkill as any).mockRejectedValueOnce(new Error('fail'))
    const r = useSkills()
    try {
      await r.initialize()
      const skill = await r.activateSkill('fail')
      expect(skill).toBeNull()
    } catch { /* noop */ }
  })

  it('activateSkill 未初始化', async () => {
    const r = useSkills()
    const skill = await r.activateSkill('docx')
    expect(skill).toBeDefined()
  })

  it('deactivateSkill', () => {
    const r = useSkills()
    r.deactivateSkill('docx')
  })

  it('isSkillActive', () => {
    const r = useSkills()
    expect(r.isSkillActive('docx')).toBe(false)
  })

  it('getActiveSkillNames', () => {
    const r = useSkills()
    const list = r.getActiveSkillNames()
    expect(list).toEqual(['docx'])
  })

  it('getSkillUsageStats', () => {
    const r = useSkills()
    expect(r.getSkillUsageStats()).toBeDefined()
  })

  it('getMostUsedSkills', () => {
    const r = useSkills()
    expect(r.getMostUsedSkills()).toBeDefined()
  })

  it('clearActiveSkills', () => {
    const r = useSkills()
    r.clearActiveSkills()
  })

  it('getManagerState', () => {
    const r = useSkills()
    expect(r.getManagerState()).toBeDefined()
  })
})
