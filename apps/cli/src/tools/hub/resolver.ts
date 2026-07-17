/**
 * P1-5 Computer Hub — Layer 3: CompoundResolver(local-shadows-remote)。
 *
 * 灵感来源:grok-build 的 `xai-computer-hub-core` CompoundResolver。
 * 简化策略(做减法):
 *   - local-shadows-remote:同名工具时 local 胜(允许本地工具覆盖 MCP 工具)
 *   - 不分 session,resolve(toolId) 单参数
 *   - dispatch 失败抛 ToolNotFoundError(由调用方决定如何回传给 LLM)
 *   - 不实现 Transport / ConnectionId / ServerId 绑定
 */

import type { ToolHandle, ToolRegistry } from './registry.js'
import type { ToolContext, ToolResult } from '../index.js'

/**
 * 解析后的工具引用。
 * - kind: 'local'(本地注册)或 'remote'(远程/MCP 注册)
 * - source: 来源标识,当前为 'local' / 'remote',后续可扩展为 'mcp:<serverName>' 等
 */
export interface ResolvedTool {
  kind: 'local' | 'remote'
  handle: ToolHandle
  source: string
}

/**
 * 工具未找到错误。
 * dispatch 在 resolve 失败时抛出,调用方可捕获并转为 ToolResult.errorType='not_found'。
 */
export class ToolNotFoundError extends Error {
  constructor(public toolId: string) {
    super(`Tool not found: ${toolId}`)
    this.name = 'ToolNotFoundError'
  }
}

/**
 * 组合解析器 — local 优先于 remote。
 * local 命中即返回;否则查 remote;都未命中返回 undefined。
 */
export class CompoundResolver {
  constructor(
    private local: ToolRegistry,
    private remote?: ToolRegistry,
  ) {}

  /**
   * 解析工具:local-shadows-remote。
   * 返回 ResolvedTool 或 undefined(未找到)。
   */
  resolve(toolId: string): ResolvedTool | undefined {
    const local = this.local.find(toolId)
    if (local) return { kind: 'local', handle: local, source: 'local' }
    const remote = this.remote?.find(toolId)
    if (remote) return { kind: 'remote', handle: remote, source: 'remote' }
    return undefined
  }

  /**
   * 解析并执行工具。
   * resolve 失败时抛 ToolNotFoundError,由调用方捕获。
   */
  async dispatch(
    toolId: string,
    args: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const resolved = this.resolve(toolId)
    if (!resolved) throw new ToolNotFoundError(toolId)
    return resolved.handle.execute(ctx, args)
  }
}
