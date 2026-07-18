/**
 * P1-5 Computer Hub — Layer 2: ToolRegistry 接口与 InMemoryRegistry 实现。
 *
 * 灵感来源:参考行业 Agent 框架的 computer-hub-core crate 设计。
 * 简化策略(做减法):
 *   - 跳过 Transport / Principal / authorize 抽象层,直接走 CompoundResolver
 *   - 不分 session(CLI 单进程场景,默认全部工具共享一个注册表)
 *   - newest-wins:同 id 重复 register,后者覆盖前者(通过递增 seq 实现)
 *   - 零新依赖,只用 Map / Promise
 */

import type { ToolContext, ToolResult } from '../index.js'

/**
 * 工具描述快照(只读,用于 list / prompt 构造)。
 * parameters 复用现有 Tool.parameters 的结构(Record<string, unknown> 放宽以兼容)。
 * dangerLevel 对齐现有 Tool 的 'read' | 'write' | 'dangerous' 语义。
 */
export interface ToolDescription {
  id: string
  description: string
  parameters?: Record<string, unknown>
  required?: string[]
  dangerLevel?: 'read' | 'write' | 'dangerous'
}

/**
 * 工具句柄 — 统一的执行抽象。
 * 适配自现有 Tool(wrapTool)或 MCP 远程工具(后续接入)。
 */
export interface ToolHandle {
  readonly id: string
  describe(): ToolDescription
  execute(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult>
}

/**
 * 工具注册表接口。
 * 简化版,不分 session — find/list/clear/size 均为单参数或无参数。
 */
export interface ToolRegistry {
  register(t: ToolHandle): void
  unregister(toolId: string): boolean
  find(toolId: string): ToolHandle | undefined
  list(): ToolDescription[]
  clear(): void
  size(): number
}

interface RegistryEntry {
  handle: ToolHandle
  /** 注册顺序号,用于 newest-wins 排序(当前实现未直接使用,保留供未来扩展) */
  seq: number
}

/**
 * 内存版工具注册表。
 * 内部用 Map<toolId, { handle, seq }> 管理,register 时 seq 递增。
 * 同 id 重复 register 直接覆盖 Map 中的 entry(newest-wins)。
 */
export class InMemoryRegistry implements ToolRegistry {
  private tools = new Map<string, RegistryEntry>()
  private seqCounter = 0

  register(t: ToolHandle): void {
    this.seqCounter++
    this.tools.set(t.id, { handle: t, seq: this.seqCounter })
  }

  unregister(toolId: string): boolean {
    return this.tools.delete(toolId)
  }

  find(toolId: string): ToolHandle | undefined {
    return this.tools.get(toolId)?.handle
  }

  list(): ToolDescription[] {
    const list: ToolDescription[] = []
    for (const entry of this.tools.values()) {
      list.push(entry.handle.describe())
    }
    return list
  }

  clear(): void {
    this.tools.clear()
  }

  size(): number {
    return this.tools.size
  }
}
