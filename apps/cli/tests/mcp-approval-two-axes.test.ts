// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方 MCP 工具的免批判定拆成**两轴**(2026-09-28 票)。
 *
 * 改前的实测口径(不是设想):`mcp-runtime.ts` 的 `mcpToolToTool` 从不写 `dangerLevel`,
 * 而批准闸只认 `dangerLevel === 'dangerous'`(或租约摘要漂移)⇒ **每一个** MCP 工具都免批。
 * 那是单轴判定:一档危险级别同时冒充了"只读"与"不碰外部世界"两件事。
 *
 * 现在的口径(用户拍板):**只有「只读」且「不碰外部世界」同时成立才免批**,任一不成立就要问。
 * 两轴是契约上的两个独立字段(`ApprovalExemptionAxes.readonlyAxis` / `.closedWorldAxis`),
 * 合取判定唯一住在 `apps/cli/src/tools/index.ts` 的 `requiresUserConfirmation()`;
 * 本文件的用例因此**全部驱动生产入口** `executeToolCall`,而不是重抄一遍判据。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearTools,
  executeToolCall,
  registerTools,
  requiresUserConfirmation,
  resetRateLimiter,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js'
import { mcpToolToTool, type McpConnection, type McpToolDef } from '../src/tools/mcp-runtime.js'

/** 只需要 `server.name` 那一条:execute 里的 tools/call 在下面的用例里从不被调用。 */
function conn(serverName = 'demo'): McpConnection {
  return {
    server: { name: serverName } as McpConnection['server'],
    tools: [],
    connected: true,
    transport: 'stdio',
    ssePending: new Map(),
    sseNextId: 1,
  }
}

function mcpDef(
  name: string,
  annotations?: { readOnlyHint?: boolean; openWorldHint?: boolean },
): McpToolDef {
  return { name, description: `fixture ${name}`, inputSchema: { type: 'object' }, annotations }
}

function ctxWith(overrides: Partial<ToolContext> = {}): ToolContext {
  return { workspacePath: '.', ...overrides }
}

/**
 * 生产转换 + **只替换 handler**:两轴的声明必须来自生产的 `mcpToolToTool`(否则测的就是
 * 测试自己抄的那份映射),但本仓没有进程内 MCP server,`execute` 走 `tools/call` 必然抛错
 * —— 那会把"批准闸的结论"和"handler 的失败"混在同一个 `success` 里读。所以只把 handler
 * 换成一只可断言的桩,**批准判定路径一行未动**(判定仍由生产 `executeToolCall` 走)。
 */
function mcpToolWithStubHandler(
  name: string,
  annotations?: { readOnlyHint?: boolean; openWorldHint?: boolean },
): { tool: Tool; handler: ReturnType<typeof vi.fn> } {
  const real = mcpToolToTool(conn(), mcpDef(name, annotations))
  const handler = vi.fn(async () => ({ success: true, output: 'ran' }))
  return { tool: { ...real, execute: handler }, handler }
}

beforeEach(() => {
  clearTools()
  resetRateLimiter()
})
afterEach(() => {
  clearTools()
})

describe('两轴映射:mcp-runtime 只声明事实(不判定)', () => {
  it('两个字段各自独立存在(不是合并成的一个布尔)', () => {
    const tool = mcpToolToTool(conn(), mcpDef('axes_shape', { readOnlyHint: true, openWorldHint: false }))
    expect(tool.approvalExemption).toBeDefined()
    expect(Object.keys(tool.approvalExemption ?? {}).sort()).toEqual(['closedWorldAxis', 'readonlyAxis'])
  })

  it('完全没自报 annotations ⇒ 两轴都是 false(= 未证明),且**不**借 dangerLevel 冒充', () => {
    const tool = mcpToolToTool(conn(), mcpDef('axes_absent_annotations'))
    expect(tool.approvalExemption).toEqual({ readonlyAxis: false, closedWorldAxis: false })
    // 单轴时代的形状:没有 dangerLevel ⇒ 旧判定一律免批。这里必须仍然不写它 ——
    // 本票改的是"两轴合取才免批",不是把 MCP 工具重新贴一档危险级别。
    expect(tool.dangerLevel).toBeUndefined()
  })

  it('openWorldHint 缺省按"碰外部世界"处置(MCP 规范里缺省即 true ⇒ 不许免批)', () => {
    const tool = mcpToolToTool(conn(), mcpDef('axes_openworld_default', { readOnlyHint: true }))
    expect(tool.approvalExemption).toEqual({ readonlyAxis: true, closedWorldAxis: false })
  })

  it('readOnlyHint 必须是显式 true 才算只读', () => {
    const tool = mcpToolToTool(conn(), mcpDef('axes_readonly_false', { readOnlyHint: false, openWorldHint: false }))
    expect(tool.approvalExemption).toEqual({ readonlyAxis: false, closedWorldAxis: true })
  })
})

describe('两轴合取在执行入口的行为(三条各一条反例)', () => {
  it('只读 ∧ 不碰外部世界 ⇒ 免批(不问人,直接执行)', async () => {
    const { tool, handler } = mcpToolWithStubHandler('both_axes_ok', {
      readOnlyHint: true,
      openWorldHint: false,
    })
    registerTools([tool])
    const confirm = vi.fn(async () => false)
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWith({ confirmDangerous: confirm }),
    )
    expect(confirm).not.toHaveBeenCalled()
    expect(r.success).toBe(true)
    expect(r.output).toBe('ran')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('只读,但**碰**外部世界 ⇒ 要问(轴 B 单独一条反例)', async () => {
    const { tool, handler } = mcpToolWithStubHandler('readonly_but_openworld', {
      readOnlyHint: true,
      openWorldHint: true,
    })
    registerTools([tool])
    const seen: string[] = []
    const confirm = vi.fn(async (t: Tool, _args: Record<string, unknown>) => {
      seen.push(t.name)
      return true
    })
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWith({ permissions: { allow: [tool.name] }, confirmDangerous: confirm }),
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    // 断言"问的就是这一只工具":用被捕获的实参,而不是 mock.calls 的元组下标
    expect(seen).toEqual([tool.name])
    expect(r.success).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('不碰外部世界,但**非只读** ⇒ 要问(轴 A 单独一条反例)', async () => {
    const { tool, handler } = mcpToolWithStubHandler('closedworld_but_write', {
      readOnlyHint: false,
      openWorldHint: false,
    })
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWith({ permissions: { allow: [tool.name] }, confirmDangerous: confirm }),
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('两轴都没自报 ⇒ 要问(改前那一整族"免批"的 MCP 工具现在都要批)', async () => {
    const { tool, handler } = mcpToolWithStubHandler('axes_unreported')
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWith({ confirmDangerous: confirm }),
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('用户拒绝 ⇒ 不执行(免批两轴不是"自动放行"的另一名字)', async () => {
    const { tool, handler } = mcpToolWithStubHandler('axes_declined', {})
    registerTools([tool])
    const confirm = vi.fn(async () => false)
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWith({ confirmDangerous: confirm }),
    )
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(r.success).toBe(false)
    expect(r.errorType).toBe('permission_denied')
    expect(r.denial?.gate).toBe('dangerous-gate')
    expect(handler).not.toHaveBeenCalled()
  })

  it('两轴都成立 + 规则 deny ⇒ 仍由规则先拒,且不问人(免批 ≠ 绕过拒绝)', async () => {
    const { tool, handler } = mcpToolWithStubHandler('axes_denied', {
      readOnlyHint: true,
      openWorldHint: false,
    })
    registerTools([tool])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: tool.name, arguments: {} },
      ctxWith({ permissions: { deny: [tool.name] }, confirmDangerous: confirm }),
    )
    expect(confirm).not.toHaveBeenCalled()
    expect(r.success).toBe(false)
    expect(r.denial?.gate).toBe('permission-rule')
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('覆盖面:两轴判据只作用于**声明过**它的工具(不翻任何缺省语义)', () => {
  it('内建工具(无 approvalExemption)行为逐字不变:不标危险就不问人', async () => {
    const builtin: Tool = {
      name: 'builtin_unmarked',
      description: 'fixture',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: vi.fn(async () => ({ success: true, output: 'ran' })),
    }
    registerTools([builtin])
    const confirm = vi.fn(async () => false)
    const r = await executeToolCall(
      { name: 'builtin_unmarked', arguments: {} },
      ctxWith({ confirmDangerous: confirm }),
    )
    expect(confirm).not.toHaveBeenCalled()
    expect(r.success).toBe(true)
  })

  it('requiresUserConfirmation 的四条判据(生产实现自身,给变异留靶)', () => {
    const base: Tool = {
      name: 'probe',
      description: 'fixture',
      parameters: {},
      required: [],
      execute: async () => ({ success: true, output: 'ok' }),
    }
    expect(requiresUserConfirmation(base)).toBe(false)
    expect(requiresUserConfirmation({ ...base, dangerLevel: 'dangerous' })).toBe(true)
    expect(
      requiresUserConfirmation({
        ...base,
        contract: {
          shape: { visibleToProvider: true, input: { type: 'object' } },
          permission: {
            permissionKey: 'probe',
            reason: 'fixture',
            riskLevel: 'read',
            effectScope: 'none',
            requiresApproval: false,
            alwaysAsk: true,
          },
          resultBudget: {
            inlineLimitBytes: 1024,
            providerVisibleLimitBytes: 1024,
            policy: 'inline',
            preview: { bytes: 512, lines: 8, from: 'head' },
          },
        },
      }),
    ).toBe(true)
    // 声明过而任一轴不成立 ⇒ 要问;两轴齐 ⇒ 免批;整对缺席 ⇒ 本判据不适用
    expect(requiresUserConfirmation({ ...base, approvalExemption: { readonlyAxis: true, closedWorldAxis: false } })).toBe(true)
    expect(requiresUserConfirmation({ ...base, approvalExemption: { readonlyAxis: false, closedWorldAxis: true } })).toBe(true)
    expect(requiresUserConfirmation({ ...base, approvalExemption: { readonlyAxis: true, closedWorldAxis: true } })).toBe(false)
    // 租约摘要漂移那一档未被本票改动
    expect(requiresUserConfirmation(base, true)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
