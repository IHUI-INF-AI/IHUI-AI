// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { hasUnclosedFence, healIncompleteMarkdown } from '../markdown-incomplete-heal'

/**
 * 流式 markdown 未闭合 token 补全测试(2026-10-13 立,对标 Trae fillInIncompleteTokens)。
 *
 * 覆盖:围栏 / 行内代码 / 粗斜体 / 删除线 / 未闭合链接(不发明 URL) /
 * setext 末尾孤立 -/= 前插零宽 / 未闭合 HTML / $$ 与行内 $ /
 * 围栏感知 / 闭合完备时不追加 / 只追加不删改。
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

  it('未闭合斜体:追加一个 * 或 _', () => {
    expect(healIncompleteMarkdown('这是 *斜体').healed).toBe('这是 *斜体*')
    expect(healIncompleteMarkdown('这是 _斜体').healed).toBe('这是 _斜体_')
    expect(healIncompleteMarkdown('这是 __粗体').healed).toBe('这是 __粗体__')
  })

  it('列表标记的星号不当斜体补', () => {
    const text = '* 列表项已经写完'
    expect(healIncompleteMarkdown(text).healed).toBe(text)
  })

  it('未闭合链接只补括号,不写入占位地址', () => {
    const text = '见 [文档'
    const out = healIncompleteMarkdown(text)
    expect(out.healed).toBe('见 [文档]')
    expect(out.healed.startsWith(text)).toBe(true)
    expect(out.healed).not.toMatch(/https?:\/\//)

    const dest = '见 [文档](https://example.com/a'
    expect(healIncompleteMarkdown(dest).healed).toBe('见 [文档](https://example.com/a)')
  })

  it('setext 末尾孤立 - 或 = 前插零宽,原文一个字不删', () => {
    const dash = '标题\n-'
    const healedDash = healIncompleteMarkdown(dash).healed
    expect(healedDash).toBe(`标题\n${'\u200b'}-`)
    expect(healedDash.replaceAll('\u200b', '')).toBe(dash)

    const eq = '标题\n='
    expect(healIncompleteMarkdown(eq).healed).toBe(`标题\n${'\u200b'}=`)

    const rule = '段落\n\n---'
    expect(healIncompleteMarkdown(rule).healed).toBe(rule)
  })

  it('未闭合 HTML 只追加结束符', () => {
    expect(healIncompleteMarkdown('<div>内容').healed).toBe('<div>内容</div>')
    expect(healIncompleteMarkdown('<section').healed).toBe('<section></section>')
    const closed = '已闭合 <span>文字</span>'
    expect(healIncompleteMarkdown(closed).healed).toBe(closed)
  })

  it('未闭合 $$ 与行内 $ 追加闭合符;货币 $5 不动', () => {
    expect(healIncompleteMarkdown('$$\nE=mc^2').healed).toBe('$$\nE=mc^2$$')
    expect(healIncompleteMarkdown('行内 $x').healed).toBe('行内 $x$')
    const price = '价格 $5 元'
    expect(healIncompleteMarkdown(price).healed).toBe(price)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
