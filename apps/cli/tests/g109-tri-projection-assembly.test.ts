// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * G-109 三条独立投影装配档(2026-10-23)。
 *
 * 票面钉的是**三个字段各自有界、互不代替**:
 *   ① modelContent —— 给模型的,100_000 B 预算,截断时带结论位与数字;
 *   ② display      —— 给人看的,独立限长(行 160 / 文本 4×16 KiB),不吃模型预算;
 *   ③ persistence  —— 落库的,display 全文 + serialization 四数 + artifactPath,结构上没有 content。
 * 另有「小输出三面一致」与「persistence 不含 content」两臂。
 */
import { describe, expect, it } from 'vitest'

import {
  assembleToolResultProjections,
  TOOL_RESULT_DISPLAY_LINE_LIMIT,
  TOOL_RESULT_DISPLAY_TEXT_BUDGET_BYTES,
  TOOL_RESULT_MODEL_CONTENT_BUDGET_BYTES,
  type ToolResult,
} from '../src/tools/index.js'

const bytes = (s: string): number => Buffer.byteLength(s, 'utf8')

describe('G-109 大输出:三条投影各自截断且互不影响', () => {
  it('超过模型预算 ⇒ modelContent 截到 100_000 B 且带结论位+数字,display 另有自己的上限', () => {
    const original = 'H'.repeat(TOOL_RESULT_MODEL_CONTENT_BUDGET_BYTES + 20_000)
    const out = assembleToolResultProjections({ success: true, output: original })

    // ① 模型侧:严格不越预算,且注记点明 truncated 与三枚数字
    expect(bytes(out.modelContent!)).toBeLessThanOrEqual(TOOL_RESULT_MODEL_CONTENT_BUDGET_BYTES)
    expect(out.modelContent).toContain('[tool-result-budget] model content truncated')
    expect(out.modelContent).toContain(`original ${bytes(original)} bytes`)
    expect(out.modelContent).toContain(`budget ${TOOL_RESULT_MODEL_CONTENT_BUDGET_BYTES} bytes`)
    expect(out.modelContent).toContain('strategy: truncate')
    // 旧字段仍是模型侧:装配后与 modelContent 同值,旧调用方零改动
    expect(out.output).toBe(out.modelContent)

    // ② 人读侧:受自己的上限管,与模型预算无关
    expect(out.display).toBeDefined()
    expect(bytes(out.display!.text)).toBeLessThanOrEqual(TOOL_RESULT_DISPLAY_TEXT_BUDGET_BYTES)
    expect(out.display!.truncated).toBe(true)
    expect(out.display!.originalBytes).toBe(bytes(original))
    expect(out.display!.returnedBytes).toBe(bytes(out.display!.text))
    expect(out.display!.returnedBytes).toBeLessThan(out.display!.originalBytes)
    expect(out.display!.budgetStrategy).toBe('truncate')

    // ③ 落库侧:只搬 display 的四数,数字与 display 逐项对齐
    expect(out.persistence).toBeDefined()
    expect(out.persistence!.display).toBe(out.display!.text)
    expect(out.persistence!.truncated).toBe(true)
    expect(out.persistence!.originalBytes).toBe(out.display!.originalBytes)
    expect(out.persistence!.returnedBytes).toBe(out.display!.returnedBytes)
    expect(out.persistence!.budgetStrategy).toBe('truncate')
  })

  it('行数超 160 ⇒ 只有 display 被行闸裁,modelContent 一个字节都没动', () => {
    const original = Array.from({ length: TOOL_RESULT_DISPLAY_LINE_LIMIT + 40 }, (_, i) => `line-${i}`).join('\n')
    const out = assembleToolResultProjections({ success: true, output: original })

    // 模型侧未超预算 ⇒ 逐字原样(display 的裁剪绝不反向影响模型)
    expect(out.modelContent).toBe(original)
    expect(out.display!.text.split('\n')).toHaveLength(TOOL_RESULT_DISPLAY_LINE_LIMIT)
    expect(out.display!.text).toContain('line-0')
    expect(out.display!.text).not.toContain(`line-${TOOL_RESULT_DISPLAY_LINE_LIMIT + 39}`)
    expect(out.display!.truncated).toBe(true)
    expect(out.persistence!.truncated).toBe(true)
    expect(out.persistence!.returnedBytes).toBeLessThan(out.persistence!.originalBytes)
  })

  it('字节超 display 文本预算但未超模型预算 ⇒ 两本账可判且互不牵连', () => {
    const original = 'd'.repeat(TOOL_RESULT_DISPLAY_TEXT_BUDGET_BYTES + 5_000)
    const out = assembleToolResultProjections({ success: true, output: original })

    expect(out.modelContent).toBe(original) // 模型侧未截
    expect(bytes(out.display!.text)).toBe(TOOL_RESULT_DISPLAY_TEXT_BUDGET_BYTES) // display 侧硬闸
    expect(out.display!.truncated).toBe(true)
    expect(out.display!.returnedBytes).toBeLessThan(out.display!.originalBytes)
  })
})

describe('G-109 小输出:三面一致', () => {
  it('未超任何上限 ⇒ 原样返回同一引用(三投影本就同文,不造重复载荷)', () => {
    const original = 'ok\nline-2'
    const result: ToolResult = { success: true, output: original }
    const out = assembleToolResultProjections(result)

    expect(out).toBe(result)
    // consumers 的三条读法指向同一份内容
    expect(out.modelContent ?? out.output).toBe(original)
    expect(out.display?.text ?? out.output).toBe(original)
    expect(out.persistence?.display ?? out.output).toBe(original)
    // 旧调用方看到的形状一字不变
    expect(Object.keys(out).sort()).toEqual(['output', 'success'])
  })

  it('artifactPath 只做原样透传,缺席时不凭空补', () => {
    const withArtifact = assembleToolResultProjections({
      success: true,
      output: 'enveloped preview',
      artifactPath: 'artifacts/read_file/1.txt',
    })
    expect(withArtifact.persistence!.artifactPath).toBe('artifacts/read_file/1.txt')
    expect(withArtifact.persistence!.display).toBe('enveloped preview')
    expect(withArtifact.persistence!.truncated).toBe(false)
    const without = assembleToolResultProjections({ success: true, output: 'plain' })
    expect(without.persistence).toBeUndefined()
  })
})

describe('G-109 落库面:不含 content', () => {
  it('persistence 结构上只有 display 与四数(大输出里模型侧注记不得出现)', () => {
    const original = 'Z'.repeat(TOOL_RESULT_MODEL_CONTENT_BUDGET_BYTES + 10)
    const out = assembleToolResultProjections({ success: true, output: original })

    const keys = Object.keys(out.persistence!).sort()
    expect(keys).toEqual(
      ['budgetStrategy', 'display', 'originalBytes', 'returnedBytes', 'truncated'].sort(),
    )
    expect(out.persistence).not.toHaveProperty('content')
    expect(out.persistence).not.toHaveProperty('output')
    expect(out.persistence).not.toHaveProperty('modelContent')
    // 模型侧注记只属于 modelContent,绝不落进落库面
    expect(JSON.stringify(out.persistence)).not.toContain('model content truncated')
    // 落进落库面的 display 本身也受 display 上限管,不是原始全文
    expect(bytes(out.persistence!.display)).toBeLessThanOrEqual(TOOL_RESULT_DISPLAY_TEXT_BUDGET_BYTES)
    expect(out.persistence!.display).not.toBe(original)
  })

  it('空输出(拒绝/无内容)原样返回,不造空投影', () => {
    const result: ToolResult = { success: false, output: '', error: 'denied' }
    expect(assembleToolResultProjections(result)).toBe(result)
  })
})
