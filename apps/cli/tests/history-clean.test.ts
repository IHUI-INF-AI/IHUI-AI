// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-12 会话历史清理按路由意图判据测试(2026-11-28)。
 *
 * 钉五件事:
 *   1. 意图认不出 ⇒ unknown_intent,**绝不落默认全清**;
 *   2. 意图与 scope 必须匹配:缺参数 scope_missing、给错参数 scope_mismatch;
 *   3. `all` 必须显式 confirmAll: true,不可逆动作不凭默认值;
 *   4. 任何允许的计划 keep 都必须非空;
 *   5. 别名映射是一对一,不得把 chat/flow/step 混成一个意图。
 */

import { describe, expect, it } from 'vitest'

import {
  ROUTE_INTENTS,
  classifyRouteIntent,
  cleanHistory,
  planHistoryClean,
} from '../src/commands/history-clean.js'

describe('classifyRouteIntent', () => {
  it('四个正名都认', () => {
    for (const intent of ROUTE_INTENTS) {
      expect(classifyRouteIntent(intent)).toBe(intent)
    }
  })

  it('大小写与空白归一', () => {
    expect(classifyRouteIntent('  SESSION ')).toBe('session')
  })

  it('别名一对一映射', () => {
    expect(classifyRouteIntent('chat')).toBe('session')
    expect(classifyRouteIntent('conversation')).toBe('session')
    expect(classifyRouteIntent('flow')).toBe('branch')
    expect(classifyRouteIntent('fork')).toBe('branch')
    expect(classifyRouteIntent('step')).toBe('checkpoint')
    expect(classifyRouteIntent('rewind')).toBe('checkpoint')
    expect(classifyRouteIntent('everything')).toBe('all')
    expect(classifyRouteIntent('wipe')).toBe('all')
  })

  it('认不出返回 null 而不是 all', () => {
    for (const bad of ['nuke', '', null, 1, {}, []]) {
      expect(classifyRouteIntent(bad)).toBeNull()
    }
  })
})

describe('planHistoryClean', () => {
  it('意图不认 ⇒ unknown_intent 且 plan 为空', () => {
    const d = planHistoryClean('nuke', {})
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe('unknown_intent')
    expect(d.plan).toBeNull()
    expect(d.intent).toBeNull()
  })

  it('session 缺 sessionId ⇒ scope_missing', () => {
    for (const scope of [{}, { sessionId: '' }, { sessionId: '   ' }, null, 'x']) {
      const d = planHistoryClean('session', scope)
      expect(d.reason).toBe('scope_missing')
      expect(d.allowed).toBe(false)
    }
  })

  it('session 给对了 ⇒ 允许且 targets 带前缀', () => {
    const d = planHistoryClean('session', { sessionId: 's-1' })
    expect(d.allowed).toBe(true)
    expect(d.plan?.targets).toEqual(['session:s-1'])
    expect(d.plan?.keep.length).toBeGreaterThan(0)
  })

  it('branch 缺 branchId ⇒ scope_missing', () => {
    expect(planHistoryClean('branch', { sessionId: 's-1' }).reason).toBe('scope_missing')
  })

  it('checkpoint 缺 checkpointId ⇒ scope_missing', () => {
    expect(planHistoryClean('checkpoint', {}).reason).toBe('scope_missing')
  })

  it('给了与意图不匹配的 scope ⇒ scope_mismatch', () => {
    const d = planHistoryClean('session', { sessionId: 's-1', branchId: 'b-1' })
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe('scope_mismatch')
  })

  it('scope_mismatch 不会被当成缺参数', () => {
    const d = planHistoryClean('checkpoint', { checkpointId: 'c-1', sessionId: 's-1' })
    expect(d.reason).toBe('scope_mismatch')
  })

  it('all 不确认 ⇒ confirm_required', () => {
    const d = planHistoryClean('all', {})
    expect(d.allowed).toBe(false)
    expect(d.reason).toBe('confirm_required')
    expect(d.plan).toBeNull()
  })

  it('all 显式确认 ⇒ 允许且 keep 非空', () => {
    const d = planHistoryClean('all', { confirmAll: true })
    expect(d.allowed).toBe(true)
    expect(d.plan?.keep.length).toBeGreaterThan(0)
    expect(d.plan?.targets).toEqual(['*'])
  })

  it('confirmAll 只认严格 true', () => {
    for (const bad of ['true', 1, {}, undefined]) {
      const d = planHistoryClean('all', { confirmAll: bad })
      expect(d.reason).toBe('confirm_required')
    }
  })

  it('scope 里带 confirmAll 但意图不是 all ⇒ scope_mismatch', () => {
    const d = planHistoryClean('session', { sessionId: 's-1', confirmAll: true })
    expect(d.reason).toBe('scope_mismatch')
  })

  it('任何允许的计划 keep 都非空', () => {
    const cases: Array<[string, object]> = [
      ['session', { sessionId: 's-1' }],
      ['branch', { branchId: 'b-1' }],
      ['checkpoint', { checkpointId: 'c-1' }],
      ['all', { confirmAll: true }],
    ]
    for (const [route, scope] of cases) {
      const d = planHistoryClean(route, scope)
      expect(d.allowed).toBe(true)
      expect(d.plan!.keep.length).toBeGreaterThan(0)
    }
  })

  it('数组当 scope 不被接受', () => {
    const d = planHistoryClean('session', ['s-1'])
    expect(d.reason).toBe('scope_missing')
  })
})

describe('cleanHistory', () => {
  it('允许时返回 plan', () => {
    const out = cleanHistory('session', { sessionId: 's-1' })
    expect('plan' in out).toBe(true)
    if ('plan' in out) expect(out.plan.targets).toEqual(['session:s-1'])
  })

  it('拒绝时返回具名 refusal 字符串', () => {
    const out = cleanHistory('all', {})
    expect('refusal' in out).toBe(true)
    if ('refusal' in out) {
      expect(out.refusal).toContain('confirm_required')
    }
  })

  it('意图不认时 refusal 也具名', () => {
    const out = cleanHistory('nuke', {})
    expect('refusal' in out).toBe(true)
    if ('refusal' in out) expect(out.refusal).toContain('unknown_intent')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
