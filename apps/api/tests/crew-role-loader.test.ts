import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadCrewRoles, __resetCrewRoleLoaderForTests } from '../src/services/crew-role-loader.js'

describe('crew-role-loader', () => {
  const ORIGINAL_ENV = { ...process.env }
  const originalWarn = console.warn
  const warns: string[] = []

  beforeEach(() => {
    __resetCrewRoleLoaderForTests()
    delete process.env.CREW_ROLES_JSON
    warns.length = 0
    console.warn = (msg: string, ...args: unknown[]) => {
      warns.push(`${msg} ${args.map((a) => String(a)).join(' ')}`)
    }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    __resetCrewRoleLoaderForTests()
    console.warn = originalWarn
  })

  it('无 env → 加载内置 crew-roles.json, 5 个角色齐全', () => {
    const roles = loadCrewRoles()
    expect(Object.keys(roles).sort()).toEqual([
      'executor',
      'planner',
      'reporter',
      'researcher',
      'reviewer',
    ])
    expect(roles.planner?.goal).toContain('任务分解')
    expect(roles.researcher?.tools).toContain('rag_search')
    expect(roles.executor?.tools).toContain('coze_workflow')
  })

  it('CREW_ROLES_JSON env → 覆盖内置', () => {
    process.env.CREW_ROLES_JSON = JSON.stringify({
      planner: {
        role: 'planner',
        goal: 'CUSTOM_GOAL',
        backstory: 'CUSTOM_BACKSTORY',
        llmModelId: 'gpt-4',
        tools: ['custom_tool'],
        allowDelegation: false,
        verbose: false,
      },
    })
    const roles = loadCrewRoles()
    expect(roles.planner?.goal).toBe('CUSTOM_GOAL')
    expect(roles.planner?.backstory).toBe('CUSTOM_BACKSTORY')
    expect(roles.planner?.llmModelId).toBe('gpt-4')
    // 其他角色被过滤掉(只保留解析成功的)
    expect(roles.researcher).toBeUndefined()
  })

  it('CREW_ROLES_JSON 是非法 JSON → fallback + warn', () => {
    process.env.CREW_ROLES_JSON = '{ invalid json'
    const roles = loadCrewRoles()
    // fallback 仍有 5 个角色
    expect(Object.keys(roles).length).toBe(5)
    expect(warns.some((w) => w.includes('JSON 解析失败'))).toBe(true)
  })

  it('CREW_ROLES_JSON 顶层不是对象 → fallback + warn', () => {
    process.env.CREW_ROLES_JSON = '[]'
    const roles = loadCrewRoles()
    expect(Object.keys(roles).length).toBe(5)
    expect(warns.some((w) => w.includes('顶层不是对象'))).toBe(true)
  })

  it('角色缺少必要字段 (role/goal/backstory) → 跳过该角色 + warn', () => {
    process.env.CREW_ROLES_JSON = JSON.stringify({
      planner: { goal: 'G', backstory: 'B' }, // 缺 role
      reporter: { role: 'reporter', goal: 'G2', backstory: 'B2' }, // 完整
    })
    const roles = loadCrewRoles()
    expect(roles.planner).toBeUndefined()
    expect(roles.reporter?.goal).toBe('G2')
    expect(warns.some((w) => w.includes('缺少必要字段'))).toBe(true)
  })

  it('cached: 多次调用返回同一引用', () => {
    const a = loadCrewRoles()
    const b = loadCrewRoles()
    expect(a).toBe(b)
  })

  it('__resetCrewRoleLoaderForTests 后, env 变更生效', () => {
    process.env.CREW_ROLES_JSON = JSON.stringify({
      planner: { role: 'planner', goal: 'A', backstory: 'B' },
    })
    const a = loadCrewRoles()
    expect(a.planner?.goal).toBe('A')

    process.env.CREW_ROLES_JSON = JSON.stringify({
      planner: { role: 'planner', goal: 'C', backstory: 'D' },
    })
    const b = loadCrewRoles()
    // 未 reset → cached 仍是 A
    expect(b.planner?.goal).toBe('A')

    __resetCrewRoleLoaderForTests()
    const c = loadCrewRoles()
    expect(c.planner?.goal).toBe('C')
  })

  it('tools 字段非数组 → 视为空数组', () => {
    process.env.CREW_ROLES_JSON = JSON.stringify({
      planner: {
        role: 'planner',
        goal: 'G',
        backstory: 'B',
        tools: 'not-an-array' as unknown as string[],
      },
    })
    const roles = loadCrewRoles()
    expect(roles.planner?.tools).toEqual([])
  })

  it('tools 数组含非字符串 → 仅保留字符串', () => {
    process.env.CREW_ROLES_JSON = JSON.stringify({
      planner: {
        role: 'planner',
        goal: 'G',
        backstory: 'B',
        tools: ['valid', 123, null, 'also-valid'] as unknown as string[],
      },
    })
    const roles = loadCrewRoles()
    expect(roles.planner?.tools).toEqual(['valid', 'also-valid'])
  })

  it('以 _ 开头的字段被当作注释跳过', () => {
    process.env.CREW_ROLES_JSON = JSON.stringify({
      _comment: 'this is a comment',
      _version: 2,
      planner: { role: 'planner', goal: 'G', backstory: 'B' },
    })
    const roles = loadCrewRoles()
    expect(roles.planner?.goal).toBe('G')
    // _comment / _version 不应作为角色
    expect(Object.keys(roles)).toEqual(['planner'])
  })
})
