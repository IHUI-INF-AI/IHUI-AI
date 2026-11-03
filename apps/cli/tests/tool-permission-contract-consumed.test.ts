// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D142 工具契约**权限轴**落地 —— 判据是行为,不是文本。
//
// 它钉的是这一格:`packages/types/src/tool-contract.ts` 的 `ToolPermissionContract`
// (`effectScope` / `riskLevel` / `requiresApproval` / `alwaysAsk`)有类型、有声明位,
// 但执行路径一条都不读 ⇒ "这个工具能不能碰文件/网络/资金"只是提示文案。
// 本票把权限轴接到两个**生产**决策宿主上:
//   ① `apps/cli/src/tools/danger-gate.ts` 的会话级 `--allow-dangerous` 闸(本文件 ①②③ 组);
//   ② `apps/cli/src/tools/permissions.ts` 的 `decideWithMode`(本文件 ④⑤ 组)。
// 判据本体只有一份:`@ihui/types` 的 `humanApprovalMandated`(§3 共享层优先 ——
// 宿主里再抄一份档名清单就是本票要消灭的形态,由守门 111 的 TC4 拦摘线)。
//
// 三条不可动摇的口径:
//  - **全部用例都驱动生产入口**(`executeToolCall` / `createDangerGate` / `checkPermission`),
//    不把判据抄进测试重跑一遍;
//  - **副作用断言**:拦下来的那格必须断言 `tool.execute` 零调用,只断言错误码会放过
//    "先改了再抛 403"(AGENTS §5「认证不等于授权」同一条);
//  - **不改缺省语义**:契约缺席的工具行为与改前逐字相同(② 组),所以本票不需要基线清单。
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
import { createDangerGate, type DangerGateDecision } from '../src/tools/danger-gate.js'
import { checkPermission, checkPermissionWithLease } from '../src/tools/permissions.js'
import { grantPermissionLease, resetPermissionLeaseForTests } from '../src/tools/permission-lease.js'

/**
 * 最小契约:`resultBudget` 刻意放到 1 MiB —— 执行器边界会按契约裁剪输出,
 * 那是 resultBudget 轴(已有消费者,不在本票射程),别让本票顺带把它验成自己的功劳。
 */
function contractWith(permissionOverrides: Partial<ToolContract['permission']> = {}): ToolContract {
  return {
    shape: { visibleToProvider: true, input: { type: 'object', properties: {} } },
    permission: {
      permissionKey: 'd142.fixture',
      reason: 'fixture contract (ASCII on purpose)',
      riskLevel: 'write',
      effectScope: 'workspace',
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

/** 只带 flag、无人可问的闸门(生产出口 `createDangerGate` 本身)。 */
function flagOnlyGate(recorder: (d: DangerGateDecision) => void) {
  return createDangerGate({ allowDangerous: true, silent: true, onDecision: recorder })
}

beforeEach(() => {
  clearTools()
  resetRateLimiter()
  resetPermissionLeaseForTests()
})
afterEach(() => {
  resetPermissionLeaseForTests()
})

describe('① 权限轴改变生产结果:碰外部世界的写,会话级 flag 不得替人批准', () => {
  it('requiresApproval:true ∧ effectScope:system ⇒ 不执行,拒绝归因到契约(不是"没人可问")', async () => {
    const tool = makeTool({
      name: 'axis_system_write',
      dangerLevel: 'dangerous',
      contract: contractWith({ effectScope: 'system', requiresApproval: true, riskLevel: 'dangerous' }),
    })
    registerTools([tool])
    const decisions: DangerGateDecision[] = []
    const r = await executeToolCall(
      { name: 'axis_system_write', arguments: { command: 'not-executed' } },
      makeCtx({
        permissions: { allow: ['axis_system_write'] },
        allowDangerous: true,
        confirmDangerous: flagOnlyGate((d) => decisions.push(d)),
      }),
    )
    // 副作用没发生(这条才是判据;错误码只证明"有人拦",不证明"没做")
    expect(tool.execute).not.toHaveBeenCalled()
    expect(r.success).toBe(false)
    expect(r.errorType).toBe('permission_denied')
    expect(decisions).toHaveLength(1)
    expect(decisions[0]!.route).toBe('denied')
    // 归因必须是"契约要求人批准",不得与 fail-closed 的"只是没人可问"同形:
    // 同形的后果是下一个人去开 flag,而 flag 正是本条要否掉的那一档。
    expect(decisions[0]!.cause).toBe('contract-approval-required')
  })

  it('显式 alwaysAsk:true(哪怕 dangerLevel 是 read)⇒ 同样不执行', async () => {
    const tool = makeTool({
      name: 'axis_always_ask',
      dangerLevel: 'read',
      contract: contractWith({ effectScope: 'network', requiresApproval: false, alwaysAsk: true }),
    })
    registerTools([tool])
    const decisions: DangerGateDecision[] = []
    const r = await executeToolCall(
      { name: 'axis_always_ask', arguments: {} },
      makeCtx({
        permissions: { allow: ['axis_always_ask'] },
        allowDangerous: true,
        confirmDangerous: flagOnlyGate((d) => decisions.push(d)),
      }),
    )
    expect(tool.execute).not.toHaveBeenCalled()
    expect(r.success).toBe(false)
    expect(decisions[0]!.cause).toBe('contract-approval-required')
  })

  it('改错/改对 scope 审批行为跟着变:同一份 requiresApproval,effectScope 换成协议档 ⇒ 放行', async () => {
    // 这条是票面验收要求的"字段值参与决策"的直接证明:两个工具只差 effectScope 一个字段。
    const askUser = makeTool({
      name: 'axis_protocol_scope',
      dangerLevel: 'dangerous',
      // delegate-to-caller / ask-user 是本端没有"可批准的事"的两档纯协议语义
      contract: contractWith({ effectScope: 'ask-user', requiresApproval: true }),
    })
    registerTools([askUser])
    const decisions: DangerGateDecision[] = []
    const r = await executeToolCall(
      { name: 'axis_protocol_scope', arguments: {} },
      makeCtx({
        permissions: { allow: ['axis_protocol_scope'] },
        allowDangerous: true,
        confirmDangerous: flagOnlyGate((d) => decisions.push(d)),
      }),
    )
    expect(askUser.execute).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(true)
    expect(decisions[0]!.route).toBe('flag')
  })

  it('人在 prompt 里点头 ⇒ 契约要求批准也走得通(本票拦的是"flag 替人答",不是"不许放行")', async () => {
    const tool = makeTool({
      name: 'axis_human_yes',
      dangerLevel: 'dangerous',
      contract: contractWith({ effectScope: 'network', requiresApproval: true }),
    })
    registerTools([tool])
    const gate = createDangerGate({
      allowDangerous: true,
      silent: true,
      prompt: async () => true,
    })
    const r = await executeToolCall(
      { name: 'axis_human_yes', arguments: {} },
      makeCtx({ permissions: { allow: ['axis_human_yes'] }, allowDangerous: true, confirmDangerous: gate }),
    )
    expect(tool.execute).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(true)
  })
})

describe('② 不改缺省语义:没有契约声明的工具行为逐字不变', () => {
  it('同型工具但不挂契约 ⇒ flag 照旧自动放行,route=flag、cause 无', async () => {
    const tool = makeTool({ name: 'no_contract_dangerous', dangerLevel: 'dangerous' })
    registerTools([tool])
    const decisions: DangerGateDecision[] = []
    const r = await executeToolCall(
      { name: 'no_contract_dangerous', arguments: {} },
      makeCtx({
        permissions: { allow: ['no_contract_dangerous'] },
        allowDangerous: true,
        confirmDangerous: flagOnlyGate((d) => decisions.push(d)),
      }),
    )
    expect(tool.execute).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(true)
    expect(decisions).toHaveLength(1)
    expect(decisions[0]!.route).toBe('flag')
    expect(decisions[0]!.cause).toBeUndefined()
  })

  it('挂了契约但两条承诺都没写(requiresApproval:false ∧ 无 alwaysAsk)⇒ 同样不参与', async () => {
    const tool = makeTool({
      name: 'contract_silent',
      dangerLevel: 'dangerous',
      contract: contractWith({ effectScope: 'system', requiresApproval: false }),
    })
    registerTools([tool])
    const decisions: DangerGateDecision[] = []
    const r = await executeToolCall(
      { name: 'contract_silent', arguments: {} },
      makeCtx({
        permissions: { allow: ['contract_silent'] },
        allowDangerous: true,
        confirmDangerous: flagOnlyGate((d) => decisions.push(d)),
      }),
    )
    expect(tool.execute).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(true)
    expect(decisions[0]!.route).toBe('flag')
  })
})

describe('③ 摘线反例:判据真在决策路径上,不是测试自己判自己', () => {
  it('把新判定摘掉(复制一份改前逻辑:flag 无条件先放行)⇒ 同一只契约工具会被执行', async () => {
    // 这条用例**不**调用生产闸门:它复制"改前"那三行,用来证明 ① 组的
    // `not.toHaveBeenCalled()` 有牙。它**不是**出口实现,也不得被当出口引用
    // (decoy-single-source 那一条规矩:复制品只当反向对照)。
    const preChangeGate = async () => true
    const tool = makeTool({
      name: 'axis_decoy',
      dangerLevel: 'dangerous',
      contract: contractWith({ effectScope: 'system', requiresApproval: true, riskLevel: 'dangerous' }),
    })
    registerTools([tool])
    const r = await executeToolCall(
      { name: 'axis_decoy', arguments: {} },
      makeCtx({
        permissions: { allow: ['axis_decoy'] },
        allowDangerous: true,
        confirmDangerous: preChangeGate,
      }),
    )
    // 摘掉判定 ⇒ 副作用发生。生产闸门跑同一只工具时(见 ①)不执行,两者差值就是本票的净效果。
    expect(tool.execute).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(true)
  })

  it('permissions 侧同样有牙:不传权限轴 ⇒ allow,传同一份契约 ⇒ ask', () => {
    const mount = { contract: contractWith({ effectScope: 'network', requiresApproval: true }) }
    expect(checkPermission('t_axis', undefined, 'acceptEdits', 'write')).toBe('allow')
    expect(checkPermission('t_axis', undefined, 'acceptEdits', 'write', mount)).toBe('ask')
  })
})

describe('④ decideWithMode 的权限轴:只升不降', () => {
  it('静态拒绝优先:deny 不会因为契约要求批准就退化成"问一次再放行"', () => {
    const mount = { contract: contractWith({ effectScope: 'system', requiresApproval: true, alwaysAsk: true }) }
    expect(checkPermission('t_deny', { deny: ['t_deny'] }, 'default', 'write', mount)).toBe('deny')
  })

  it('ask 档不被改写(升级只作用于 allow)', () => {
    const mount = { contract: contractWith({ effectScope: 'network', requiresApproval: true }) }
    expect(checkPermission('t_ask', { ask: ['t_ask'] }, 'default', 'read', mount)).toBe('ask')
  })

  it('plan 档的 deny 保持 deny;契约不参与降级', () => {
    const mount = { contract: contractWith({ effectScope: 'system', requiresApproval: true }) }
    expect(checkPermission('t_plan', undefined, 'plan', 'write', mount)).toBe('deny')
  })

  it('"无论多宽松都必须问"覆盖 bypassPermissions —— 那是 spec 原文,不是我的加码', () => {
    const mount = { contract: contractWith({ effectScope: 'system', alwaysAsk: true }) }
    expect(checkPermission('t_bypass', undefined, 'bypassPermissions', 'read', mount)).toBe('ask')
    // 契约缺席 ⇒ 该档逐字不变
    expect(checkPermission('t_bypass', undefined, 'bypassPermissions', 'read')).toBe('allow')
  })
})

describe('⑤ 租约也是"替人回答"的一档:契约要求批准时租约不得放宽', () => {
  it('同一份租约:无契约 ⇒ 放宽成 allow(改前语义);有契约 ⇒ 仍然 ask', () => {
    const lease = grantPermissionLease({
      scope: 'goal:D142-lease-demo',
      capabilities: ['t_lease'],
      grantor: 'cli-flag',
      ttlMs: 30 * 60 * 1000,
      expiresAfterTurns: 5,
    })
    expect(checkPermissionWithLease('t_lease', undefined, 'default', 'write', lease)).toBe('allow')
    const mount = { contract: contractWith({ effectScope: 'system', requiresApproval: true }) }
    expect(checkPermissionWithLease('t_lease', undefined, 'default', 'write', lease, null, mount)).toBe('ask')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
