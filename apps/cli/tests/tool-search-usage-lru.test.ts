// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 热使用并入揭示 LRU —— 成功调用一次 = 最近用到。
 *
 * 立因:预算回收只按"被检索"排序;按名直调(名字来自延迟目录)不算热使用,
 * 于是常用工具被回收、搜过没用过的反而留着。这里钉住:
 *   1. 调用过就升为揭示;2. 刷新 LRU 序;3. 常驻工具不占预算也不挤人;
 *   4. executeToolCall 只在**成功**后上报,且上报故障不改结果。
 */
import { describe, expect, it, vi } from 'vitest'

import { clearTools, executeToolCall, listTools, registerTools, type Tool } from '../src/tools/index.js'
import { createToolSearchTool, noteRevealedToolUsage } from '../src/tools/tool-search.js'
import { renderToolSchema } from '../src/tools/tool-surface.js'

const CTX = {
  workspacePath: process.cwd(),
  sessionId: 'usage-lru',
  turnId: 'turn-1',
  permissions: { mode: 'default' },
} as never

function fakeTool(name: string, opts: { deferLoading?: boolean; succeed?: boolean } = {}): Tool {
  return {
    name,
    description: `${name} 的说明`,
    parameters: { path: { type: 'string', description: '路径参数用来撑 schema' } },
    required: ['path'],
    dangerLevel: 'read',
    deferLoading: opts.deferLoading,
    async execute() {
      if (opts.succeed === false) return { success: false, output: '', error: 'boom' }
      return { success: true, output: 'ran' }
    },
  }
}

describe('热使用并入揭示 LRU', () => {
  it('调用过的延迟工具升为揭示', () => {
    const tools = [fakeTool('lazy_one', { deferLoading: true })]
    const revealed = new Set<string>()
    const r = noteRevealedToolUsage('lazy_one', tools, revealed)
    expect(r.promoted).toBe(true)
    expect(revealed.has('lazy_one')).toBe(true)
  })

  it('刷新到队尾:最久未用的先被回收,刚用过的留下', () => {
    const tools = ['a', 'b', 'c', 'd'].map((n) => fakeTool(n, { deferLoading: true }))
    const perTool = renderToolSchema(tools[0]!).length
    const revealed = new Set(['a', 'b', 'c'])
    // a 最旧 → 用过一次即刷新到队尾(本次预算够放 3 枚,不触发回收)
    noteRevealedToolUsage('a', tools, revealed, perTool * 3)
    expect(Array.from(revealed)).toEqual(['b', 'c', 'a'])
    // 再加 d,预算只够 3 枚:该被回收的是最旧未用的 b —— 若没刷新过,被回收的会是 a。
    const r = noteRevealedToolUsage('d', tools, revealed, perTool * 3)
    expect(r.promoted).toBe(true)
    expect(r.evicted).toEqual(['b'])
    expect(Array.from(revealed).sort()).toEqual(['a', 'c', 'd'])
  })

  it('常驻工具不占预算、不挤掉延迟工具', () => {
    const tools = [fakeTool('resident', { deferLoading: false }), fakeTool('lazy', { deferLoading: true })]
    const revealed = new Set(['lazy'])
    const r = noteRevealedToolUsage('resident', tools, revealed)
    expect(r).toEqual({ promoted: false, evicted: [] })
    expect(revealed.has('resident')).toBe(false)
  })

  it('executeToolCall:成功后上报一次,失败不上报', async () => {
    clearTools()
    registerTools([fakeTool('lazy_ok', { deferLoading: true }), fakeTool('lazy_bad', { deferLoading: true, succeed: false })])
    const note = vi.fn()
    const ctx = { ...(CTX as object), noteToolUsage: note } as never
    const ok = await executeToolCall({ name: 'lazy_ok', arguments: { path: 'x' } }, ctx)
    expect(ok.success).toBe(true)
    expect(note).toHaveBeenCalledTimes(1)
    expect(note).toHaveBeenCalledWith('lazy_ok')
    const bad = await executeToolCall({ name: 'lazy_bad', arguments: { path: 'x' } }, ctx)
    expect(bad.success).toBe(false)
    expect(note).toHaveBeenCalledTimes(1)
  })

  it('上报口自己抛错也不改工具结果', async () => {
    clearTools()
    registerTools([fakeTool('lazy_ok', { deferLoading: true })])
    const ctx = {
      ...(CTX as object),
      noteToolUsage: () => {
        throw new Error('note 炸了')
      },
    } as never
    const r = await executeToolCall({ name: 'lazy_ok', arguments: { path: 'x' } }, ctx)
    expect(r.success).toBe(true)
    expect(r.output).toBe('ran')
  })

  it('与 tool_search 共用同一份 revealed:检索后再用,顺序继续刷新', async () => {
    clearTools()
    registerTools([fakeTool('lazy_a', { deferLoading: true }), fakeTool('lazy_b', { deferLoading: true })])
    const tools = listTools()
    const revealed = new Set<string>()
    const search = createToolSearchTool({ revealed, tools: () => tools })
    await search.execute({ tool_names: ['lazy_a'] }, CTX)
    await search.execute({ tool_names: ['lazy_b'] }, CTX)
    expect(Array.from(revealed)).toEqual(['lazy_a', 'lazy_b'])
    noteRevealedToolUsage('lazy_a', tools, revealed)
    expect(Array.from(revealed)).toEqual(['lazy_b', 'lazy_a'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
