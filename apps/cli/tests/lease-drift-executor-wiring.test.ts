// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 租约摘要漂移在**执行入口**真的被消费(装车证明)。
 *
 * 为什么单独一份:上一票把摘要判定建在 `checkRulesWithLease` 里并配了 12 例,
 * 但 `executeToolCall` ①没把本次内容喂进去、②只判 `!perm.allowed` 而漂移返回的是
 * `allowed:true + requiresApproval:true` ⇒ 整套机制在运行时是**死代码**。
 * 本文件全部用例都驱动生产入口 `executeToolCall`,并把"喂内容"与"消费结论"两步各钉一条:
 * 摘掉任一步,下面必有例红(不是只红在单元层)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearTools, executeToolCall, registerTools, resetRateLimiter, type Tool } from '../src/tools/index.js'
import {
  grantPermissionLease,
  resetPermissionLeaseForTests,
  revokePermissionLease,
  slotDigest,
} from '../src/tools/permission-lease.js'

const WS = 'ws://装车证明'
const APPROVED = { path: 'src/a.ts', text: '原内容' }
const APPROVED_JSON = JSON.stringify(APPROVED)
// 授予时登记的声明必须与执行时喂进去的内容**同形**(同一份 stringify 口径),
// 否则"同一 key 两处各算一遍"会造出恒漂移 —— 那比不判更糟。
const DECL = APPROVED_JSON

function makeTool(dangerLevel: 'read' | 'write' | 'dangerous' | undefined): Tool {
  return {
    name: 'write_file',
    description: 'test',
    parameters: { type: 'object', properties: {} },
    dangerLevel,
    execute: vi.fn(async () => ({ success: true, output: 'ok' })),
  } as unknown as Tool
}

beforeEach(() => {
  clearTools()
  resetRateLimiter()
  resetPermissionLeaseForTests()
})
afterEach(() => {
  resetPermissionLeaseForTests()
})

function grant() {
  return grantPermissionLease({
    scope: 'goal:digest-wiring',
    capabilities: ['write_file'],
    grantor: 'goal-mode',
    ttlMs: 10 * 60_000,
    maxCalls: 10,
    workspaceId: WS,
    digestDeclarations: { write_file: [DECL] },
  })
}

describe('租约摘要漂移 ⇒ 执行入口必须重新要确认', () => {
  it('内容一致时租约照常放宽(handler 被调用)', async () => {
    grant()
    const tool = makeTool('write')
    registerTools([tool])
    const confirm = vi.fn(async () => false)
    const r = await executeToolCall(
      { name: 'write_file', arguments: APPROVED },
      { permissions: { ask: ['write_file'] }, confirmDangerous: confirm },
    )
    expect(r.success).toBe(true)
    expect(tool.execute).toHaveBeenCalledTimes(1)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('内容改了 ⇒ 无确认出口时**必须拒**(而不是静默沿用旧批准)', async () => {
    grant()
    const tool = makeTool('write')
    registerTools([tool])
    const r = await executeToolCall(
      { name: 'write_file', arguments: { path: 'src/a.ts', text: '被改过的内容' } },
      { permissions: { ask: ['write_file'] } },
    )
    expect(r.success).toBe(false)
    expect(String(r.error)).toContain('摘要漂移')
    expect(tool.execute).not.toHaveBeenCalled()
  })

  it('内容改了但用户重新确认 ⇒ 放行(撤销/漂移后再授权出口仍开着)', async () => {
    grant()
    const tool = makeTool('write')
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: 'write_file', arguments: { path: 'src/a.ts', text: '改后再批' } },
      { permissions: { ask: ['write_file'] }, confirmDangerous: confirm },
    )
    expect(r.success).toBe(true)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(tool.execute).toHaveBeenCalledTimes(1)
  })

  it('无租约时逐字不变:不喂内容也不得多问一次(默认档不变)', async () => {
    const tool = makeTool('read')
    registerTools([tool])
    const confirm = vi.fn(async () => false)
    const r = await executeToolCall(
      { name: 'write_file', arguments: APPROVED },
      { permissions: { allow: ['write_file'] }, confirmDangerous: confirm },
    )
    expect(r.success).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('撤销租约后再授予 ⇒ 同一内容重新可用(再授权出口开着)', async () => {
    grant()
    revokePermissionLease('人工撤销')
    const tool = makeTool('write')
    registerTools([tool])
    // 如实登记既有语义:`ask` 规则在无租约时不拦执行(执行器只在 `!allowed`、dangerous、
    // 摘要漂移三处拦)⇒ 这一步不是"被拒",只是"不再走租约放宽"。真正的再授权证明在下面。
    const withoutLease = await executeToolCall(
      { name: 'write_file', arguments: APPROVED },
      { permissions: { ask: ['write_file'] } },
    )
    expect(withoutLease.success).toBe(true)
    grant()
    const ok = await executeToolCall(
      { name: 'write_file', arguments: APPROVED },
      { permissions: { ask: ['write_file'] } },
    )
    expect(ok.success).toBe(true)
    expect(tool.execute).toHaveBeenCalledTimes(2)
  })

  it('结构锁:执行点必须把本次内容喂进判定(退回不喂参数的旧写法即红)', async () => {
    const src = (await import('node:fs')).readFileSync(
      new URL('../src/tools/index.ts', import.meta.url),
      'utf8',
    )
    expect(/checkRulesWithLease\([\s\S]{0,240}?JSON\.stringify\(call\.arguments/.test(src)).toBe(true)
    expect(src.includes("approvalState === 'content-drifted'")).toBe(true)
    // 摘要实现必须与授予侧同一份(两处各算一遍必漂)
    expect(typeof slotDigest).toBe('function')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
