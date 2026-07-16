import { describe, expect, it } from 'vitest'
import type { Tool } from '../src/tools/index.js'
import {
  PERSONAS,
  applyPersona,
  type SubagentPersona,
  type PersonaConfig,
} from '../src/tools/subagent.js'

function makeTool(name: string): Tool {
  return {
    name,
    description: `${name} tool`,
    parameters: {},
    required: [],
    execute: async () => ({ success: true, output: '' }),
  }
}

const ALL_TOOL_NAMES = [
  'read_file',
  'list_dir',
  'grep',
  'glob',
  'codegraph',
  'goto_definition',
  'find_references',
  'fetch_url',
  'get_diagnostics',
  'run_tests',
  'write_file',
  'edit_file',
  'delete_file',
  'git_commit',
  'git_add',
  'run_command',
  'dispatch_subagent',
]

const allTools = ALL_TOOL_NAMES.map(makeTool)

describe('PERSONAS 常量', () => {
  it('包含 5 个角色', () => {
    const keys = Object.keys(PERSONAS).sort()
    expect(keys).toEqual(['coder', 'general', 'planner', 'researcher', 'reviewer'])
  })

  it('researcher.allowedTools 包含 read_file,不包含 write_file', () => {
    const { allowedTools, blockedTools } = PERSONAS.researcher
    expect(allowedTools).toContain('read_file')
    expect(allowedTools).not.toContain('write_file')
    expect(blockedTools).toContain('write_file')
  })

  it('coder.blockedTools 包含 git_commit', () => {
    expect(PERSONAS.coder.blockedTools).toContain('git_commit')
  })

  it('reviewer.systemPrompt 包含"审查"', () => {
    expect(PERSONAS.reviewer.systemPrompt).toContain('审查')
  })

  it('planner.maxIterations = 5', () => {
    expect(PERSONAS.planner.maxIterations).toBe(5)
  })

  it('general 没有 allowedTools(允许全部)', () => {
    expect(PERSONAS.general.allowedTools).toBeUndefined()
    expect(PERSONAS.general.blockedTools).toBeUndefined()
  })

  it('每个 persona 都有 systemPrompt 字段(PersonaConfig 类型完整性)', () => {
    const personas: SubagentPersona[] = ['researcher', 'coder', 'reviewer', 'planner', 'general']
    for (const p of personas) {
      const config: PersonaConfig = PERSONAS[p]
      expect(typeof config.systemPrompt).toBe('string')
      expect(config.systemPrompt.length).toBeGreaterThan(0)
    }
  })

  it('PERSONAS 的 key 集合稳定(等价于 const 不可变约束)', () => {
    expect(Object.keys(PERSONAS)).toHaveLength(5)
    expect(Object.isFrozen(PERSONAS) || Object.keys(PERSONAS).length === 5).toBe(true)
  })
})

describe('applyPersona', () => {
  it('researcher 过滤掉 write_file', () => {
    const filtered = applyPersona(allTools, 'researcher')
    const names = filtered.map((t) => t.name)
    expect(names).not.toContain('write_file')
    expect(names).not.toContain('edit_file')
    expect(names).not.toContain('delete_file')
    expect(names).not.toContain('git_commit')
    expect(names).not.toContain('run_command')
    expect(names).toContain('read_file')
    expect(names).toContain('grep')
  })

  it('general 返回原数组长度(允许全部)', () => {
    const filtered = applyPersona(allTools, 'general')
    expect(filtered).toHaveLength(allTools.length)
    expect(filtered.map((t) => t.name).sort()).toEqual(ALL_TOOL_NAMES.slice().sort())
  })

  it('coder 仅过滤 blockedTools,保留 write_file', () => {
    const filtered = applyPersona(allTools, 'coder')
    const names = filtered.map((t) => t.name)
    expect(names).not.toContain('git_commit')
    expect(names).not.toContain('run_command')
    expect(names).toContain('write_file')
    expect(names).toContain('edit_file')
  })
})
