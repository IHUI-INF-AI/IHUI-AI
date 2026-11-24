// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * V3 #66 判据 3:三方合并出块与逐块取用的形态断言。
 *
 * 覆盖:三侧一致 / 仅当前侧 / 仅传入侧 / 两侧同改同值 / 两侧改到同一段(冲突)/
 * 两侧改到互不相交的两段(自动合并**必须同时含两处改动**)/ 同点插入 /
 * 一侧删除 vs 一侧修改(空侧)/ 空 base / 行尾符保持 / 未决冲突不产出结果。
 *
 * 也钉住"不自己写 diff"这条:本模块的出块全部由 base 侧行区间推导,
 * 若有人另起一份 LCS,`base` 侧区间与 hunk 的对应关系会先在这里断掉。
 */

import { describe, expect, it } from 'vitest'
import {
  buildMergedContent,
  chooseAllConflicts,
  computeThreeWay,
  hasConflicts,
  mergeResolutions,
  resolveBlockLines,
  summarizeMerge,
  type MergeChoice,
  type ThreeWayBlock,
} from '../diff-three-way'

function lines(...xs: string[]): string {
  return xs.length === 0 ? '' : `${xs.join('\n')}\n`
}

function texts(xs: { text: string }[]): string[] {
  return xs.map((l) => l.text)
}

function blocksOf(base: string, ours: string, theirs: string): ThreeWayBlock[] {
  return computeThreeWay(base, ours, theirs).blocks
}

function kindsOf(base: string, ours: string, theirs: string): string[] {
  return blocksOf(base, ours, theirs).map((b) => b.kind)
}

const EMPTY: ReadonlyMap<number, MergeChoice> = new Map()

describe('diff-three-way:出块类型', () => {
  it('三侧一致 ⇒ 单个 stable 块,合并结果逐字等于 base(含"无结尾换行"语义)', () => {
    const base = lines('a', 'b', 'c')
    const merge = computeThreeWay(base, base, base)
    expect(merge.blocks).toHaveLength(1)
    expect(merge.blocks[0]?.kind).toBe('stable')
    expect(buildMergedContent(base, merge, EMPTY)).toBe(base)
    expect(hasConflicts(merge)).toBe(false)
    const noEol = 'a\nb'
    expect(buildMergedContent(noEol, computeThreeWay(noEol, noEol, noEol), EMPTY)).toBe(noEol)
  })

  it('仅当前侧改动 ⇒ ours 块,自动取 ours', () => {
    const base = lines('a', 'b')
    const ours = lines('a', 'B')
    const merge = computeThreeWay(base, ours, base)
    expect(kindsOf(base, ours, base)).toEqual(['stable', 'ours'])
    expect(buildMergedContent(base, merge, EMPTY)).toBe(ours)
  })

  it('仅传入侧改动 ⇒ theirs 块,自动取 theirs', () => {
    const base = lines('a', 'b')
    const theirs = lines('a', 'B')
    expect(kindsOf(base, base, theirs)).toEqual(['stable', 'theirs'])
    expect(buildMergedContent(base, computeThreeWay(base, base, theirs), EMPTY)).toBe(theirs)
  })

  it('两侧改到同一段且改法相同 ⇒ both-same(不判冲突,结果取该共同值)', () => {
    const base = lines('a', 'b')
    const both = lines('a', 'X')
    expect(kindsOf(base, both, both)).toEqual(['stable', 'both-same'])
    expect(buildMergedContent(base, computeThreeWay(base, both, both), EMPTY)).toBe(both)
  })

  it('两侧改到同一段且改法不同 ⇒ conflict,未选择不产出任何结果', () => {
    const base = lines('a', 'b', 'c')
    const ours = lines('a', 'OURS', 'c')
    const theirs = lines('a', 'THEIRS', 'c')
    const merge = computeThreeWay(base, ours, theirs)
    expect(kindsOf(base, ours, theirs)).toEqual(['stable', 'conflict', 'stable'])
    const conflict = merge.blocks.find((b) => b.kind === 'conflict')
    if (!conflict) throw new Error('fixture')
    expect(texts(conflict.base)).toEqual(['b'])
    expect(texts(conflict.ours)).toEqual(['OURS'])
    expect(texts(conflict.theirs)).toEqual(['THEIRS'])
    expect(buildMergedContent(base, merge, EMPTY)).toBeNull()
    expect(mergeResolutions(merge, EMPTY).unresolvedIds).toEqual([conflict.id])
  })

  it('两侧改到互不相交的两段 ⇒ 自动合并同时含两处改动(这才是三方视图的存在理由)', () => {
    const base = lines('a', 'b', 'c', 'd')
    const ours = lines('A', 'b', 'c', 'd')
    const theirs = lines('a', 'b', 'c', 'D')
    const merge = computeThreeWay(base, ours, theirs)
    expect(kindsOf(base, ours, theirs)).toEqual(['ours', 'stable', 'theirs'])
    expect(buildMergedContent(base, merge, EMPTY)).toBe(lines('A', 'b', 'c', 'D'))
  })

  it('两侧改到**相邻**(相接但不重叠)的两段 ⇒ 自动合并,不判冲突', () => {
    // ours 改第 1-2 行(base 区间 [0,2)),theirs 改第 3-5 行([2,5)) —— 端点相接。
    // 把相接当重叠会把最常见的可自动合并形态报成人裁,三方视图就比逐行手改更难用了。
    const base = lines('a', 'b', 'c', 'd', 'e')
    const ours = lines('A', 'B', 'c', 'd', 'e')
    const theirs = lines('a', 'b', 'C', 'D', 'E')
    const merge = computeThreeWay(base, ours, theirs)
    expect(merge.conflictIds).toHaveLength(0)
    expect(kindsOf(base, ours, theirs)).toEqual(['ours', 'theirs'])
    expect(buildMergedContent(base, merge, EMPTY)).toBe(lines('A', 'B', 'C', 'D', 'E'))
  })

  it('两侧在同一插入点各插不同内容 ⇒ conflict(谁在前无法机械决定)', () => {
    const base = lines('a', 'b')
    const ours = lines('a', 'O', 'b')
    const theirs = lines('a', 'T', 'b')
    const merge = computeThreeWay(base, ours, theirs)
    expect(merge.conflictIds).toHaveLength(1)
    const conflict = merge.blocks.find((b) => b.kind === 'conflict')
    if (!conflict) throw new Error('fixture')
    expect(texts(conflict.base)).toEqual([])
    expect(texts(conflict.ours)).toEqual(['O'])
    expect(texts(conflict.theirs)).toEqual(['T'])
  })

  it('一侧在另一侧改动区间**内部**插入 ⇒ 判纠缠(产出顺序无法机械决定)', () => {
    const base = lines('a', 'b', 'c', 'd')
    const theirs = lines('a', 'B', 'C', 'D') // 改 [1,4)
    const ours = lines('a', 'b', 'X', 'c', 'd') // 在 index 2 插入 ⇒ 落在 (1,4) 内部
    expect(hasConflicts(computeThreeWay(base, ours, theirs))).toBe(true)
  })

  it('两侧在不同插入点各插一行 ⇒ 不相干,自动合并同时含两行', () => {
    const base = lines('a', 'b', 'c')
    const ours = lines('O', 'a', 'b', 'c')
    const theirs = lines('a', 'b', 'c', 'T')
    const merge = computeThreeWay(base, ours, theirs)
    expect(merge.conflictIds).toHaveLength(0)
    expect(buildMergedContent(base, merge, EMPTY)).toBe(lines('O', 'a', 'b', 'c', 'T'))
  })

  it('一侧删除 vs 一侧修改同一段 ⇒ conflict,删除侧的三栏展示为空侧', () => {
    const base = lines('a', 'b', 'c')
    const ours = lines('a', 'c')
    const theirs = lines('a', 'B', 'c')
    const merge = computeThreeWay(base, ours, theirs)
    const conflict = merge.blocks.find((b) => b.kind === 'conflict')
    if (!conflict) throw new Error('fixture')
    expect(texts(conflict.ours)).toEqual([])
    expect(texts(conflict.theirs)).toEqual(['B'])
    expect(buildMergedContent(base, merge, new Map([[conflict.id, 'ours']]))).toBe(lines('a', 'c'))
    expect(buildMergedContent(base, merge, new Map([[conflict.id, 'theirs']]))).toBe(lines('a', 'B', 'c'))
  })

  it('两侧都删同一行 ⇒ both-same(删除也算改动,但不是冲突)', () => {
    const base = lines('a', 'b', 'c')
    const both = lines('a', 'c')
    expect(kindsOf(base, both, both)).toEqual(['stable', 'both-same', 'stable'])
    expect(buildMergedContent(base, computeThreeWay(base, both, both), EMPTY)).toBe(both)
  })

  it('空 base、两侧各写不同内容 ⇒ 整份内容都是冲突块', () => {
    const ours = lines('1', '2')
    const theirs = lines('3')
    const merge = computeThreeWay('', ours, theirs)
    expect(merge.conflictIds).toHaveLength(1)
    const block = merge.blocks[0]
    if (!block) throw new Error('fixture')
    expect(texts(block.base)).toEqual([])
    expect(texts(block.ours)).toEqual(['1', '2'])
    expect(texts(block.theirs)).toEqual(['3'])
  })
})

describe('diff-three-way:逐块选择来源', () => {
  function oneConflict() {
    const base = lines('a', 'b', 'c')
    const ours = lines('a', 'OURS', 'c')
    const theirs = lines('a', 'THEIRS', 'c')
    const merge = computeThreeWay(base, ours, theirs)
    const conflict = merge.blocks.find((b) => b.kind === 'conflict')
    if (!conflict) throw new Error('fixture')
    return { base, merge, conflict }
  }

  it('choose=both ⇒ 两段都留下,当前侧在前传入侧在后', () => {
    const { base, merge, conflict } = oneConflict()
    const merged = buildMergedContent(base, merge, new Map([[conflict.id, 'both']]))
    expect(merged).toBe(lines('a', 'OURS', 'THEIRS', 'c'))
  })

  it('resolveBlockLines:非冲突块忽略 choice,冲突块无 choice 返回 null', () => {
    const { merge, conflict } = oneConflict()
    const stable = merge.blocks.find((b) => b.kind === 'stable')
    if (!stable) throw new Error('fixture')
    expect(resolveBlockLines(stable, 'theirs')).toEqual(stable.base)
    expect(resolveBlockLines(conflict)).toBeNull()
    expect(resolveBlockLines(conflict, 'ours')).toEqual(conflict.ours)
    // both-same 取 ours 而不是 base(两侧做了同一处改动时 base 是旧值)
    const bs = computeThreeWay(lines('a', 'b'), lines('a', 'X'), lines('a', 'X')).blocks.find(
      (b) => b.kind === 'both-same',
    )
    if (!bs) throw new Error('fixture')
    expect(texts(resolveBlockLines(bs) ?? [])).toEqual(['X'])
  })

  it('一个冲突 + 一处干净改动:只需选一个块即可产出完整结果,且干净那处不被回退', () => {
    const base = lines('a', 'b', 'c', 'd')
    const ours = lines('OURS', 'b', 'C', 'd')
    const theirs = lines('THEIRS', 'b', 'C', 'd')
    const merge = computeThreeWay(base, ours, theirs)
    expect(merge.conflictIds).toHaveLength(1)
    expect(buildMergedContent(base, merge, EMPTY)).toBeNull()
    const chosen = new Map([[merge.conflictIds[0] as number, 'theirs' as MergeChoice]])
    expect(buildMergedContent(base, merge, chosen)).toBe(lines('THEIRS', 'b', 'C', 'd'))
  })

  it('chooseAllConflicts 只写冲突块,不污染自动块的选择表', () => {
    const { merge, conflict } = oneConflict()
    const next = chooseAllConflicts(merge, new Map(), 'ours')
    expect([...next.keys()]).toEqual([conflict.id])
    expect(mergeResolutions(merge, next).unresolvedIds).toEqual([])
  })

  it('mergeResolutions 计已决块数,并把未决块逐个点名', () => {
    const { merge, conflict } = oneConflict()
    expect(mergeResolutions(merge, EMPTY)).toEqual({ resolved: 2, unresolvedIds: [conflict.id] })
    const next = new Map([[conflict.id, 'ours'] as [number, MergeChoice]])
    expect(mergeResolutions(merge, next).resolved).toBe(merge.blocks.length)
  })

  it('summarizeMerge 逐类计数与块序列一致', () => {
    const base = lines('a', 'b', 'c', 'd', 'e')
    const ours = lines('A', 'b', 'C', 'd', 'E')
    const theirs = lines('a', 'b', 'X', 'd', 'E')
    const tally = summarizeMerge(computeThreeWay(base, ours, theirs))
    const total = Object.values(tally).reduce((s, n) => s + n, 0)
    expect(total).toBe(computeThreeWay(base, ours, theirs).blocks.length)
    expect(tally.stable).toBeGreaterThanOrEqual(0)
    expect(tally.conflict + tally['both-same']).toBeGreaterThanOrEqual(1)
  })
})

describe('diff-three-way:行尾符与字节保真', () => {
  it('base 用 CRLF 时,自动合并结果仍为 CRLF(不顺手换成 LF)', () => {
    const base = 'a\r\nb\r\n'
    const ours = 'a\r\nB\r\n'
    const merged = buildMergedContent(base, computeThreeWay(base, ours, base), EMPTY)
    expect(merged).toBe(ours)
    expect(merged).not.toContain('\n\r')
  })

  it('三侧一致时输出与 base 逐字节相同(包含行尾混排)', () => {
    const base = 'a\r\nb\nc'
    const merge = computeThreeWay(base, base, base)
    expect(buildMergedContent(base, merge, EMPTY)).toBe(base)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
