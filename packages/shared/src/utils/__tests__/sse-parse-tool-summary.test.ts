// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '../sse-parse'

/**
 * tool-summary 帧的三个新维度(directories / edits / terminalCommands)解析口径。
 *
 * 立因(2026-10-29):后端 `_build_tool_summary` 此前只发 8 键,新三档靠前端本地补齐;
 * 后端补齐之后,若解析层仍按 `numOr` 把这三维折成 `0`,界面上会显示"没碰目录 / 没编辑" ——
 * 那不是"上游没发",而是**解析层伪造了一个读数**。所以解析层必须是三态:
 *   有有限数字 ⇒ 原样带出;缺失 / 非数字 / null ⇒ **不带键**(undefined),交由渲染层判。
 * 这条与 `sse-parse-finish-reason.test.ts`(G-425 的"缺席 ≠ stop")是同一条纪律。
 */

function toolSummaryOf(payload: Record<string, unknown>) {
  const { events } = parseSSEChunk(`data: ${JSON.stringify(payload)}\n`)
  return events[0]?.toolSummary
}

const BASE = {
  type: 'tool-summary',
  filesSearched: 2,
  webSearched: 1,
  filesModified: 3,
  linesAdded: 10,
  linesDeleted: 4,
  toolsByCategory: { read_file: 2, write_file: 3 },
  totalCalls: 5,
  totalDurationMs: 1200,
}

describe('sse-parse tool-summary 新三档透传', () => {
  it('阳性:三键都在 ⇒ 原样带出(不被折成默认值)', () => {
    const s = toolSummaryOf({ ...BASE, directories: 4, edits: 3, terminalCommands: 2 })
    expect(s?.directories).toBe(4)
    expect(s?.edits).toBe(3)
    expect(s?.terminalCommands).toBe(2)
  })

  it('零也是有效读数:三键为 0 时必须带出 0,而不是当作"缺失"', () => {
    const s = toolSummaryOf({ ...BASE, directories: 0, edits: 0, terminalCommands: 0 })
    expect(s?.directories).toBe(0)
    expect(s?.edits).toBe(0)
    expect(s?.terminalCommands).toBe(0)
  })

  it('阴性:旧后端帧(只有 8 键)⇒ 三键缺席,不得用 0 冒充', () => {
    const s = toolSummaryOf(BASE)
    expect(s?.directories).toBeUndefined()
    expect(s?.edits).toBeUndefined()
    expect(s?.terminalCommands).toBeUndefined()
  })

  it('阴性:非数字 / null / 非有限值 ⇒ 不带键', () => {
    for (const bad of ['4', null, Number.NaN, Number.POSITIVE_INFINITY] as const) {
      const s = toolSummaryOf({
        ...BASE,
        directories: bad,
        edits: bad,
        terminalCommands: bad,
      })
      expect(s?.directories).toBeUndefined()
      expect(s?.edits).toBeUndefined()
      expect(s?.terminalCommands).toBeUndefined()
    }
  })

  it('既有 8 键不受影响(回归:仍按 numOr 折 0)', () => {
    const s = toolSummaryOf(BASE)
    expect(s).toMatchObject({
      filesSearched: 2,
      webSearched: 1,
      filesModified: 3,
      linesAdded: 10,
      linesDeleted: 4,
      totalCalls: 5,
      totalDurationMs: 1200,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
