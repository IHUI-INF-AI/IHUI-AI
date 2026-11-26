// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一权限决策对象的三条底线(对标落地 L01/P0 的验收面):
 *  1. allow 必须有可回查的 evidenceRef —— 没有就判死,不接受"看起来允许";
 *  2. 过期决策一律失效,读取方不必猜有效期;
 *  3. 形态不合法时,`settlePermissionDecision` 当场降级 deny 并落审计 —— 拒绝也留痕。
 */

import { describe, expect, it, vi } from 'vitest'

import {
  PermissionDecisionViolation,
  assertPermissionDecision,
  type PermissionDecision,
} from '@ihui/shared/permission'

import {
  PermissionDeniedError,
  computePermissionDecision,
  decidePermission,
  requirePermission,
  settlePermissionDecision,
} from '../permission-decision.js'

const NOW = 1_766_000_000_000

function baseDecision(overrides: Partial<PermissionDecision> = {}): PermissionDecision {
  return {
    scope: 'terminal',
    kind: 'allow',
    tool: 'terminal_run',
    sessionId: 'sess-1',
    expiresAt: NOW + 60_000,
    reason: '测试构造',
    evidenceRef: { kind: 'rule', ref: 'test.rule' },
    ...overrides,
  }
}

describe('assertPermissionDecision', () => {
  it('拒绝没有 evidenceRef 的 allow', () => {
    const decision = baseDecision({ evidenceRef: null })
    expect(() => assertPermissionDecision(decision, NOW)).toThrow(PermissionDecisionViolation)
    try {
      assertPermissionDecision(decision, NOW)
    } catch (error) {
      expect((error as PermissionDecisionViolation).code).toBe('allow-without-evidence')
    }
  })

  it('拒绝空 ref / 未知凭据种类', () => {
    expect(() =>
      assertPermissionDecision(baseDecision({ evidenceRef: { kind: 'rule', ref: '   ' } }), NOW),
    ).toThrow(PermissionDecisionViolation)
  })

  it('拒绝已过期的决策', () => {
    const decision = baseDecision({ expiresAt: NOW })
    try {
      assertPermissionDecision(decision, NOW)
      expect.unreachable('过期决策应被拒绝')
    } catch (error) {
      expect((error as PermissionDecisionViolation).code).toBe('expired')
    }
  })

  it('放行合法 allow,且 deny 不需要凭据', () => {
    expect(() => assertPermissionDecision(baseDecision(), NOW)).not.toThrow()
    expect(() =>
      assertPermissionDecision(baseDecision({ kind: 'deny', evidenceRef: null }), NOW),
    ).not.toThrow()
  })
})

describe('settlePermissionDecision', () => {
  it('无凭据的 allow 被降级为 deny 并留审计', async () => {
    const audit = vi.fn(async () => ({ requested: 1, recorded: 1, failed: 0 }))
    const settled = await settlePermissionDecision(
      baseDecision({ evidenceRef: null }),
      { scope: 'terminal', tool: 'terminal_run', sessionId: 'sess-1', userId: 'user-1', now: NOW },
      { audit },
    )

    expect(settled.kind).toBe('deny')
    expect(settled.evidenceRef).toBeNull()
    expect(settled.reason).toContain('allow-without-evidence')
    expect(audit).toHaveBeenCalledTimes(1)
    // vi.fn 无参签名 ⇒ mock.calls 的元组类型是 [],直接索引会 TS2493;按真实入参断言一次再取值
    const firstCall = audit.mock.calls[0] as unknown as [string, { facts: unknown[] }]
    expect(firstCall?.[0]).toBe('user-1')
    expect(firstCall?.[1]).toEqual({
      facts: [{ sessionId: 'sess-1', toolName: 'terminal_run', route: 'denied' }],
    })
  })

  it('合法 allow 原样返回,审计按 approved 落', async () => {
    const audit = vi.fn(async () => ({ requested: 1, recorded: 1, failed: 0 }))
    const settled = await settlePermissionDecision(
      baseDecision(),
      { scope: 'terminal', tool: 'terminal_run', sessionId: 'sess-1', userId: 'user-1', now: NOW },
      { audit },
    )

    expect(settled.kind).toBe('allow')
    const firstCall = audit.mock.calls[0] as unknown as [string, { facts: unknown[] }]
    expect(firstCall?.[1]).toEqual({
      facts: [{ sessionId: 'sess-1', toolName: 'terminal_run', route: 'approved' }],
    })
  })
})

describe('computePermissionDecision', () => {
  it('档位 deny 时决策为 deny 且不带凭据', () => {
    const decision = computePermissionDecision(
      {
        scope: 'mcp',
        tool: 'mcp.call',
        sessionId: 'sess-mcp',
        userId: 'user-1',
        tier: { verdict: 'deny', reason: '档位禁止 MCP 调用' },
        now: NOW,
      },
      { ttlMs: 30_000 },
    )

    expect(decision.kind).toBe('deny')
    expect(decision.evidenceRef).toBeNull()
    expect(decision.scope).toBe('mcp')
    expect(decision.expiresAt).toBe(NOW + 30_000)
  })

  it('授权记忆命中时,有效期跟随授权而不是默认 TTL', () => {
    const grant = {
      id: 'grant-1',
      tool: 'demo_tool',
      matchPattern: '*',
      scope: 'global' as const,
      expiresAt: NOW + 5 * 60_000,
      createdAt: NOW,
      grantedBy: 'user-1',
    }
    const decision = computePermissionDecision(
      {
        scope: 'builtin',
        tool: 'demo_tool',
        args: {},
        sessionId: 'sess-1',
        userId: 'user-1',
        agentId: 'agent-1',
        workspaceId: '/workspace',
        now: NOW,
      },
      { grants: [grant], ttlMs: 30_000 },
    )

    // 规则集对未知工具一律兜底 ask ⇒ 授权记忆是唯一放行通道,这条断言因此稳定。
    expect(decision.kind).toBe('allow')
    expect(decision.evidenceRef).toEqual({
      kind: 'grant',
      ref: 'grant-1',
      note: expect.any(String),
    })
    expect(decision.expiresAt).toBe(grant.expiresAt)
  })
})

describe('requirePermission', () => {
  it('deny 时抛出 PermissionDeniedError,并带上决策对象', async () => {
    const input = {
      scope: 'terminal' as const,
      tool: 'terminal_run',
      sessionId: 'sess-1',
      userId: 'user-1',
      tier: { verdict: 'deny' as const, reason: '档位禁止' },
      now: NOW,
    }
    const audit = vi.fn(async () => ({ requested: 1, recorded: 1, failed: 0 }))

    await expect(requirePermission(input, { audit })).rejects.toBeInstanceOf(PermissionDeniedError)
    const decision = await decidePermission(input, { audit })
    expect(decision.kind).toBe('deny')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
