// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { formatConfigSnapshot, resolveEffectiveOverrides } from '../src/subagents/precedence.js'
import type {
  EffectiveRuntimeConfig,
  PersonaMap,
  SubagentRole,
  SubagentRuntimeOverrides,
} from '../src/subagents/types.js'

/**
 * G-395 请求档 vs 实得档留痕 + 出处标签(四层各命中一次)。
 * 判据本体只在 precedence.ts `resolveEffectiveOverrides` 一处,本文件不复制任何层名/档位表。
 */

/** 静默留痕出口:本文件只判返回值,不往 stderr 打噪声 */
const QUIET = { traceSink: null } as const

function resolve(
  overrides: SubagentRuntimeOverrides,
  role?: SubagentRole,
  personas: PersonaMap = {},
): EffectiveRuntimeConfig {
  return resolveEffectiveOverrides(overrides, role, personas, undefined, role?.name, QUIET)
}

const ROLE: SubagentRole = {
  name: 'coder',
  model: 'sonnet',
  reasoningEffort: 'low',
  defaultCapabilityMode: 'read-only',
  defaultIsolation: 'worktree',
}

const PERSONAS: PersonaMap = {
  p1: {
    name: 'p1',
    model: 'haiku',
    reasoningEffort: 'minimal',
    defaultIsolation: 'subprocess',
  },
}

describe('G-395 effortResolution:请求档 vs 实得档(总是携带)', () => {
  it('explicit 命中 ⇒ 两档一致(matched=true),双方出处都指向 explicit', () => {
    const r = resolve({ reasoningEffort: 'high', persona: 'p1' }, ROLE, PERSONAS)
    expect(r.effortResolution.requestedEffort).toBe('high')
    expect(r.effortResolution.effectiveEffort).toBe('high')
    expect(r.effortResolution.requestedEffortSource).toEqual({
      layer: 'explicit',
      origin: 'overrides.reasoningEffort',
    })
    expect(r.effortResolution.effectiveEffortSource).toEqual({
      layer: 'explicit',
      origin: 'overrides.reasoningEffort',
    })
    expect(r.effortResolution.matched).toBe(true)
    // 两档一致 ⇒ 无降档留痕(告警面只在两档不一致时存在)
    expect(r.effortDowngrade).toBeUndefined()
    // 短路顺序未变:explicit 压过 role('low') / persona('minimal')
    expect(r.reasoningEffort).toBe('high')
  })

  it('role 命中 ⇒ 请求档与实得档同源(role)且一致', () => {
    const r = resolve({ persona: 'p1' }, ROLE, PERSONAS)
    expect(r.effortResolution.requestedEffort).toBe('low')
    expect(r.effortResolution.effectiveEffort).toBe('low')
    expect(r.effortResolution.effectiveEffortSource).toEqual({
      layer: 'role',
      origin: 'role[coder].reasoningEffort',
    })
    expect(r.effortResolution.matched).toBe(true)
  })

  it('persona 命中 ⇒ 请求档与实得档同源(persona)且一致', () => {
    const r = resolve({ persona: 'p1' }, undefined, PERSONAS)
    expect(r.effortResolution.requestedEffort).toBe('minimal')
    expect(r.effortResolution.effectiveEffort).toBe('minimal')
    expect(r.effortResolution.effectiveEffortSource).toEqual({
      layer: 'persona',
      origin: 'persona[p1].reasoningEffort',
    })
    expect(r.effortResolution.matched).toBe(true)
  })

  it('四层全空 ⇒ requested 缺省、effective 缺省,matched=null(不写 false 冒充)', () => {
    const r = resolve({})
    expect(r.reasoningEffort).toBeUndefined()
    expect(r.effortResolution.requestedEffort).toBeUndefined()
    expect(r.effortResolution.requestedEffortSource).toBeUndefined()
    expect(r.effortResolution.effectiveEffort).toBeUndefined()
    expect(r.effortResolution.effectiveEffortSource).toEqual({
      layer: 'parent',
      origin: 'parent(inherit)',
    })
    expect(r.effortResolution.matched).toBeNull()
    expect(r.effortDowngrade).toBeUndefined()
  })

  it('请求档 ≠ 实得档(非法枚举被容错)⇒ 两者都留痕,请求档原样保留', () => {
    // 模拟运行时从 JSON 收到非法档位(as 绕过编译期类型)
    const r = resolve({ reasoningEffort: 'ultra' as 'high', persona: 'p1' }, ROLE, PERSONAS)
    expect(r.effortResolution.requestedEffort).toBe('ultra')
    expect(r.effortResolution.requestedEffortSource?.layer).toBe('explicit')
    expect(r.effortResolution.effectiveEffort).toBe('low')
    expect(r.effortResolution.effectiveEffortSource?.layer).toBe('role')
    expect(r.effortResolution.matched).toBe(false)
    // 同一批候选:降档告警面与对照面读到的两档必须一致(非第二份真相)
    expect(r.effortDowngrade?.requested).toBe(r.effortResolution.requestedEffort)
    expect(r.effortDowngrade?.effective).toBe(r.effortResolution.effectiveEffort)
    expect(r.effortDowngrade?.reason).toBe('invalid-enum')
  })

  it('请求档非法且四层全空 ⇒ 请求档留痕、实得档缺省、matched=false', () => {
    const r = resolve({ reasoningEffort: 'turbo' as 'high' })
    expect(r.effortResolution.requestedEffort).toBe('turbo')
    expect(r.effortResolution.effectiveEffort).toBeUndefined()
    expect(r.effortResolution.matched).toBe(false)
  })
})

describe('G-395 出处标签:四层各命中一次 ⇒ source 正确', () => {
  it('model:explicit / role / persona / parent 四层', () => {
    expect(resolve({ model: 'gpt-4', persona: 'p1' }, ROLE, PERSONAS).sources.model).toEqual({
      layer: 'explicit',
      origin: 'overrides.model',
    })
    expect(resolve({ persona: 'p1' }, ROLE, PERSONAS).sources.model).toEqual({
      layer: 'role',
      origin: 'role[coder].model',
    })
    expect(resolve({ persona: 'p1' }, undefined, PERSONAS).sources.model).toEqual({
      layer: 'persona',
      origin: 'persona[p1].model',
    })
    expect(resolve({}).sources.model).toEqual({ layer: 'parent', origin: 'parent(inherit)' })
  })

  it('isolation:explicit / role / persona 命中,全空时 parent 默认 none', () => {
    expect(resolve({ isolation: 'none', persona: 'p1' }, ROLE, PERSONAS).sources.isolation).toEqual(
      { layer: 'explicit', origin: 'overrides.isolation' },
    )
    expect(resolve({ persona: 'p1' }, ROLE, PERSONAS).sources.isolation).toEqual({
      layer: 'role',
      origin: 'role[coder].defaultIsolation',
    })
    expect(resolve({ persona: 'p1' }, undefined, PERSONAS).sources.isolation).toEqual({
      layer: 'persona',
      origin: 'persona[p1].defaultIsolation',
    })
    const parent = resolve({})
    expect(parent.isolation).toBe('none')
    expect(parent.sources.isolation).toEqual({ layer: 'parent', origin: 'default:none' })
  })

  it('capabilityMode:explicit 命中;非法 explicit 容错后出处归 role', () => {
    expect(resolve({ capabilityMode: 'all' }, ROLE).sources.capabilityMode).toEqual({
      layer: 'explicit',
      origin: 'overrides.capabilityMode',
    })
    const r = resolve({ capabilityMode: 'invalid' as 'all' }, ROLE)
    expect(r.capabilityMode).toBe('read-only')
    expect(r.sources.capabilityMode.layer).toBe('role')
  })
})

describe('G-395 快照单点渲染:请求档 vs 实得档进同一行', () => {
  it('两档一致时也出现 requested/effective/matched', () => {
    const line = formatConfigSnapshot(resolve({ reasoningEffort: 'high' }, ROLE))
    expect(line).toContain('winners=model:role,reasoningEffort:explicit')
    expect(line).toContain('effort=requested:high@explicit→effective:high@explicit matched:true')
    expect(line.endsWith('\n')).toBe(true)
  })

  it('无请求档时打 none 与 matched:n/a(不冒充 false)', () => {
    const line = formatConfigSnapshot(resolve({}))
    expect(line).toContain('effort=requested:none→effective:none@parent matched:n/a')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
