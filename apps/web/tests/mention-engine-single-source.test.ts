// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// V3 第 61 票 判据③:`@` 与 `#` 归一到**一个** mention engine。
//
// 全部 import 生产出口(parseMentionTrigger / MENTION_DIMENSIONS / dimensionsForSigil /
// replaceTrailingTrigger / selectionFrom*),**不在测试里复制任何判据实现**(§22c)——
// 要证的正是"维度由一张表决定、触发解析只有一处",复制一份来测就等于没测。
import { describe, it, expect } from 'vitest'

import type { ContextMention } from '@ihui/types'
import {
  MENTION_DIMENSIONS,
  MENTION_SIGILS,
  dimensionsForSigil,
  findDimension,
  parseMentionTrigger,
  removeMentionInsert,
  replaceTrailingTrigger,
  selectionFromDimension,
  selectionFromSearchMention,
  withSelection,
  withoutSelection,
  type MentionSelection,
} from '@ihui/shared/chat/mention-engine'
// 归一后的等价出口:`#` 侧选择器的类目清单必须是这张表的投影,而不是第二份清单
import { CONTEXT_SELECTOR_CATEGORIES } from '@/hooks/use-context-selector'
// 外观表是同一张维度表的第二个投影:维度加了却忘配图标时,这里必须点名而不是静默掉兜底
import { dimensionsMissingView, viewOfDimensionId } from '@/components/chat/mention/dimension-views'

/** 归一之前 `#` 侧那份九类目表的 token —— 逐字比对,证明合并没顺手改语义 */
const LEGACY_HASH_TOKENS = [
  '#File',
  '#Folder',
  '#Code',
  '#Problems',
  '#Terminal',
  '#Web',
  '#Doc',
  '#PastChats',
  '#Rule',
]

describe('mention engine —— 维度由一张表决定', () => {
  it('MENTION_SIGILS 只有 @ 与 # 两个触发符', () => {
    expect([...MENTION_SIGILS]).toEqual(['@', '#'])
  })

  it('表按 sigil 精确划分为 @ 五类 + # 九类,两侧并起来就是全表', () => {
    const at = dimensionsForSigil('@')
    const hash = dimensionsForSigil('#')
    expect(at.map((d) => d.mentionType)).toEqual(['file', 'folder', 'symbol', 'database', 'web'])
    expect(hash.map((d) => d.token)).toEqual(LEGACY_HASH_TOKENS)
    expect(at.length + hash.length).toBe(MENTION_DIMENSIONS.length)
    // 每一行都必须被某一个 sigil 认领 —— 加一行却两侧都读不到 = 表与投影脱节
    for (const dim of MENTION_DIMENSIONS) {
      expect(dimensionsForSigil(dim.sigil).some((d) => d.id === dim.id)).toBe(true)
    }
  })

  it('维度 id 唯一,且 @ 侧每行都带后端认得的检索类型', () => {
    const ids = MENTION_DIMENSIONS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const dim of dimensionsForSigil('@')) {
      expect(dim.mentionType).toBeTruthy()
      expect(dim.token).toBe('')
    }
  })

  it('每个引擎维度都配了自己的外观(正反成对:缺配会被点名,而不是静默掉到兜底档)', () => {
    // 兜底档确实在位 —— 没有这一条,下面的"为空"就可能只是"探针永远返回 []"
    const fallback = viewOfDimensionId('__not_a_dimension__')
    expect(fallback.colorClass).toBe('text-muted-foreground')
    // 真实全表不得有任何一行靠兜底渲染:新增维度忘配图标必须在这里点名
    expect(dimensionsMissingView()).toEqual([])
    for (const dim of MENTION_DIMENSIONS) {
      expect(viewOfDimensionId(dim.id).colorClass).not.toBe('text-muted-foreground')
    }
  })

  it('# 侧浮层的类目清单就是这张表的投影(不得再有第二份九类目表)', () => {
    expect(CONTEXT_SELECTOR_CATEGORIES.map((c) => c.token)).toEqual(
      dimensionsForSigil('#').map((d) => d.token),
    )
    for (const c of CONTEXT_SELECTOR_CATEGORIES) {
      const dim = findDimension(c.dimensionId)
      expect(dim?.labelNs).toBe(c.labelNs)
      expect(dim?.labelKey).toBe(c.labelKey)
      expect(dim?.descKey).toBe(c.descKey)
    }
  })
})

describe('mention engine —— 触发解析只有一处', () => {
  it.each([
    ['修复 bug @', '@', '', true],
    ['修复 bug @src/co', '@', 'src/co', false],
    ['修复 #ter', '#', 'ter', false],
    ['#', '#', '', true],
    // 触发段必须**落在结尾**才有意义(与 61 票之前 message-input 那条 `/@[\w./-]*$/` 同形):
    // 光标后面还有字就不是"正在输入提及",所以这一行原本写作 'a@b.com 后面没了' 是判据写反了。
    ['邮箱写到结尾 a@b.com', '@', 'b.com', false],
  ])('parseMentionTrigger(%j) → sigil=%j query=%j bare=%j', (value, sigil, query, bare) => {
    const got = parseMentionTrigger(value)
    expect(got?.sigil).toBe(sigil)
    expect(got?.query).toBe(query)
    expect(got?.bare).toBe(bare)
  })

  it('非触发态返回 null(浮层据此关闭,不猜)', () => {
    expect(parseMentionTrigger('')).toBeNull()
    expect(parseMentionTrigger('普通问题描述')).toBeNull()
    // 邮箱在正文中间、结尾还有别的字 ⇒ 不是"正在输入提及"(结尾锚是本判据的全部)
    expect(parseMentionTrigger('发信到 a@b.com 就行')).toBeNull()
    expect(parseMentionTrigger('参考 #Rule 那条规则')).toBeNull()
  })

  it('两个 sigil 走同一个函数入口(而不是两个组件各写一遍)', () => {
    expect(parseMentionTrigger('hello @')?.sigil).toBe('@')
    expect(parseMentionTrigger('hello #')?.sigil).toBe('#')
    // 只有一个入参:任何"再传一份 per-sigil 规则"的漂移都会在这里红
    expect(parseMentionTrigger.length).toBe(1)
  })
})

describe('mention engine —— 插入/摘除与统一选择模型', () => {
  const symbolDim = findDimension('at-symbol')!
  const ruleDim = findDimension('hash-rule')!
  const mention: ContextMention = {
    id: 'symbol:parse',
    type: 'symbol',
    label: 'parseMentionTrigger',
    detail: 'packages/shared/src/chat/mention-engine.ts',
    insertText: '@symbol:parse',
  }

  it('@ 与 # 的选中都产出同一个 MentionSelection 形态', () => {
    const fromSearch = selectionFromSearchMention(symbolDim, mention)
    const fromStatic = selectionFromDimension(ruleDim)
    for (const sel of [fromSearch, fromStatic]) {
      expect(typeof sel.id).toBe('string')
      expect(MENTION_SIGILS).toContain(sel.sigil)
      expect(findDimension(sel.dimensionId)?.id).toBe(sel.dimensionId)
      expect(sel.insertText.length).toBeGreaterThan(0)
    }
    expect(fromSearch.sigil).toBe('@')
    // insertText 优先用后端给的那份(引擎不另拼一套形态)
    expect(fromSearch.insertText).toBe('@symbol:parse')
    expect(fromStatic.sigil).toBe('#')
    // 与归一之前 # 侧的 token 逐字一致
    expect(fromStatic.insertText).toBe('#Rule')
  })

  it('replaceTrailingTrigger 只顶掉触发段,非触发态原样返回', () => {
    expect(replaceTrailingTrigger('修复 @', '@', '`a.ts` ')).toBe('修复 `a.ts` ')
    expect(replaceTrailingTrigger('修复 #ter', '#', '#Terminal ')).toBe('修复 #Terminal ')
    expect(replaceTrailingTrigger('修复完成', '@', '`a.ts` ')).toBe('修复完成')
  })

  it('插入再摘掉是恒等变换(chip 与正文不分叉)', () => {
    const before = '帮我看 '
    for (const [sigil, snippet] of [
      ['@', '`a.ts`'],
      ['#', '#Rule'],
    ] as const) {
      const inserted = replaceTrailingTrigger(`${before}${sigil}`, sigil, `${snippet} `)
      expect(inserted).toBe(`${before}${snippet} `)
      expect(removeMentionInsert(inserted, snippet)).toBe(before)
    }
  })

  it('store 的合并语义:同 id 不重复、异 id 追加、摘除按 id', () => {
    const a = selectionFromDimension(findDimension('hash-doc')!)
    const b = selectionFromDimension(ruleDim)
    const once = withSelection([], a)
    const twice = withSelection(once, a)
    expect(twice).toHaveLength(1)
    const both = withSelection(twice, b)
    expect(both.map((s) => s.id)).toEqual([a.id, b.id])
    const left = withoutSelection(both, a.id)
    expect(left.map((s) => s.id)).toEqual([b.id])
    // 不可变:原数组不得被就地改
    expect(both).toHaveLength(2)
    expect(left[0]).toBeInstanceOf(Object as unknown as () => MentionSelection)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
