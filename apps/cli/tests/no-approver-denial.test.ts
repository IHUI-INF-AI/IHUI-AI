// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 无头 `ask` 的拒绝归因(本票):**没人被问过,不得写成"用户拒绝"**。
 *
 * 缺陷事实:无头单次执行(`runAgent`)接的危险闸门 `buildAgentDangerGate` 没有 prompt 通道,
 * 它的 false 是"结构上没人可问";而旧实现只看"回调在场 ∧ 答 false"就归因 `user-declined`,
 * 于是审计面落下一桩假事实:
 *   `[ihui-denial gate=dangerous-gate decider=user-declined …] The user actively declined this call …`
 * 排障会被带到"谁拒了",而真因是"该补一个审批人 / 该走显式授权"。
 *
 * 本用例钉死两面:
 *  ① 无审批人(`ctx.approverAvailable === false`)⇒ `no-approver`,文案点破"本会话无审批人",
 *    且**全文不含** `user-declined` / `actively declined`;审计行的 decider 同样是 no-approver;
 *  ② 有 TTY / 真人当场拒绝(`approverAvailable` 不传)⇒ 仍是 `user-declined` 与原文案(语义不回退);
 *  ③ 宿主压根没接确认通道 ⇒ 仍是 `no-confirmation-channel`(旧语义不动);
 *  ④ 三档都不放行 —— 归因改动只改"怎么说",不改"是否放"(fail-closed 不变)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
  queryAuditLog: vi.fn(() => ({ entries: [], total: 0, filtered: 0 })),
}))

import { auditLog } from '../src/audit.js'
import { buildAgentDangerGate } from '../src/commands/agent.js'
import { clearTools, executeToolCall, registerTools, resetRateLimiter, type Tool } from '../src/tools/index.js'
import { resetPermissionLeaseForTests } from '../src/tools/permission-lease.js'
import { TOOL_DENIAL_AUDIT_EVENT } from '../src/utils/tool-denial.js'

const WS = 'G:/IHUI-AI/apps/cli'

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

describe('① 无审批人(无头)⇒ no-approver,文案不得出现"用户拒绝"', () => {
  it('runAgent 的接线形态:无 prompt 的闸门 + approverAvailable=false ⇒ no-approver', async () => {
    const tool = makeTool('run_command', 'dangerous')
    registerTools([tool])
    // 与 runAgent 同一种构造:buildAgentDangerGate 没有 prompt 通道 ⇒ 它的 false 结构性
    // 不可能是人答的。这正是本票要修的那一格。
    const gate = buildAgentDangerGate({ allowDangerous: false, silent: true })
    expect(await gate(tool, { command: 'npm test' })).toBe(false)

    const r = await executeToolCall(
      { name: 'run_command', arguments: { command: 'npm test' } },
      { workspacePath: WS, confirmDangerous: gate, approverAvailable: false },
    )

    // 仍然拒、仍然没执行(fail-closed 未变)
    expect(r.success).toBe(false)
    expect(tool.execute).not.toHaveBeenCalled()
    expect(r.errorType).toBe('permission_denied')

    // 归因:no-approver
    expect(r.denial?.gate).toBe('dangerous-gate')
    expect(r.denial?.decider).toBe('no-approver')

    // 文案:说清"本会话无审批人",且全文不得出现"人拒绝了"的字样
    const text = String(r.error)
    expect(text).toContain('本会话无审批人，需确认的调用一律不执行')
    expect(text).not.toContain('user-declined')
    expect(text).not.toContain('actively declined')
    // guidance(拼进错误串的那段)同样不得把读者带向"有人拒绝"
    expect(r.denial?.guidance ?? '').not.toContain('user-declined')
    expect(r.denial?.guidance ?? '').not.toContain('actively declined')
    expect(r.denial?.guidance ?? '').toMatch(/no approver/i)
  })

  it('审计行:decider=no-approver(且与 user-declined 可机器区分)', async () => {
    registerTools([makeTool('run_command', 'dangerous')])
    await executeToolCall(
      { name: 'run_command', arguments: { command: 'rm -rf build' } },
      { workspacePath: WS, confirmDangerous: async () => false, approverAvailable: false },
    )
    const entries = denialAuditEntries()
    expect(entries).toHaveLength(1)
    const input = entries[0]!.input as Record<string, unknown>
    expect(input.gate).toBe('dangerous-gate')
    expect(input.decider).toBe('no-approver')
    expect(input.toolName).toBe('run_command')
  })

  it('无审批人 + 无回调(连通道都没有)⇒ 同样归因 no-approver(仍是"没人可问")', async () => {
    registerTools([makeTool('run_command', 'dangerous')])
    const r = await executeToolCall(
      { name: 'run_command', arguments: {} },
      { workspacePath: WS, approverAvailable: false },
    )
    expect(r.success).toBe(false)
    expect(r.denial?.decider).toBe('no-approver')
    expect(String(r.error)).not.toContain('user-declined')
  })
})

describe('② 有 TTY / 真人当场拒绝 ⇒ 仍是 user-declined(原语义不回退)', () => {
  it('approverAvailable 不传 + 回调答 false ⇒ user-declined 与原文案', async () => {
    const tool = makeTool('run_command', 'dangerous')
    registerTools([tool])
    const confirm = vi.fn(async () => false)
    const r = await executeToolCall(
      { name: 'run_command', arguments: { command: 'npm test' } },
      { workspacePath: WS, confirmDangerous: confirm },
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(false)
    expect(tool.execute).not.toHaveBeenCalled()
    expect(r.denial?.decider).toBe('user-declined')
    expect(String(r.error)).toContain('危险操作被拒绝(需用户确认): run_command')
    expect(String(r.error)).toContain('actively declined')
    expect(r.denial?.guidance ?? '').toMatch(/actively declined/i)
    // 人拒绝不进"无头拒绝"审计(人就在场,提示已展示)—— 旧行为未变
    expect(denialAuditEntries()).toHaveLength(0)
  })

  it('approverAvailable=true(显式声明有人值守)⇒ 仍归因 user-declined', async () => {
    registerTools([makeTool('run_command', 'dangerous')])
    const r = await executeToolCall(
      { name: 'run_command', arguments: {} },
      { workspacePath: WS, confirmDangerous: async () => false, approverAvailable: true },
    )
    expect(r.denial?.decider).toBe('user-declined')
  })
})

describe('③ 宿主没接确认通道 ⇒ 仍是 no-confirmation-channel(旧语义不动)', () => {
  it('无回调且未声明 approverAvailable ⇒ no-confirmation-channel', async () => {
    const tool = makeTool('run_command', 'dangerous')
    registerTools([tool])
    const r = await executeToolCall({ name: 'run_command', arguments: {} }, { workspacePath: WS })
    expect(r.success).toBe(false)
    expect(tool.execute).not.toHaveBeenCalled()
    expect(r.denial?.decider).toBe('no-confirmation-channel')
    expect(String(r.error)).toContain('危险操作被拒绝(需用户确认): run_command')
  })

  it('三档互不相同(机器可读的区别,不是措辞差异)', async () => {
    registerTools([makeTool('run_command', 'dangerous')])
    const noApprover = await executeToolCall(
      { name: 'run_command', arguments: {} },
      { workspacePath: WS, confirmDangerous: async () => false, approverAvailable: false },
    )
    const declined = await executeToolCall(
      { name: 'run_command', arguments: {} },
      { workspacePath: WS, confirmDangerous: async () => false },
    )
    const noChannel = await executeToolCall({ name: 'run_command', arguments: {} }, { workspacePath: WS })
    const deciders = [noApprover.denial?.decider, declined.denial?.decider, noChannel.denial?.decider]
    expect(deciders).toEqual(['no-approver', 'user-declined', 'no-confirmation-channel'])
    expect(new Set(deciders).size).toBe(3)
  })
})
