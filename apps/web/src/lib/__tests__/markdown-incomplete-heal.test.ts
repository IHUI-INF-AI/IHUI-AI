// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { hasUnclosedFence, healIncompleteMarkdown } from '../markdown-incomplete-heal'

/**
 * 流式 markdown 未闭合 token 补全测试(2026-10-13 立,对标 Trae fillInIncompleteTokens)。
 *
 * 覆盖:围栏补全(既有行为的迁移)/ 行内代码 / 粗体 / 删除线 /
 * 围栏感知(围栏内不计数)/ 闭合完备时不追加 / 只追加不删改。
 */
describe('hasUnclosedFence', () => {
  it('偶数围栏闭合,奇数围栏未闭合', () => {
    expect(hasUnclosedFence('```ts\nconst a = 1\n```')).toBe(false)
    expect(hasUnclosedFence('```ts\nconst a = 1')).toBe(true)
    expect(hasUnclosedFence('没有围栏的普通文本')).toBe(false)
  })
})

describe('healIncompleteMarkdown', () => {
  it('围栏未闭合:追加闭合围栏,fenceHealed=true', () => {
    const out = healIncompleteMarkdown('```ts\nconst a = 1')
    expect(out.fenceHealed).toBe(true)
    expect(out.healedAny).toBe(true)
    expect(out.healed.startsWith('```ts\nconst a = 1\n```\n')).toBe(true)
  })

  it('围栏闭合完整且无未闭合 token:原样返回', () => {
    const text = '正常**粗体**与 `代码` 与 ~~删除~~ 文本。'
    const out = healIncompleteMarkdown(text)
    expect(out.healedAny).toBe(false)
    expect(out.fenceHealed).toBe(false)
    expect(out.healed).toBe(text)
  })

  it('未闭合行内代码:追加一个反引号', () => {
    const out = healIncompleteMarkdown('用 `npm run dev 启动')
    expect(out.healed).toBe('用 `npm run dev 启动`')
    expect(out.healedAny).toBe(true)
  })

  it('未闭合粗体:追加 **', () => {
    const out = healIncompleteMarkdown('首先分析 **问题的根因')
    expect(out.healed).toBe('首先分析 **问题的根因**')
  })

  it('未闭合删除线:追加 ~~', () => {
    const out = healIncompleteMarkdown('这个方案 ~~已经被放弃')
    expect(out.healed).toBe('这个方案 ~~已经被放弃~~')
  })

  it('多种未闭合同时存在:按 粗体→删除线→行内代码 顺序补全', () => {
    const out = healIncompleteMarkdown('**计划 执行 ~~清理 与 `reset')
    expect(out.healed.endsWith('**~~`')).toBe(true)
  })

  it('围栏感知:围栏内的 ** 与 ` 不参与计数', () => {
    // 围栏内 1 个反引号 + 1 组 **:若不感知会误补;围栏成对闭合后应原样返回
    const text = '```ts\nconst s = `tpl`;\nconst b = a ** 2;\n```\n正文。'
    const out = healIncompleteMarkdown(text)
    expect(out.healed).toBe(text)
    expect(out.healedAny).toBe(false)
  })

  it('流式临界态:文末行的未闭合 token 补全,历史行的不补(避免误卷中间内容)', () => {
    // 粗体 opener 在首行、其后是代码块 → 历史游离标记,不补(补了会把代码块卷进粗体);
    // 但围栏未闭合仍要补
    const out = healIncompleteMarkdown('看 **这个\n\n```js\nconst a = 1')
    expect(out.fenceHealed).toBe(true)
    expect(out.healed).toBe('看 **这个\n\n```js\nconst a = 1\n```\n')
  })

  it('文末行粗体未闭合:补全(流式主路径)', () => {
    const out = healIncompleteMarkdown('第一段已完成。\n\n接着分析 **这个问题')
    expect(out.healed).toBe('第一段已完成。\n\n接着分析 **这个问题**')
  })

  it('只追加不删改:补全后文本以原文为前缀', () => {
    const text = 'abc **def `ghi ~~j'
    const out = healIncompleteMarkdown(text)
    expect(out.healed.startsWith(text)).toBe(true)
    expect(out.healed.length).toBeGreaterThan(text.length)
  })

  it('空字符串输入:原样返回', () => {
    const out = healIncompleteMarkdown('')
    expect(out.healed).toBe('')
    expect(out.healedAny).toBe(false)
  })
})
