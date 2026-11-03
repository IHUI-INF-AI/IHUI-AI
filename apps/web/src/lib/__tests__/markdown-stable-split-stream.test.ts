// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  MARKDOWN_SPLIT_MIN_LENGTH,
  splitMarkdownBlocks,
  splitMarkdownStable,
  judgeBlockStability,
} from '../markdown-stable-split'

/** 构造超阈值文本(重复填充到指定长度)。 */
function pad(text: string, minLen: number): string {
  let s = text
  const filler = '\n\n这是填充段落,用于超过切分长度阈值。' + 'x'.repeat(20)
  while (s.length < minLen) s += filler
  return s
}

/** 模拟流式:逐字符纯追加,收集每一拍的块序列。 */
function streamBlocks(doc: string, minLength = 20): string[][] {
  const frames: string[][] = []
  for (let i = 1; i <= doc.length; i += 1) {
    frames.push(splitMarkdownBlocks(doc.slice(0, i), minLength).blocks)
  }
  return frames
}

/** 断言:相邻两拍之间,上一拍的块必须保持在场且不被换掉(末块允许生长)。 */
function assertNoBoundaryDrift(doc: string, label: string, minLength = 20): void {
  let prev: string[] = []
  let prevSource = ''
  for (let i = 1; i <= doc.length; i += 1) {
    const source = doc.slice(0, i)
    const next = splitMarkdownBlocks(source, minLength).blocks
    const v = judgeBlockStability({
      previousBlocks: prev,
      previousSource: prevSource,
      source,
      nextBlocks: next,
    })
    if (v.appendOnly && !v.stable && !v.splitEnabled) {
      throw new Error(
        `${label}: 块边界在 len=${i} 处回退(下标 ${String(v.firstDriftIndex)})\n` +
          `  prev(${prev.length})=${JSON.stringify(prev)}\n` +
          `  next(${next.length})=${JSON.stringify(next)}\n` +
          `  已达内容尾部=${JSON.stringify(source.slice(-40))}`,
      )
    }
    prev = next
    prevSource = source
  }
}

/**
 * 流式块边界单调性(2026-10-29 立)。
 *
 * 立因是实测而非推断:修前这份样本在 `…## 小节 A\n\n- ` 处块边界从 `[8,27,36]`
 * 退到 `[8,27]` —— 列表标记逐字符到达,`- ` 先到成 `-`,`LIST_CONTINUATION_RE`
 * 要求标记后跟空白故不匹配,前一拍空行被误判成安全切点、下一拍又撤销。
 * 渲染层用序号做块 key,边界一退就是前缀块整列 memo 失效 + 跨树重挂。
 */
describe('splitMarkdownBlocks · 流式块边界单调性(纯追加下切点只增不退)', () => {
  it('混合样本(标题/段落/无序列表/围栏/表格/有序列表)全程无回退', () => {
    assertNoBoundaryDrift(
      `# 分析结论

正文第一段,这里是较长的说明文字。

## 小节 A

- 列表项一
- 列表项二

\`\`\`ts
const a = 1

const b = 2
\`\`\`

围栏之后的段落文字。

| 列1 | 列2 |
|---|---|
| a | b |

1. 有序一
2. 有序二

结尾段落。
`,
      '混合样本',
    )
  })

  it('无序列表标记逐字符到达(- / - / - )不回退', () => {
    assertNoBoundaryDrift('段落甲。\n\n段落乙。\n\n- 项目一\n- 项目二\n\n段落丙。', '无序列表')
  })

  it('有序列表标记逐字符到达(1 / 1. / 1. )不回退', () => {
    assertNoBoundaryDrift('段落甲。\n\n段落乙。\n\n1. 甲项\n2. 乙项\n\n段落丙。', '有序列表')
  })

  it('星号 / 加号标记与两位数为标记前缀时不误落切点', () => {
    assertNoBoundaryDrift('段落甲。\n\n段落乙。\n\n* 甲\n+ 乙\n\n段落丙。', '星号加号')
    assertNoBoundaryDrift('段落甲。\n\n段落乙。\n\n12. 项目\n\n段落丙。', '两位序号')
  })

  it('围栏内空行、引用块、嵌套缩进、分隔线样本均无回退', () => {
    assertNoBoundaryDrift(
      '段落甲。\n\n\`\`\`ts\nconst a = 1\n\nconst b = 2\n\`\`\`\n\n段落乙。',
      '围栏',
    )
    assertNoBoundaryDrift('段落甲。\n\n> 引用一行\n\n段落乙。', '引用块')
    assertNoBoundaryDrift('段落甲。\n\n  - 缩进项\n\n段落乙。', '嵌套缩进')
    assertNoBoundaryDrift('段落甲。\n\n段落乙。\n\n---\n\n段落丙。', '分隔线')
  })

  it('长文纯追加:块数单调不减,且每块都以换行结尾', () => {
    const doc = Array.from({ length: 12 }, (_, i) => `第${i}段,${'内容'.repeat(30)}`).join('\n\n')
    const frames = streamBlocks(doc)
    for (let i = 1; i < frames.length; i += 1) {
      expect(frames[i]!.length).toBeGreaterThanOrEqual(frames[i - 1]!.length)
    }
    const final = frames[frames.length - 1]!
    expect(final.join('')).toBe(doc)
    for (const block of final.slice(0, -1)) {
      expect(block.endsWith('\n')).toBe(true)
    }
  })

  /**
   * 长样本(每块远超 MARKDOWN_BLOCK_MERGE_THRESHOLD)必须同样无回退。
   *
   * 这一格是修判据时**阳性对照抓出来的第二个 bug**:原来的"相邻两块都短于阈值才合并"
   * 是贪心式、**不单调** —— 已合并的块(11 + 511 = 522 字)在末块继续长到越过 512 之后
   * 不再满足"两块都短",于是又被拆回两块,块边界当场回退。短样本(< 512)永远走不到
   * 这条路径,所以只测短样本会给出假绿 —— 这正是本用例存在的理由。
   */
  it('长样本(每块 > 512 字)全程无回退:碎片合并必须单调', () => {
    const para = (i: number): string => `第${i}段。` + '内容'.repeat(300)
    const doc = [
      '# 长回答',
      para(1),
      '## 小节 A',
      para(2),
      `- 列表项一 ${'项'.repeat(300)}`,
      `- 列表项二 ${'项'.repeat(300)}`,
      para(3),
      `1. 有序一 ${'序'.repeat(300)}`,
      `2. 有序二 ${'序'.repeat(300)}`,
      para(4),
    ].join('\n\n')

    let prev: string[] = []
    let prevSource = ''
    for (let i = 1; i <= doc.length; i += 1) {
      const source = doc.slice(0, i)
      const nextBlocks = splitMarkdownBlocks(source).blocks
      const v = judgeBlockStability({
        previousBlocks: prev,
        previousSource: prevSource,
        source,
        nextBlocks,
      })
      // splitEnabled 是"首次开启切分"的一次性转变,不是回退
      if (v.appendOnly && !v.stable && !v.splitEnabled) {
        throw new Error(
          `长样本块边界回退 len=${i} 下标=${String(v.firstDriftIndex)}\n` +
            `  prev=${JSON.stringify(prev.map((b) => `${b.length}字`))}\n` +
            `  next=${JSON.stringify(nextBlocks.map((b) => `${b.length}字`))}\n` +
            `  尾部=${JSON.stringify(source.slice(-24))}`,
        )
      }
      prev = nextBlocks
      prevSource = source
    }
    // 拼回不变量在长样本上同样成立
    expect(splitMarkdownBlocks(doc).blocks.join('')).toBe(doc)
  })
})

describe('judgeBlockStability · 跨拍判据', () => {
  const doc = `段落一。${'x'.repeat(40)}\n\n段落二。${'y'.repeat(40)}\n\n段落三。${'z'.repeat(40)}`

  it('纯追加且边界稳定 ⇒ stable + 报出新增块数', () => {
    const prevSource = doc.slice(0, 60)
    const prevBlocks = splitMarkdownBlocks(prevSource, 10).blocks
    const source = doc
    const nextBlocks = splitMarkdownBlocks(source, 10).blocks
    const v = judgeBlockStability({
      previousBlocks: prevBlocks,
      previousSource: prevSource,
      source,
      nextBlocks,
    })
    expect(v.appendOnly).toBe(true)
    expect(v.stable).toBe(true)
    expect(v.firstDriftIndex).toBeNull()
    expect(v.appendedBlocks).toBe(nextBlocks.length - prevBlocks.length)
  })

  it('边界回退 ⇒ stable=false 且点名第一个错位下标(不静默当稳定)', () => {
    // 真实会发生的形态:内容仍是纯追加,但碎片合并把两个已落地短块并成一块
    // (合并结果参与下一轮"是否够长"判断)⇒ 下标 0 的边界当场移动
    const v = judgeBlockStability({
      previousBlocks: ['a\n\n', 'b\n\n', 'c'],
      previousSource: 'a\n\nb\n\nc',
      source: 'a\n\nb\n\nc-definitely-longer-now',
      nextBlocks: ['a\n\nb\n\n', 'c-definitely-longer-now'],
    })
    expect(v.appendOnly).toBe(true)
    expect(v.stable).toBe(false)
    expect(v.firstDriftIndex).toBe(0)
    expect(v.appendedBlocks).toBeNull()
  })

  it('末块是生长尾巴:它变长不算回退(否则每个正常帧都假阳性)', () => {
    const v = judgeBlockStability({
      previousBlocks: ['a\n\n', 'b'],
      previousSource: 'a\n\nb',
      source: 'a\n\nb 继续写',
      nextBlocks: ['a\n\n', 'b 继续写'],
    })
    expect(v.appendOnly).toBe(true)
    expect(v.stable).toBe(true)
    expect(v.firstDriftIndex).toBeNull()
  })

  it('末块的切点被撤销(块消失)⇒ 判红 —— 这一型是第一版口径漏掉的 bug 本体', () => {
    const v = judgeBlockStability({
      previousBlocks: ['a\n\n', 'b\n\n', 'c'],
      previousSource: 'a\n\nb\n\nc',
      source: 'a\n\nb\n\nc 继续',
      nextBlocks: ['a\n\n', 'b\n\nc 继续'],
    })
    expect(v.appendOnly).toBe(true)
    expect(v.stable).toBe(false)
    expect(v.firstDriftIndex).toBe(1)
  })

  it('首次开启切分 ⇒ splitEnabled 单独归类,不与"边界回退"混为一谈', () => {
    const v = judgeBlockStability({
      previousBlocks: ['一整段还没到门槛的正文'],
      previousSource: '一整段还没到门槛的正文',
      source: '一整段还没到门槛的正文加上更多',
      nextBlocks: ['一整段', '还没到门槛的正文加上更多'],
    })
    expect(v.appendOnly).toBe(true)
    expect(v.stable).toBe(false)
    expect(v.splitEnabled).toBe(true)
    expect(v.firstDriftIndex).toBeNull()
  })

  it('非纯追加(上游改写/重载)⇒ appendOnly=false,不得读成稳定', () => {
    const v = judgeBlockStability({
      previousBlocks: ['旧\n\n', '内容'],
      previousSource: '旧\n\n内容',
      source: '完全不同的正文\n\n另一段',
      nextBlocks: ['完全不同的正文\n\n', '另一段'],
    })
    expect(v.appendOnly).toBe(false)
    expect(v.stable).toBe(false)
    expect(v.appendedBlocks).toBeNull()
  })

  it('首拍(上一拍为空)视为纯追加且稳定', () => {
    const v = judgeBlockStability({
      previousBlocks: [],
      previousSource: '',
      source: '第一段\n\n第二段',
      nextBlocks: ['第一段\n\n', '第二段'],
    })
    expect(v.appendOnly).toBe(true)
    expect(v.stable).toBe(true)
    expect(v.appendedBlocks).toBe(2)
  })
})

describe('splitMarkdownBlocks · 静态不变量(既有)', () => {
  it('拼回逐字节等于原文(含列表标记中间态)', () => {
    const doc = `${pad('# 标题\n\n引言。', MARKDOWN_SPLIT_MIN_LENGTH)}\n\n- 甲\n- 乙\n\n结尾。`
    const { blocks } = splitMarkdownBlocks(doc)
    expect(blocks.join('')).toBe(doc)
  })

  it('内容短于阈值 ⇒ 单块', () => {
    expect(splitMarkdownBlocks('短', 100).blocks).toEqual(['短'])
  })

  it('列表标记中间态不落地切点(候选保留而非先切后撤)', () => {
    // 尾部是只写了 "-" 的列表标记:前一个空行本拍不可下结论
    const doc = `段落甲。\n\n段落乙。\n\n- `
    const { blocks } = splitMarkdownBlocks(doc, 1)
    expect(blocks.join('')).toBe(doc)
    // 判据本体:切点集里不得包含"紧跟着待定列表标记"的那个位置
    const stableSplit = splitMarkdownStable(doc)
    expect(stableSplit.stable + stableSplit.active).toBe(doc)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
