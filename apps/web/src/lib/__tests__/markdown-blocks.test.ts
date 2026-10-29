// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  MARKDOWN_BLOCK_MERGE_THRESHOLD,
  MARKDOWN_SPLIT_MIN_LENGTH,
  splitMarkdownBlocks,
  splitMarkdownStable,
} from '../markdown-stable-split'

/**
 * 块级增量切分测试(2026-10-30 立)。
 *
 * 判的是**不变量**而非实现细节:
 *  - 拼接逐字等值(切错一个字节就是把正文吃掉/重复);
 *  - 切点只在围栏外、且其后不是列表/缩进延续(错切比慢更糟);
 *  - 短内容/无安全切点不切;碎片相邻块按阈值合并;
 *  - 与 splitMarkdownStable 同源(两把尺子取同一批切点,单刀取最后一个)。
 */

/** 构造超阈值文本(重复填充到指定长度;每段之间是安全空行)。 */
function pad(text: string, minLen: number): string {
  let s = text
  const filler = '\n\n这是填充段落,用于超过切分长度阈值。' + 'x'.repeat(20)
  while (s.length < minLen) s += filler
  return s
}

/** 行首围栏(``` / ~~~,缩进 ≤3)的条数:切点落在围栏外 ⇒ 每块必为偶数。 */
function fenceLineCount(text: string): number {
  return text.split('\n').filter((line) => /^\s{0,3}(```|~~~)/.test(line)).length
}

/** 通用不变量:拼接逐字等值 + 非末块以换行结尾 + 每块围栏成对。 */
function expectBlockInvariants(content: string, blocks: string[]): void {
  expect(blocks.join('')).toBe(content)
  expect(blocks.length).toBeGreaterThan(0)
  for (const block of blocks.slice(0, -1)) {
    expect(block.endsWith('\n')).toBe(true)
  }
  for (const block of blocks) {
    expect(fenceLineCount(block) % 2).toBe(0)
  }
}

const CHINESE_LONG = pad(
  '# 中文标题\n\n第一段:这是中文正文,包含标点、数字 123 与英文 words。',
  MARKDOWN_SPLIT_MIN_LENGTH,
)

const FENCED_LONG = `${pad('引言段,围栏之前。', 1500)}\n\n\`\`\`python\ndef f():\n    # 围栏内空行不是切点\n\n    return 1\n\`\`\`\n\n围栏之后的段落,继续流式输出。`

const LIST_LONG = `${pad('引言段,列表之前。', 1500)}\n\n1. 第一项\n\n2. 第二项\n\n3. 第三项\n\n列表后的收尾段落。`

const TABLE_LONG = `${pad('引言段,表格之前。', 1500)}\n\n| 列 A | 列 B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n\n表格之后的收尾段落。`

const INDENT_LONG = `${pad('引言段,缩进之前。', 1500)}\n\n一段文字\n\n    缩进代码延续`

describe('splitMarkdownBlocks · 拼接不变量', () => {
  it('多组样例(中文/围栏/列表/表格/无尾换行/尾空行/空串)逐字拼回原文', () => {
    const samples = [
      '',
      '单行短内容',
      '短内容\n\n带空行',
      CHINESE_LONG,
      FENCED_LONG,
      LIST_LONG,
      TABLE_LONG,
      INDENT_LONG,
      `${CHINESE_LONG}`, // 无尾换行
      `${CHINESE_LONG}\n\n\n`, // 多个尾空行
    ]
    for (const sample of samples) {
      const { blocks } = splitMarkdownBlocks(sample)
      expectBlockInvariants(sample, blocks)
    }
  })

  it('围栏内的空行不是切点:每块围栏成对、围栏块不被拆开', () => {
    const { blocks } = splitMarkdownBlocks(FENCED_LONG)
    expectBlockInvariants(FENCED_LONG, blocks)
    // 围栏代码体必须完整落在同一块里
    const holding = blocks.filter((block) => block.includes('def f():'))
    expect(holding).toHaveLength(1)
    expect(holding[0]).toContain('```python')
    expect(holding[0]).toContain('return 1')
  })

  it('列表延续不切:有序列表三项留在同一块(编号不会从 1 重置)', () => {
    const { blocks } = splitMarkdownBlocks(LIST_LONG)
    expectBlockInvariants(LIST_LONG, blocks)
    const holding = blocks.filter((block) => block.includes('1. 第一项'))
    expect(holding).toHaveLength(1)
    expect(holding[0]).toContain('2. 第二项')
    expect(holding[0]).toContain('3. 第三项')
  })

  it('缩进延续不切:空行后是缩进行 ⇒ 任何块都不以该行开头', () => {
    const { blocks } = splitMarkdownBlocks(INDENT_LONG)
    expectBlockInvariants(INDENT_LONG, blocks)
    expect(blocks.every((block) => !/^\s{4}缩进代码延续/.test(block))).toBe(true)
  })

  it('短内容(<1500)返回单块,原样返回', () => {
    const short = '# 标题\n\n一段内容。\n\n```js\nconst a = 1\n```'
    expect(splitMarkdownBlocks(short)).toEqual({ blocks: [short] })
  })

  it('无安全切点(全程未闭合围栏)返回单块', () => {
    const fenced = pad('```text\n围栏内没有闭合,空行都是代码内容', 1500)
    const { blocks } = splitMarkdownBlocks(fenced)
    expect(blocks).toEqual([fenced])
  })

  it('超长多段落切出多块,且块间边界落在安全空行后', () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `第 ${i} 段:${'内容'.repeat(200)}`)
    const full = paragraphs.join('\n\n')
    const { blocks } = splitMarkdownBlocks(full)
    expectBlockInvariants(full, blocks)
    expect(blocks.length).toBeGreaterThan(1)
    // 每块(除末块)都以空行结尾 ⇒ 下一块不会从列表/缩进中段开始
    for (const block of blocks.slice(0, -1)) {
      expect(block.endsWith('\n\n')).toBe(true)
    }
  })

  it('跨空行构造(引用式链接定义 / $$ 数学块)整段不切:切开即改变语义', () => {
    const linkDef = `${pad('正文里出现引用式链接 [文档][doc]。', 1500)}\n\n[doc]: https://example.com/a`
    expect(splitMarkdownBlocks(linkDef)).toEqual({ blocks: [linkDef] })

    const math = `${pad('引言段。', 1500)}\n\n$$\n\\begin{aligned}\na &= b\n\nc &= d\n\\end{aligned}\n$$`
    expect(splitMarkdownBlocks(math)).toEqual({ blocks: [math] })
  })
})

describe('splitMarkdownBlocks · 碎片合并', () => {
  it('相邻小块全部合并成一块(每块都短于阈值)', () => {
    const content = 'a\n\nb\n\nc\n\nd'
    const { blocks } = splitMarkdownBlocks(content, 0)
    expect(blocks).toEqual([content])
  })

  it('长块两侧的小块各自合并,长块不参与合并', () => {
    const long = 'x'.repeat(MARKDOWN_BLOCK_MERGE_THRESHOLD + MARKDOWN_BLOCK_MERGE_THRESHOLD / 2)
    const content = `aa\n\nbb\n\n${long}\n\ncc\ndd`
    const { blocks } = splitMarkdownBlocks(content, 0)
    expect(blocks.join('')).toBe(content)
    expect(blocks).toEqual(['aa\n\nbb\n\n', `${long}\n\n`, 'cc\ndd'])
  })

  it('阈值是严格小于:恰好等于阈值的两块不合并', () => {
    const a = 'a'.repeat(MARKDOWN_BLOCK_MERGE_THRESHOLD - 2) // + '\n\n' = 阈值
    const b = 'b'.repeat(MARKDOWN_BLOCK_MERGE_THRESHOLD - 2)
    const content = `${a}\n\n${b}\n\nc`
    const { blocks } = splitMarkdownBlocks(content, 0)
    expect(blocks).toEqual([`${a}\n\n`, `${b}\n\n`, 'c'])
  })

  it('各短阈值一分则合并', () => {
    const a = 'a'.repeat(MARKDOWN_BLOCK_MERGE_THRESHOLD - 3) // + '\n\n' = 阈值 - 1
    const b = 'b'.repeat(MARKDOWN_BLOCK_MERGE_THRESHOLD - 3)
    const content = `${a}\n\n${b}\n\n`
    const { blocks } = splitMarkdownBlocks(content, 0)
    expect(blocks).toEqual([content])
  })

  it('minLength 参数生效:显式阈值 0 时短内容也走切分', () => {
    const content = `甲\n\n${'x'.repeat(MARKDOWN_BLOCK_MERGE_THRESHOLD + 100)}\n\n乙`
    // 默认阈值:全文 < 1500 ⇒ 单块(不切)
    expect(splitMarkdownBlocks(content).blocks).toEqual([content])
    // 阈值 0 ⇒ 切点生效;长块两侧的小块不合并
    const { blocks } = splitMarkdownBlocks(content, 0)
    expect(blocks.join('')).toBe(content)
    expect(blocks).toEqual([
      '甲\n\n',
      `${'x'.repeat(MARKDOWN_BLOCK_MERGE_THRESHOLD + 100)}\n\n`,
      '乙',
    ])
  })
})

describe('splitMarkdownBlocks · 与 splitMarkdownStable 一致', () => {
  it('块都超过合并阈值时,除末块外的拼接 == 单刀切出的 stable', () => {
    const paragraphs = Array.from(
      { length: 5 },
      (_, i) => `第 ${i} 段正文:${'z'.repeat(MARKDOWN_BLOCK_MERGE_THRESHOLD + 100)}`,
    )
    const full = `${paragraphs.join('\n\n')}\n\n尾部活跃段落`
    const split = splitMarkdownStable(full)
    const { blocks } = splitMarkdownBlocks(full)

    expectBlockInvariants(full, blocks)
    expect(split.stable + split.active).toBe(full)
    expect(split.stable.length).toBeGreaterThan(0)
    // 同一批切点:单刀取最后一个,块级取全部 ⇒ 末块之外恰好拼回 stable
    expect(blocks.slice(0, -1).join('')).toBe(split.stable)
    expect(blocks[blocks.length - 1]).toBe(split.active)
  })

  it('单刀不切(短内容)时块级也只有一块,内容不丢', () => {
    const short = '短内容\n\n再来一段'
    expect(splitMarkdownStable(short)).toEqual({ stable: '', active: short })
    expect(splitMarkdownBlocks(short)).toEqual({ blocks: [short] })
  })

  it('流式追加时前缀块内容冻结(切点只向后追加)', () => {
    const head = pad('# 标题\n\n第一段。', 1500)
    const tick1 = splitMarkdownBlocks(`${head}\n\n第二段正在写`).blocks
    const tick2 = splitMarkdownBlocks(`${head}\n\n第二段正在写,又长了一点`).blocks
    // 已落地的前缀块逐字不变(memo 命中的前提)
    for (let i = 0; i < tick1.length - 1; i++) {
      expect(tick2[i]).toBe(tick1[i])
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
