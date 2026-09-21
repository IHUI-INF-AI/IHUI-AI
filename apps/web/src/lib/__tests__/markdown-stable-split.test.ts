// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { MARKDOWN_SPLIT_MIN_LENGTH, splitMarkdownStable } from '../markdown-stable-split'

/** 构造超阈值文本(重复填充到指定长度)。 */
function pad(text: string, minLen: number): string {
  let s = text
  const filler = '\n\n这是填充段落,用于超过切分长度阈值。' + 'x'.repeat(20)
  while (s.length < minLen) s += filler
  return s
}

/**
 * P3 #35 流式 markdown 稳定段切分测试(2026-09-16 立)
 */
describe('splitMarkdownStable', () => {
  it('短内容(<1500)不切分:stable 空,active 全文', () => {
    const short = '# 标题\n\n一段内容。'
    const out = splitMarkdownStable(short)
    expect(out).toEqual({ stable: '', active: short })
  })

  it('长内容在最后的顶层空行处切分,stable+active 拼回原文', () => {
    const head = pad('# 标题\n\n第一段。', MARKDOWN_SPLIT_MIN_LENGTH)
    const full = `${head}\n\n尾部活跃段落,正在流式输出`
    const out = splitMarkdownStable(full)
    expect(out.stable.length).toBeGreaterThan(0)
    expect(out.stable + out.active).toBe(full)
    expect(out.active).toContain('尾部活跃段落')
  })

  it('代码围栏内的空行不是切点(围栏内容不被切断)', () => {
    const head = pad('引言段。', MARKDOWN_SPLIT_MIN_LENGTH)
    const full = `${head}\n\n\`\`\`python\ndef f():\n    # 围栏内空行\n\n    return 1\n\`\`\`\n\n围栏后文本`
    const out = splitMarkdownStable(full)
    expect(out.stable + out.active).toBe(full)
    // 切点不应落在围栏内部:stable 要么不含围栏,要么含完整围栏
    const fenceCount = (out.stable.match(/```/g) ?? []).length
    expect(fenceCount % 2).toBe(0)
  })

  it('空行后是列表项 → 该空行不是切点(保护列表编号)', () => {
    const head = pad('引言段。', MARKDOWN_SPLIT_MIN_LENGTH)
    const full = `${head}\n\n1. 第一项\n\n2. 第二项\n\n3. 第三项`
    const out = splitMarkdownStable(full)
    expect(out.stable + out.active).toBe(full)
    // 切点不能紧跟列表项之后(否则下一项成为新列表首项,有序编号从 1 重置)
    if (out.stable) {
      expect(out.stable.endsWith('1. 第一项\n\n')).toBe(false)
      expect(out.stable.endsWith('2. 第二项\n\n')).toBe(false)
    }
  })

  it('空行后是缩进延续 → 不是切点', () => {
    const head = pad('引言段。', MARKDOWN_SPLIT_MIN_LENGTH)
    const full = `${head}\n\n一段文字\n\n    缩进代码延续`
    const out = splitMarkdownStable(full)
    expect(out.stable + out.active).toBe(full)
  })

  it('未闭合代码围栏横跨尾部:围栏内空行不清空 pending 之外的逻辑(不抛错)', () => {
    const head = pad('引言段。', MARKDOWN_SPLIT_MIN_LENGTH)
    const full = `${head}\n\n\`\`\`js\nconst a = 1\n\nconst b = 2`
    const out = splitMarkdownStable(full)
    expect(out.stable + out.active).toBe(full)
    // 围栏未闭合 → 围栏内空行不能成为切点 → stable 不含未闭合围栏
    const fenceCount = (out.stable.match(/```/g) ?? []).length
    expect(fenceCount % 2).toBe(0)
  })

  it('无任何安全切点(围栏内全部内容超长)→ 不切分', () => {
    const fenceBody = pad('```text', MARKDOWN_SPLIT_MIN_LENGTH)
    const full = `${fenceBody}\n\n还在围栏里`
    // 开头无围栏闭合 → 全程在围栏内 → 无切点
    const out = splitMarkdownStable(full)
    expect(out).toEqual({ stable: '', active: full })
  })

  it('多段落长文:stable 尽量长(只留最后一个块在 active)', () => {
    const blocks = Array.from(
      { length: 8 },
      (_, i) => `第 ${i} 段内容,足够长以超过阈值。${'y'.repeat(200)}`,
    )
    const full = blocks.join('\n\n') + '\n\n最后活跃块'
    const out = splitMarkdownStable(full)
    expect(out.stable + out.active).toBe(full)
    expect(out.active).toBe('最后活跃块')
    expect(out.stable).toContain('第 0 段')
  })
})
