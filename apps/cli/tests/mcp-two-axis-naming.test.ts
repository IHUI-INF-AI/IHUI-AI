// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-422:MCP 工具两轴注册名 `mcp__<server>__<tool>` + 改名安全(新旧两名并查 allow/deny)。
 *
 * 三条判据缺一不可:
 *  ① **两轴名**:注册名带 server 轴(与 hub/mcp-adapter 同一个 helper),裸名降级为别名;
 *  ② **跨服同名不再静默顶掉**:两台服务器都暴露 `web_search` 时,各自以不同的两轴名注册,
 *     先到者不被后到者盖掉;真发生跨归属同名(如内建占名)时走**注册冲突台账**,不静默 set;
 *  ③ **旧名 denylist 仍拦得住**:升级前保存的 `--disallowed-tools web_search`(裸名,旧命名)
 *     必须仍能拦住改名后的 `mcp__alpha__web_search` —— 否则那份黑名单会静默失效并放行。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearTools,
  executeToolCall,
  getTool,
  getToolRegistrationConflicts,
  registerTools,
  resetRateLimiter,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js'
import {
  mcpToolName,
  mcpToolToTool,
  type McpConnection,
  type McpToolDef,
} from '../src/tools/mcp-runtime.js'
import { checkPermission } from '../src/tools/permissions.js'

/** mcpToolToTool 只读 `server.name`;tools 留空即可 */
function conn(serverName: string): McpConnection {
  return {
    server: { name: serverName } as McpConnection['server'],
    tools: [],
    connected: true,
    transport: 'stdio',
    ssePending: new Map(),
    sseNextId: 1,
  }
}

function mcpDef(name: string): McpToolDef {
  return { name, description: `fixture ${name}`, inputSchema: { type: 'object' } }
}

/** 生产转换 + 只替换 handler(execute 走真 tools/call 必然抛错,与命名判据无关) */
function mcpTool(serverName: string, toolName: string): Tool {
  const real = mcpToolToTool(conn(serverName), mcpDef(toolName))
  return { ...real, execute: vi.fn(async () => ({ success: true, output: 'ran' })) }
}

function ctxWith(overrides: Partial<ToolContext> = {}): ToolContext {
  return { workspacePath: '.', ...overrides }
}

beforeEach(() => {
  clearTools()
  resetRateLimiter()
})
afterEach(() => {
  clearTools()
  vi.restoreAllMocks()
})

describe('① 两轴注册名', () => {
  it('mcpToolName 生成 mcp__<server>__<tool>(唯一格式出口)', () => {
    expect(mcpToolName('alpha', 'web_search')).toBe('mcp__alpha__web_search')
  })

  it('mcpToolToTool 以两轴名注册,并把裸名登记为别名(旧名)', () => {
    const tool = mcpToolToTool(conn('alpha'), mcpDef('web_search'))
    expect(tool.name).toBe('mcp__alpha__web_search')
    expect(tool.nameAliases).toEqual(['web_search'])
    expect(tool.registrationOwner).toBe('mcp:alpha')
  })
})

describe('② 跨服同名不再静默互相顶掉', () => {
  it('两台服务器都暴露 web_search ⇒ 各自两轴名注册,先到者不被盖掉', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    registerTools([mcpTool('alpha', 'web_search')])
    registerTools([mcpTool('beta', 'web_search')])

    expect(getTool('mcp__alpha__web_search')?.registrationOwner).toBe('mcp:alpha')
    expect(getTool('mcp__beta__web_search')?.registrationOwner).toBe('mcp:beta')
    // 两轴名不同 ⇒ 结构上不冲突,不应产生任何注册冲突
    expect(getToolRegistrationConflicts().join('\n')).not.toContain('mcp__alpha__web_search')
    expect(warn).not.toHaveBeenCalled()
  })

  it('真发生跨归属同名(内建已占两轴名)⇒ 记入冲突台账,不静默覆盖', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {})
    const toolName = `probe_${Date.now()}`
    const twoAxis = mcpToolName('collide', toolName)
    const builtin: Tool = {
      name: twoAxis,
      description: 'builtin-holder',
      parameters: {},
      required: [],
      execute: vi.fn(async () => ({ success: true, output: 'builtin' })),
    }
    registerTools([builtin])
    registerTools([mcpTool('collide', toolName)])

    // 先到者保留
    expect(getTool(twoAxis)?.description).toBe('builtin-holder')
    const conflicts = getToolRegistrationConflicts().join('\n')
    expect(conflicts).toContain(twoAxis)
    expect(conflicts).toContain('mcp:collide')
    expect(warn).toHaveBeenCalled()
  })
})

describe('③ 改名安全:旧名 denylist 仍拦住改名后的工具', () => {
  it('deny 写旧裸名 ⇒ 两轴新名的调用在生产入口被拦(permission_denied)', async () => {
    registerTools([mcpTool('alpha', 'web_search')])
    const confirm = vi.fn(async () => true)
    const r = await executeToolCall(
      { name: 'mcp__alpha__web_search', arguments: {} },
      ctxWith({ permissions: { deny: ['web_search'] }, confirmDangerous: confirm }),
    )
    expect(r.success).toBe(false)
    expect(r.errorType).toBe('permission_denied')
    expect(r.denial?.gate).toBe('permission-rule')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('对照:不带别名时旧名不再命中(证明别名是承重的,不是装饰)', () => {
    // 传 undefined 别名 = 未登记旧名的普通工具 ⇒ 旧名规则不该命中
    expect(checkPermission('mcp__alpha__web_search', { deny: ['web_search'] }, 'bypassPermissions', 'read')).toBe(
      'allow',
    )
    // 传旧名别名 ⇒ 命中 deny
    expect(
      checkPermission('mcp__alpha__web_search', { deny: ['web_search'] }, 'bypassPermissions', 'read', undefined, [
        'web_search',
      ]),
    ).toBe('deny')
  })

  it('白名单旧名同样放行新名(mode-aware:manual 档本该 ask,规则 allow 优先放行)', () => {
    expect(
      checkPermission('mcp__alpha__web_search', { allow: ['web_search'] }, 'manual', 'write', undefined, [
        'web_search',
      ]),
    ).toBe('allow')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
