// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L01 三入口接线的验收面(2026-11-26):钉三条事实。
 *  1. 三条入口各自命中自己的窄 allow 规则,`evidenceRef` 回查到具体规则 id —— 不是"空 allow";
 *  2. 入口窄 allow 不越权:deny 族与更高优先级的 ask 仍然压过它(接线 ≠ 放宽);
 *  3. 规则集是**整份**合并的:少了 `APPROVAL_RULES`,`ask.fallback` 之类会静默变成 allow。
 */

import { describe, expect, it } from 'vitest'

import {
  PermissionDeniedError,
  decidePermission,
  requirePermission,
} from '../permission-decision.js'
import {
  PERMISSION_ENTRY_ALLOW_RULES,
  PERMISSION_ENTRY_RULE_SET,
  PERMISSION_ENTRY_TOOLS,
  permissionDeniedMessage,
  requireEntryPermission,
} from '../permission-entries.js'

const NOW = 1_766_000_000_000

describe('三入口准入', () => {
  const cases = [
    ['terminal', 'allow.entry.terminal-session'],
    ['mcp', 'allow.entry.mcp-tool-call'],
    ['crew', 'allow.entry.crew-tool'],
  ] as const

  for (const [entry, ruleId] of cases) {
    it(`${entry} 入口命中自己的窄 allow 并带可回查凭据`, async () => {
      const decision = await requireEntryPermission({
        entry,
        sessionId: 'sess-l01',
        userId: null,
        now: NOW,
      })
      expect(decision.kind).toBe('allow')
      expect(decision.tool).toBe(PERMISSION_ENTRY_TOOLS[entry])
      expect(decision.evidenceRef).toMatchObject({ kind: 'rule', ref: ruleId })
      expect(decision.expiresAt).toBeGreaterThan(NOW)
    })
  }

  it('同前缀的后来者不搭车:未登记工具拿不到入口凭据', async () => {
    const decision = await decidePermission(
      {
        scope: 'builtin',
        tool: 'crew.tool.execute.unknown',
        sessionId: 'sess-l01',
        now: NOW,
      },
      { rules: PERMISSION_ENTRY_RULE_SET },
    )
    expect(decision.evidenceRef?.ref ?? '').not.toMatch(/^allow\.entry\./)
  })

  it('deny 族仍压过入口窄 allow(档位硬拒绝)', async () => {
    await expect(
      requireEntryPermission({
        entry: 'terminal',
        sessionId: 'sess-l01',
        now: NOW,
        tier: { verdict: 'deny', reason: 'plan 档只读' },
      }),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
  })

  it('规则集是整份的:deny 族与兜底 ask 都在里面', () => {
    const ids = new Set(PERMISSION_ENTRY_RULE_SET.map((r) => r.id))
    expect(ids.has('deny.tier-ceiling')).toBe(true)
    expect(ids.has('deny.command-high-risk')).toBe(true)
    expect(ids.has('ask.fallback')).toBe(true)
    for (const rule of PERMISSION_ENTRY_ALLOW_RULES) expect(ids.has(rule.id)).toBe(true)
  })

  it('拒绝话术带上 scope/tool 与引擎 reason,路由层不必自造说法', async () => {
    const err = await requireEntryPermission({
      entry: 'mcp',
      sessionId: 'sess-l01',
      now: NOW,
      tier: { verdict: 'deny', reason: 'plan 档只读' },
    }).catch((e: unknown) => e)
    const message = permissionDeniedMessage(err)
    expect(message).toContain('mcp:mcp.tool.call')
    expect(message).toContain('plan 档只读')
    expect(permissionDeniedMessage(new Error('other'))).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
