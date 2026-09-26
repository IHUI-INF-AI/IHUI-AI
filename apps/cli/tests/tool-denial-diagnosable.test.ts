// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「被拒」的可诊断化回归(本票判据 ①–⑤)。
 *
 * 全部用例驱动生产入口 `executeToolCall`,钉的是:
 *  ① fail-closed 回归锁 —— 无确认出口时**仍然必须拒**(本票只改"怎么说",不改"是否放");
 *  ② 三态在返回体可区分 —— `denial.gate` × `denial.decider`,且漂移支报"旧批准失效"而非"从未批准";
 *  ③ 无头拒绝确有审计落盘(vi.mock 截 `auditLog`,不另立通道),含闸种类与工具名;
 *  ④ 错误串与结构化字段**不含**被批准内容明文与凭据(假 token 阳性对照)+ 指纹独立复算;
 *  ⑤ 出路提示摘掉即红 —— guidance 逐闸点名真实出口(--permission-lease / confirmDangerous / --tools)。
 */
import { createHash } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
  queryAuditLog: vi.fn(() => ({ entries: [], total: 0, filtered: 0 })),
}))

import { auditLog } from '../src/audit.js'
import { clearTools, executeToolCall, registerTools, resetRateLimiter, type Tool } from '../src/tools/index.js'
import { grantPermissionLease, resetPermissionLeaseForTests } from '../src/tools/permission-lease.js'
import { TOOL_DENIAL_AUDIT_EVENT, digestToolArgs } from '../src/utils/tool-denial.js'

const WS = 'G:/IHUI-AI/apps/cli'
const APPROVED = { path: 'src/a.ts', text: 'approved-content' }
const DRIFTED = { path: 'src/a.ts', text: 'changed-after-approval' }

function makeTool(name: string, dangerLevel?: 'read' | 'write' | 'dangerous'): Tool {
  return {
    name,
    description: 'test tool',
    parameters: { type: 'object', properties: {} },
    required: [],
    dangerLevel,
    execute: vi.fn(async () => ({ success: true, output: 'ok' })),
  } as unknown as Tool
}

function denialAuditEntries(): Array<Record<string, unknown>> {
  return vi
    .mocked(auditLog)
    .mock.calls.map((c) => c[0] as unknown as Record<string, unknown>)
    .filter((e) => e.tool === TOOL_DENIAL_AUDIT_EVENT)
}

beforeEach(() => {
  clearTools()
  resetRateLimiter()
  resetPermissionLeaseForTests()
  vi.mocked(auditLog).mockClear()
})

afterEach(() => {
  resetPermissionLeaseForTests()
})

function grantDigestLease() {
  grantPermissionLease({
    scope: 'goal:denial-diagnostics',
    capabilities: ['write_file'],
    grantor: 'goal-mode',
    ttlMs: 10 * 60_000,
    maxCalls: 20,
    workspaceId: WS,
    digestDeclarations: { write_file: [JSON.stringify(APPROVED)] },
  })
}

describe('① fail-closed 回归锁:无确认出口必须拒(本票不得改成"绕")', () => {
  it('dangerous 工具 + 无 confirmDangerous ⇒ 拒,handler 一次都没被调用', async () => {
    const tool = makeTool('nuke_cache', 'dangerous')
    registerTools([tool])
    const r = await executeToolCall(
      { name: 'nuke_cache', arguments: { scope: 'all' } },
      { workspacePath: WS },
    )
    expect(r.success).toBe(false)
    expect(tool.execute).not.toHaveBeenCalled()
    expect(r.errorType).toBe('permission_denied')
    expect(r.denial?.gate).toBe('dangerous-gate')
    expect(r.denial?.decider).toBe('no-confirmation-channel')
    // 原中文短句逐字保留(只追加,不改写)
    expect(String(r.error)).toContain('危险操作被拒绝(需用户确认): nuke_cache')
  })

  it('披露位 ctx.allowDangerous=true 而无回调 ⇒ 仍拒(影子字段不参与判定)', async () => {
    const tool = makeTool('nuke_cache', 'dangerous')
    registerTools([tool])
    const r = await executeToolCall(
      { name: 'nuke_cache', arguments: { scope: 'all' } },
      { workspacePath: WS, allowDangerous: true },
    )
    expect(r.success).toBe(false)
    expect(tool.execute).not.toHaveBeenCalled()
  })

  it('权限规则黑名单 ⇒ 拒且带 gate=permission-rule / decider=rule-deny', async () => {
    const tool = makeTool('nuke_cache', 'write')
    registerTools([tool])
    const r = await executeToolCall(
      { name: 'nuke_cache', arguments: { scope: 'all' } },
      { workspacePath: WS, permissions: { deny: ['nuke_cache'] } },
    )
    expect(r.success).toBe(false)
    expect(tool.execute).not.toHaveBeenCalled()
    expect(r.errorType).toBe('permission_denied')
    expect(r.denial?.gate).toBe('permission-rule')
    expect(r.denial?.decider).toBe('rule-deny')
  })
})

describe('② 三态可区分 + 漂移支的措辞边界', () => {
  it('摘要漂移且无确认出口 ⇒ 报"旧批准失效",不得出现"从未批准"', async () => {
    grantDigestLease()
    const tool = makeTool('write_file', 'write')
    registerTools([tool])
    const r = await executeToolCall(
      { name: 'write_file', arguments: DRIFTED },
      { workspacePath: WS, permissions: { ask: ['write_file'] } },
    )
    expect(r.success).toBe(false)
    expect(tool.execute).not.toHaveBeenCalled()
    expect(String(r.error)).toContain('旧批准失效')
    expect(String(r.error)).not.toContain('从未批准')
    expect(r.denial?.gate).toBe('lease-digest-drift')
    expect(r.denial?.decider).toBe('no-confirmation-channel')
    expect(r.denial?.guidance).toMatch(/old approval is void/i)
    expect(r.denial?.guidance).toMatch(/NOT "never approved"/)
  })

  it('漂移 + 有回调但被拒 ⇒ decider=user-declined(与"无出口"可区分)', async () => {
    grantDigestLease()
    const tool = makeTool('write_file', 'write')
    registerTools([tool])
    const confirm = vi.fn(async () => false)
    const r = await executeToolCall(
      { name: 'write_file', arguments: DRIFTED },
      { workspacePath: WS, permissions: { ask: ['write_file'] }, confirmDangerous: confirm },
    )
    expect(r.success).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(r.denial?.gate).toBe('lease-digest-drift')
    expect(r.denial?.decider).toBe('user-declined')
  })
})

describe('③ 审计:无头拒绝确有落盘,人拒绝与放行不产该记录', () => {
  it('无头 dangerous 拒绝 ⇒ 一条 tool_call_denied,含闸种类/工具名/指纹', async () => {
    const tool = makeTool('nuke_cache', 'dangerous')
    registerTools([tool])
    await executeToolCall({ name: 'nuke_cache', arguments: { scope: 'all' } }, { workspacePath: WS })
    const entries = denialAuditEntries()
    expect(entries).toHaveLength(1)
    const input = entries[0]!.input as Record<string, unknown>
    expect(input.toolName).toBe('nuke_cache')
    expect(input.gate).toBe('dangerous-gate')
    expect(input.decider).toBe('no-confirmation-channel')
    expect(String(input.argsFingerprint)).toMatch(/^sha256:[0-9a-f]{12}$/)
  })

  it('规则拒绝也落一条;user-declined 与放行路径都不落', async () => {
    registerTools([makeTool('nuke_cache', 'dangerous')])
    await executeToolCall(
      { name: 'nuke_cache', arguments: {} },
      { workspacePath: WS, permissions: { deny: ['nuke_cache'] } },
    )
    expect(denialAuditEntries()).toHaveLength(1)

    const confirmDecline = vi.fn(async () => false)
    await executeToolCall(
      { name: 'nuke_cache', arguments: {} },
      { workspacePath: WS, confirmDangerous: confirmDecline },
    )
    expect(denialAuditEntries()).toHaveLength(1)

    const confirmApprove = vi.fn(async () => true)
    const ok = await executeToolCall(
      { name: 'nuke_cache', arguments: {} },
      { workspacePath: WS, confirmDangerous: confirmApprove },
    )
    expect(ok.success).toBe(true)
    expect(denialAuditEntries()).toHaveLength(1)
  })
})

describe('④ 隐私:摘要只落指纹与键名,值与凭据绝不进错误串/字段/审计', () => {
  const SECRET_ARGS = {
    command: 'run-secret-verb && export API_KEY=IHUIFAKETOKEN-9f3a secret-value-42',
    note: 'note-secret-chinese-应永远不会出现',
  }

  it('假 token 阳性对照:结果整体不含明文,含指纹;指纹独立复算等值且随内容变', async () => {
    registerTools([makeTool('nuke_cache', 'dangerous')])
    const r = await executeToolCall({ name: 'nuke_cache', arguments: SECRET_ARGS }, { workspacePath: WS })
    const serialized = JSON.stringify(r)
    expect(r.success).toBe(false)
    expect(serialized).not.toContain('IHUIFAKETOKEN-9f3a')
    expect(serialized).not.toContain('secret-value-42')
    expect(serialized).not.toContain('run-secret-verb')
    expect(serialized).not.toContain('note-secret-chinese')
    // 键名允许(结构信息),值绝不允许
    expect(r.denial?.args.keys).toEqual(['command', 'note'])
    // 独立实现复算(不是"和实现自己比"的恒真式):同内容 → 同指纹,异内容 → 异指纹
    const expected = createHash('sha256').update(JSON.stringify(SECRET_ARGS), 'utf8').digest('hex').slice(0, 12)
    expect(r.denial?.args.fingerprint).toBe(`sha256:${expected}`)
    expect(digestToolArgs({ command: 'different' } as Record<string, unknown>).fingerprint).not.toBe(
      r.denial?.args.fingerprint,
    )
    // 审计行同样只有指纹+键名
    const auditRow = denialAuditEntries()[0]!.input as Record<string, unknown>
    expect(JSON.stringify(auditRow)).not.toContain('IHUIFAKETOKEN-9f3a')
  })
})

describe('⑤ 出路提示是有牙的锁:摘掉 guidance(置空)即红;逐闸必须点名真实出口', () => {
  it('dangerous 无出口 ⇒ 点名交互终端 / ctx.confirmDangerous,并明写无 env 旁路', async () => {
    registerTools([makeTool('nuke_cache', 'dangerous')])
    const r = await executeToolCall({ name: 'nuke_cache', arguments: {} }, { workspacePath: WS })
    expect(r.denial?.guidance.length ?? 0).toBeGreaterThan(0)
    expect(r.denial?.guidance).toMatch(/interactive/)
    expect(r.denial?.guidance).toMatch(/confirmDangerous/)
    expect(r.denial?.guidance).toMatch(/NO environment-variable bypass/)
    expect(String(r.error)).toContain('[ihui-denial')
  })

  it('lease 漂移 ⇒ 点名 --permission-lease / REPL /lease 再授权出口', async () => {
    grantDigestLease()
    registerTools([makeTool('write_file', 'write')])
    const r = await executeToolCall(
      { name: 'write_file', arguments: DRIFTED },
      { workspacePath: WS, permissions: { ask: ['write_file'] } },
    )
    expect(r.denial?.guidance).toMatch(/--permission-lease/)
    expect(r.denial?.guidance).toMatch(/\/lease/)
  })

  it('权限规则拒 ⇒ 点名 --tools / --disallowed-tools,并明写租约救不了这一闸', async () => {
    registerTools([makeTool('nuke_cache', 'write')])
    const r = await executeToolCall(
      { name: 'nuke_cache', arguments: {} },
      { workspacePath: WS, permissions: { deny: ['nuke_cache'] } },
    )
    expect(r.denial?.guidance).toMatch(/--tools/)
    expect(r.denial?.guidance).toMatch(/--disallowed-tools/)
    expect(r.denial?.guidance).toMatch(/never relaxes this gate/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
