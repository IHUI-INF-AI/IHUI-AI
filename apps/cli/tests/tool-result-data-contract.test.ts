// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `ToolResult.data` 契约面的最小夹具(配套 `tools/index.ts` 的 `data` 字段声明)。
 *
 * 立票理由:`ff669e19e5` 给 `ToolResult` 补了 `data?: Record<string, unknown>`
 * ——browser-page 一族 handler 早就随结果返回结构化载荷,只是契约面此前没声明,
 * 于是"契约里没有"被读成"运行时也没有"。该改动**无运行时分支**,可回归的只有两面:
 *  ① 字段必须在类型面存在(去掉声明,本文件的 `result.data` 直接编译失败);
 *  ② 装配点(`assembleToolResultProjections` 的投影)必须原样透传 `data`,不得吞掉。
 * 刻意不 mock 子进程/浏览器等重模块:只走 `registerTools` + `executeToolCall` 的本地最短链路。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearTools, executeToolCall, registerTools, type Tool } from '../src/tools/index.js'

const WS = 'G:/IHUI-AI/apps/cli'

function makeTool(overrides: Partial<Tool> & { name: string }): Tool {
  return {
    description: '返回结构化载荷的最小工具',
    parameters: { type: 'object', properties: {} },
    required: [],
    dangerLevel: 'read',
    execute: vi.fn(async () => ({ success: true, output: 'ok' })),
    ...overrides,
  } as unknown as Tool
}

beforeEach(() => {
  clearTools()
})

describe('ToolResult.data 契约面', () => {
  it('handler 自述的结构化载荷经 executeToolCall 原样透传', async () => {
    const payload = { scope: 'page', counts: { items: 2 }, sideEffect: 'read' }
    registerTools([
      makeTool({
        name: 'echo_structured',
        execute: vi.fn(async () => ({ success: true, output: 'ok', data: payload })),
      }),
    ])

    const result = await executeToolCall(
      { name: 'echo_structured', arguments: {} },
      { workspacePath: WS },
    )

    expect(result.success).toBe(true)
    expect(result.data).toEqual(payload)
  })

  it('契约允许缺席:不返回 data 的工具不得被补成空对象', async () => {
    registerTools([makeTool({ name: 'plain' })])

    const result = await executeToolCall({ name: 'plain', arguments: {} }, { workspacePath: WS })

    expect(result.success).toBe(true)
    expect(result.data).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
