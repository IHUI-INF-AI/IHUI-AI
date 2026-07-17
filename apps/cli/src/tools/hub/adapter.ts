/**
 * P1-5 Computer Hub — Tool 适配器:把现有 Tool 包装成 ToolHandle。
 *
 * 简化策略(TS 无需 ErasedTool 擦除层):
 *   - 直接复用 Tool 类型,wrapTool 返回 ToolHandle
 *   - 字段映射:name → id, description, parameters, required, dangerLevel
 *   - execute 转发 args 与 ctx(参数顺序对齐 Tool.execute(args, ctx))
 */

import type { Tool } from '../index.js'
import type { ToolDescription, ToolHandle } from './registry.js'

/**
 * 把现有 Tool 包装成 ToolHandle。
 * - id 取自 tool.name
 * - describe() 返回 ToolDescription 快照
 * - execute(ctx, args) 转发为 tool.execute(args, ctx)(注意参数顺序)
 */
export function wrapTool(tool: Tool): ToolHandle {
  return {
    id: tool.name,
    describe(): ToolDescription {
      return {
        id: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        required: tool.required,
        dangerLevel: tool.dangerLevel,
      }
    },
    async execute(ctx, args) {
      return tool.execute(args, ctx)
    },
  }
}

/** 批量包装:tools.map(wrapTool)。 */
export function wrapTools(tools: Tool[]): ToolHandle[] {
  return tools.map(wrapTool)
}
