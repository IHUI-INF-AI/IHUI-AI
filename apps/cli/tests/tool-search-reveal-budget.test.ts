// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 揭示预算 —— 钉住"检索越多、常驻面越胀"这条曲线的上限。
 *
 * 立因:实测 15 次检索揭示 63 枚后，默认面从 15,475B 涨到 25,378B(+64%)，延迟装载的收益
 * 被吃掉一半；`revealed` 原先只增不减。判据钉字节，不钉枚数（schema 体量差异太大）。
 *
 * 口径边界:只测"揭示集合的字节账"，不测模型在被回收后会不会改用 tool_search 再查一次。
 */
import { describe, expect, it } from 'vitest'
import { createToolSearchTool, REVEAL_BUDGET_BYTES } from '../src/tools/tool-search.js'
import { renderToolSchema } from '../src/tools/tool-surface.js'
import { shouldDeferTool } from '../src/tools/defer-policy.js'
import type { Tool, ToolResult } from '../src/tools/index.js'

const CTX = { workspacePath: process.cwd(), permissions: {} } as never

/** 造一枚 schema 体量可控的假工具:参数越多，renderToolSchema 越长。 */
function makeTool(name: string, params = 8, opts: Partial<Tool> = {}): Tool {
  const parameters: Record<string, { type: string; description: string }> = {}
  for (let i = 0; i < params; i += 1) {
    parameters[`field_${String(i).padStart(3, '0')}`] = {
      type: 'string',
      description: `参数 ${String(i).padStart(3, '0')} 的说明文字，用来把 schema 撑到可测的体量(约四十个字符的描述)`,
    }
  }
  return {
    name,
    description: `fake ${name} 工具说明`,
    parameters,
    required: [],
    dangerLevel: 'read',
    async execute(): Promise<ToolResult> {
      return { success: true, output: 'ok' }
    },
    ...opts,
  } as Tool
}

function deferredCost(revealed: Set<string>, tools: readonly Tool[]): number {
  const byName = new Map(tools.map((tool) => [tool.name, tool] as const))
  let total = 0
  for (const name of revealed) {
    const tool = byName.get(name)
    if (tool !== undefined && shouldDeferTool(tool.name, tool)) total += renderToolSchema(tool).length
  }
  return total
}

describe('揭示预算(字节封顶)', () => {
  it('反复检索也不会让延迟工具的揭示体量越过预算', async () => {
    const tools = Array.from({ length: 20 }, (_, i) => makeTool(`batch_budget_${String(i).padStart(3, '0')}`))
    const perTool = renderToolSchema(tools[0]!).length
    const budget = perTool * 3
    const revealed = new Set<string>()
    const search = createToolSearchTool({ revealed, tools: () => tools, revealBudgetBytes: budget })
    for (const tool of tools) {
      await search.execute({ tool_names: [tool.name] }, CTX)
      expect(deferredCost(revealed, tools)).toBeLessThanOrEqual(budget)
    }
    // 预算必须真的能装下工具，否则"封顶"只是把功能关掉。
    expect(revealed.size).toBeGreaterThan(0)
  })

  it('预算满时回收最久未命中的，刚命中的一律不动', async () => {
    const tools = Array.from({ length: 20 }, (_, i) => makeTool(`batch_evict_${String(i).padStart(3, '0')}`))
    const perTool = renderToolSchema(tools[0]!).length
    const revealed = new Set<string>()
    const search = createToolSearchTool({ revealed, tools: () => tools, revealBudgetBytes: perTool * 3 })
    for (const tool of tools) {
      const result = await search.execute({ tool_names: [tool.name] }, CTX)
      expect(result.success).toBe(true)
      // 刚检索出来的工具必须在集合里，否则等于白检索。
      expect(revealed.has(tool.name)).toBe(true)
    }
    expect(revealed.has('batch_evict_000')).toBe(false)
    expect(revealed.has('batch_evict_019')).toBe(true)
  })

  it('重命中会把顺序刷新到队尾(常用的不会被先回收)', async () => {
    const tools = Array.from({ length: 10 }, (_, i) => makeTool(`batch_hot_${String(i).padStart(3, '0')}`))
    const perTool = renderToolSchema(tools[0]!).length
    const revealed = new Set<string>()
    const search = createToolSearchTool({ revealed, tools: () => tools, revealBudgetBytes: perTool * 3 })
    for (const tool of tools.slice(0, 3)) await search.execute({ tool_names: [tool.name] }, CTX)
    // 刷新 batch_hot_0，再塞一枚新的 ⇒ 被回收的应当是最久未命中的 batch_hot_1。
    await search.execute({ tool_names: ['batch_hot_000'] }, CTX)
    await search.execute({ tool_names: ['batch_hot_003'] }, CTX)
    expect(revealed.has('batch_hot_000')).toBe(true)
    expect(revealed.has('batch_hot_003')).toBe(true)
    expect(revealed.has('batch_hot_001')).toBe(false)
  })

  it('常驻工具命中不占预算(它的 schema 本来就在前缀里)', async () => {
    const tools = [makeTool('zz_resident', 12, { deferLoading: false }), makeTool('batch_deferred', 8)]
    const revealed = new Set<string>()
    const search = createToolSearchTool({ revealed, tools: () => tools })
    await search.execute({ tool_names: ['zz_resident'] }, CTX)
    expect(revealed.has('zz_resident')).toBe(true)
    expect(deferredCost(revealed, tools)).toBe(0)
  })

  it('生产缺省预算是 6000B，且回收说明会回给模型', async () => {
    expect(REVEAL_BUDGET_BYTES).toBe(6000)
    const tools = Array.from({ length: 13 }, (_, i) => makeTool(`batch_note_${String(i).padStart(3, '0')}`))
    const perTool = renderToolSchema(tools[0]!).length
    const revealed = new Set<string>()
    const search = createToolSearchTool({ revealed, tools: () => tools, revealBudgetBytes: perTool * 2 })
    // 先塞满预算(2 枚)，再揭示第 3 枚 ⇒ 这一趟必然发生回收。
    for (const tool of tools.slice(0, 2)) await search.execute({ tool_names: [tool.name] }, CTX)
    const last = await search.execute({ tool_names: ['batch_note_002'] }, CTX)
    // 发生过回收的那一次，输出里必须有一句可核对的说明。
    expect(String(last.output)).toContain('揭示预算')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
