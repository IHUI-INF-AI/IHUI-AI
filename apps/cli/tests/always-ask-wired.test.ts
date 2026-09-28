// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `alwaysAsk` 接通(2026-09-28 票)。
 *
 * 它钉的是这一格:`packages/types/src/tool-contract.ts:202` 声明了 `alwaysAsk?: boolean`,
 * 而全仓 apps/ 与 packages/ 的 src 面**零消费者**(只有 `dist/tool-contract.d.ts` 里有它,
 * 那是产物)—— 一句"无论多宽松都必须问"的承诺从来没有兑现路径,账面却读起来像已实现。
 * 同族先例:守门 64 / 70 / 81 / 115("造好没装车")。
 *
 * 全部用例都驱动**生产入口** `executeToolCall`(不是把判据抄进测试里重跑一遍):
 *  ① 标记 + 白名单会放行 ⇒ 仍然问人;
 *  ② 标记 + 规则 deny   ⇒ 直接拒,**不退化成"问一次再放行"**(规格 = tool-contract.ts:200);
 *  ③ 未标记 ⇒ 与改前逐字同行为(本票只让显式标记生效,不翻任何缺省语义);
 *  ④ 租约会放宽的那一格 ⇒ 仍然问人。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ToolContract } from '@ihui/types'
import {
  clearTools,
  executeToolCall,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js'
import { grantPermissionLease, resetPermissionLeaseForTests } from '../src/tools/permission-lease.js'

/**
 * 最小可用契约:结果预算刻意放到 1 MiB,免得本票顺带把测试工具的输出裁掉
 * (执行器边界会按 `contract.resultBudget` 截断 —— 那是另一件事,不在这里验)。
 */
function contractWith(
  permissionOverrides: Partial<ToolContract['permission']> = {},
): ToolContract {
  return {
    shape: { visibleToProvider: true, input: { type: 'object', properties: {} } },
    permission: {
      permissionKey: 'test.surface',
      reason: 'fixture contract (ASCII on purpose)',
      riskLevel: 'read',
      effectScope: 'none',
      requiresApproval: false,
      ...permissionOverrides,
    },
    resultBudget: {
      inlineLimitBytes: 1_048_576,
      providerVisibleLimitBytes: 1_048_576,
      policy: 'inline',
      preview: { bytes: 4096, lines: 40, from: 'head' },
    },
  }
}

function makeTool(opts: {
  name: string
  dangerLevel?: 'read' | 'write' | 'dangerous'
  contract?: ToolContract
}): Tool {
  return {
    name: opts.name,
    description: `fixture ${opts.name}`,
    parameters: {},
    required: [],
    dangerLevel: opts.dangerLevel,
    contract: opts.contract,
    execute: vi.fn(async () => ({ success: true, output: 'ran' })),
  }
}

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return { workspacePath: '.', ...overrides }
}

beforeEach(() => {
  clearTools()
  resetRateLimiter()
  resetPermissionLeaseForTests()
})
afterEach(() => {
  resetPermissionLeaseForTests()
})

describe('alwaysAsk:显式标记在执行入口真的被消费(①)', () => {
  it('标记 + 白名单放行 ⇒ 仍走确认弹窗,批准后执行', async () => {
    const tool = makeTool({
      name: 'ask_marked_allow',
      dangerLevel: 'read',
      contract: contractWith({ alwaysAsk: true }),
    })
    registerTools([tool])
    // 回调收到的是哪一只工具,用**被捕获的实参**断言(不用 mock.calls 的元组下标 ——
    // 那需要给 vi.fn 写泛型签名,而本仓 cli 的 tsconfig 把 tests/ 排除在 tsc 之外,
    // 泛型写错不会有人红;捕获实参既行为化又类型自明)。
    const seen: string[] = []
    const confirm = vi.fn(async (t: Tool) => {
      seen.push(t.name)
      return true
    })
    const r = await executeToolCall(
      { name: 'ask_marked_allow', arguments: {} },
      makeCtx({ permissions: { allow: ['ask_marked_allow'] }, confirmDangerous: confirm }),
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(seen).toEqual(['ask_marked_allow'])
    expect(r.success).toBe(true)
    expect(r.output).toBe('ran')
  })

  it('标记 + 无任何权限规则(最宽松档)⇒ 仍问人', async () => {
    const tool = makeTool({
      name: 'ask_marked_norules',
      dangerLevel: 'read',
      contract: contractWith({ alwaysAsk: true }),
    })
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: 'ask_marked_norules', arguments: {} },
      makeCtx({ confirmDangerous: confirm }),
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(true)
  })

  it('标记 + 人在弹窗里拒绝 ⇒ 不执行,且 denied 归因到确认闸', async () => {
    const tool = makeTool({
      name: 'ask_marked_declined',
      dangerLevel: 'read',
      contract: contractWith({ alwaysAsk: true }),
    })
    registerTools([tool])
    const confirm = vi.fn(async () => false)
    const r = await executeToolCall(
      { name: 'ask_marked_declined', arguments: {} },
      makeCtx({ confirmDangerous: confirm }),
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(false)
    expect(r.errorType).toBe('permission_denied')
    expect(r.denial?.gate).toBe('dangerous-gate')
    expect(r.denial?.decider).toBe('user-declined')
    expect(tool.execute).not.toHaveBeenCalled()
  })

  it('标记 + 没有确认出口(未提供 confirmDangerous)⇒ fail-closed 拒绝,不静默放行', async () => {
    const tool = makeTool({
      name: 'ask_marked_no_channel',
      dangerLevel: 'read',
      contract: contractWith({ alwaysAsk: true }),
    })
    registerTools([tool])
    const r = await executeToolCall(
      { name: 'ask_marked_no_channel', arguments: {} },
      makeCtx({ permissions: { allow: ['ask_marked_no_channel'] } }),
    )
    expect(r.success).toBe(false)
    expect(r.errorType).toBe('permission_denied')
    expect(r.denial?.decider).toBe('no-confirmation-channel')
    expect(tool.execute).not.toHaveBeenCalled()
  })
})

describe('alwaysAsk:静态拒绝优先(②,规格 = tool-contract.ts:200)', () => {
  it('标记 + 黑名单 deny ⇒ 直接拒,confirmDangerous 零调用,不退化成"问一次再放行"', async () => {
    const tool = makeTool({
      name: 'ask_marked_denied',
      dangerLevel: 'read',
      contract: contractWith({ alwaysAsk: true }),
    })
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: 'ask_marked_denied', arguments: {} },
      makeCtx({ permissions: { deny: ['ask_marked_denied'] }, confirmDangerous: confirm }),
    )
    expect(confirm).not.toHaveBeenCalled()
    expect(r.success).toBe(false)
    expect(r.errorType).toBe('permission_denied')
    expect(r.denial?.gate).toBe('permission-rule')
    expect(r.denial?.decider).toBe('rule-deny')
    expect(tool.execute).not.toHaveBeenCalled()
  })

  it('标记 + 白名单里没有它(= 不在允许集)⇒ 同样由规则先拒,不问人', async () => {
    const tool = makeTool({
      name: 'ask_marked_outside_allow',
      dangerLevel: 'read',
      contract: contractWith({ alwaysAsk: true }),
    })
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: 'ask_marked_outside_allow', arguments: {} },
      makeCtx({ permissions: { allow: ['some_other_tool'] }, confirmDangerous: confirm }),
    )
    expect(confirm).not.toHaveBeenCalled()
    expect(r.denial?.gate).toBe('permission-rule')
    expect(tool.execute).not.toHaveBeenCalled()
  })
})

describe('alwaysAsk:只对显式 true 生效,缺省语义一字未动(③)', () => {
  it('契约在位但**没有** alwaysAsk 字段 ⇒ 不问(与改前逐字同)', async () => {
    const tool = makeTool({ name: 'ask_absent', dangerLevel: 'read', contract: contractWith() })
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: 'ask_absent', arguments: {} },
      makeCtx({ confirmDangerous: confirm }),
    )
    expect(confirm).not.toHaveBeenCalled()
    expect(r.success).toBe(true)
  })

  it('显式 `alwaysAsk: false` ⇒ 不问(本判据只认字面量 true)', async () => {
    const tool = makeTool({
      name: 'ask_false',
      dangerLevel: 'read',
      contract: contractWith({ alwaysAsk: false }),
    })
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: 'ask_false', arguments: {} },
      makeCtx({ confirmDangerous: confirm }),
    )
    expect(confirm).not.toHaveBeenCalled()
    expect(r.success).toBe(true)
  })

  it('完全没有契约的非危险工具 ⇒ 不问(未标记的工具不因本票新增"要批准")', async () => {
    const tool = makeTool({ name: 'ask_no_contract', dangerLevel: 'read' })
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: 'ask_no_contract', arguments: {} },
      makeCtx({ confirmDangerous: confirm }),
    )
    expect(confirm).not.toHaveBeenCalled()
    expect(r.success).toBe(true)
  })

  it('既有危险档回归:dangerous 未标记也一直要问(本票没有把它换成契约驱动)', async () => {
    const tool = makeTool({ name: 'ask_dangerous_regress', dangerLevel: 'dangerous' })
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: 'ask_dangerous_regress', arguments: {} },
      makeCtx({ permissions: { allow: ['ask_dangerous_regress'] }, confirmDangerous: confirm }),
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(true)
  })
})

describe('alwaysAsk:租约那一档也压不住它(④)', () => {
  it('规则给 ask + 租约会放宽 ⇒ 未标记的工具不问(基线),标记过的仍问', async () => {
    // 基线:同一份 setup,未标记 ⇒ 租约放宽生效,不问人
    const plain = makeTool({ name: 'lease_tool', dangerLevel: 'write' })
    registerTools([plain])
    grantPermissionLease({
      scope: 'goal:always-ask-wired',
      capabilities: ['lease_tool'],
      grantor: 'goal-mode',
      ttlMs: 10 * 60_000,
      maxCalls: 10,
    })
    const confirmPlain = vi.fn(async () => true)
    const rPlain = await executeToolCall(
      { name: 'lease_tool', arguments: {} },
      makeCtx({ permissions: { ask: ['lease_tool'] }, confirmDangerous: confirmPlain }),
    )
    expect(rPlain.success).toBe(true)
    expect(confirmPlain).not.toHaveBeenCalled()

    // 标记版:换一只工具名与另一份租约(禁止叠租约,先撤再授)
    revokeForTest()
    const marked = makeTool({
      name: 'lease_tool_marked',
      dangerLevel: 'write',
      contract: contractWith({ alwaysAsk: true }),
    })
    registerTools([marked])
    grantPermissionLease({
      scope: 'goal:always-ask-wired-marked',
      capabilities: ['lease_tool_marked'],
      grantor: 'goal-mode',
      ttlMs: 10 * 60_000,
      maxCalls: 10,
    })
    const confirmMarked = vi.fn(async () => true)
    const rMarked = await executeToolCall(
      { name: 'lease_tool_marked', arguments: {} },
      makeCtx({
        permissions: { ask: ['lease_tool_marked'] },
        confirmDangerous: confirmMarked,
      }),
    )
    expect(confirmMarked).toHaveBeenCalledTimes(1)
    expect(rMarked.success).toBe(true)
  })
})

/** 撤销当前租约(租约不许叠加,基线用例用完后必须撤)。 */
function revokeForTest(): void {
  resetPermissionLeaseForTests()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
