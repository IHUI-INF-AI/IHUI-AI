// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 任务 1（P0-03）枚举契约测试：角色 10 + custom、编排模式 9 + 别名归一。
 */

import { describe, expect, it } from 'vitest'
import {
  AGENT_ROLES,
  AGENT_ROLE_VALUES,
  ORCHESTRATION_MODE_ALIASES,
  ORCHESTRATION_MODES,
  isAgentRole,
  isBuiltinAgentRole,
  isOrchestrationMode,
  isOrchestrationModeAlias,
  normalizeOrchestrationMode,
} from '../contracts'

describe('AgentRole', () => {
  it('10 个内置角色 + custom，旧 5 值全部保留', () => {
    expect(AGENT_ROLES).toHaveLength(10)
    expect(AGENT_ROLE_VALUES).toHaveLength(11)
    expect(new Set(AGENT_ROLE_VALUES).size).toBe(11)
    for (const legacy of ['researcher', 'coder', 'reviewer', 'architect', 'debugger']) {
      expect(AGENT_ROLES).toContain(legacy)
    }
    expect(AGENT_ROLE_VALUES).toContain('custom')
    expect(AGENT_ROLE_VALUES.slice(0, AGENT_ROLES.length)).toEqual([...AGENT_ROLES])
  })

  it('10 角色与 ai-service prompt_registry.DEFAULT_PROMPTS 对齐', () => {
    expect(AGENT_ROLES).toEqual([
      'researcher',
      'coder',
      'reviewer',
      'architect',
      'debugger',
      'frontend-dev',
      'backend-dev',
      'devops',
      'security-auditor',
      'test-engineer',
    ])
  })

  it('守卫区分内置角色与 custom', () => {
    expect(isBuiltinAgentRole('coder')).toBe(true)
    expect(isBuiltinAgentRole('custom')).toBe(false)
    expect(isAgentRole('custom')).toBe(true)
    expect(isAgentRole('orchestrator')).toBe(false)
    expect(isAgentRole('CODER')).toBe(false)
  })
})

describe('OrchestrationMode', () => {
  it('9 个规范模式，封闭集', () => {
    expect(ORCHESTRATION_MODES).toEqual([
      'single',
      'parallel',
      'pipeline',
      'debate',
      'vote',
      'critique',
      'decomposed',
      'team',
      'recursive',
    ])
    expect(new Set(ORCHESTRATION_MODES).size).toBe(9)
  })

  it('decompose / with_communication 归一为规范值', () => {
    expect(normalizeOrchestrationMode('decompose')).toBe('decomposed')
    expect(normalizeOrchestrationMode('with_communication')).toBe('team')
    expect(normalizeOrchestrationMode('decomposed')).toBe('decomposed')
    expect(normalizeOrchestrationMode('team')).toBe('team')
    expect(normalizeOrchestrationMode('nope')).toBeUndefined()
  })

  it('别名表只指向规范值', () => {
    expect(Object.keys(ORCHESTRATION_MODE_ALIASES)).toEqual(['decompose', 'with_communication'])
    for (const target of Object.values(ORCHESTRATION_MODE_ALIASES)) {
      expect(isOrchestrationMode(target)).toBe(true)
    }
    expect(isOrchestrationModeAlias('decompose')).toBe(true)
    expect(isOrchestrationModeAlias('decomposed')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
