// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 语义折叠归组层单测(2026-10-29,对标 Qoder 借鉴清单第 4 项)。
 *
 * 判据纪律:
 *  - **不复制分类表**(§0.6 / 守门 `check-test-judge-not-replicated`) —— 本文件只喂工具名、
 *    只调生产导出;与类目表的对账由"生产函数自己算"完成,不在这里写第二份映射。
 *  - 每条判据都成对:同类归组 ↔ 异类不归;空输入 ↔ 单元素;折摘要 ↔ 含例外不折。
 *    只有正向一组时"判据恒真"也能全绿,那是本仓记过最多次的假绿形态。
 *  - 不变量(恰好一次 + 计数守恒)用逐条累加断言,而不是"总数看起来对"。
 */

import { describe, expect, it } from 'vitest'
import {
  FOLD_SUMMARY_MIN_COUNT,
  buildFoldRows,
  foldRowText,
  foldSummaryText,
  foldedAwayIds,
  type FoldActivity,
  type FoldRow,
} from '@/lib/fold-policy'

let seq = 0
function act(toolName: string, status = 'success'): FoldActivity {
  seq += 1
  return { id: `fc-${seq}`, toolName, status }
}

/** 行类型序列(断言用的扁平视图)。 */
function kinds(rows: readonly FoldRow[]): string[] {
  return rows.map((row) => row.kind)
}

/** 每行覆盖的条数(用于不变量断言)。 */
function counts(rows: readonly FoldRow[]): number[] {
  return rows.map((row) => row.count)
}

// ─── 空输入 / 单元素(边界)──────────────────────────────────────────────

describe('边界:空输入与单元素', () => {
  it('空输入 ⇒ 空行数组(不造占位行)', () => {
    expect(buildFoldRows([])).toEqual([])
    expect(foldSummaryText(buildFoldRows([]), (key) => key)).toBe('')
  })

  it('单元素 ⇒ 单条 item 行,不折(摘要与卡片同信息量,折了纯亏)', () => {
    const rows = buildFoldRows([act('read_file')])
    expect(kinds(rows)).toEqual(['item'])
    expect(rows[0]?.count).toBe(1)
    expect(rows[0]?.folded).toBe(false)
    // 单条行的 items 是元组([FoldActivity]),恰好覆盖那一枚
    expect(rows[0]?.items).toHaveLength(1)
  })

  it('判据常量可读且成对:折摘要的条数门槛是 2(1 条不折、2 条折)', () => {
    expect(FOLD_SUMMARY_MIN_COUNT).toBe(2)
    expect(buildFoldRows([act('read_file')])[0]?.kind).toBe('item')
    expect(buildFoldRows([act('read_file'), act('read_file')])[0]?.kind).toBe('summary')
  })
})

// ─── 同类归组(核心)──────────────────────────────────────────────────────

describe('同类连续归组', () => {
  it('连续 5 个读文件 ⇒ 一行 summary,count=5,folded=true(20 张卡变一行)', () => {
    const rows = buildFoldRows(
      Array.from({ length: 5 }, () => act('read_file')),
    )
    expect(kinds(rows)).toEqual(['summary'])
    expect(rows[0]?.count).toBe(5)
    expect(rows[0]?.folded).toBe(true)
    expect(rows[0]?.categoryKey).toBe('file_read')
  })

  it('同一类目但**非连续**(被异类打断)⇒ 断成两行,不跨段合并', () => {
    const rows = buildFoldRows([
      act('read_file'),
      act('read_file'),
      act('run_command'),
      act('read_file'),
      act('read_file'),
    ])
    expect(kinds(rows)).toEqual(['summary', 'item', 'summary'])
    expect(counts(rows)).toEqual([2, 1, 2])
    // 两行的 id 各自锚定段首活动 —— 流式追加时前缀 id 不漂
    expect(rows[0]?.id).not.toBe(rows[2]?.id)
  })

  it('异类不归:三个不同类目各一条 ⇒ 三条 item(不硬凑一行)', () => {
    const rows = buildFoldRows([act('read_file'), act('run_command'), act('web_search')])
    expect(kinds(rows)).toEqual(['item', 'item', 'item'])
    expect(new Set(rows.map((r) => r.categoryKey)).size).toBe(3)
  })

  it('同工具名连续 3 条命令 ⇒ 一行 summary(「执行 3 条命令」的形态)', () => {
    const rows = buildFoldRows([
      act('run_command'),
      act('run_command'),
      act('execute_command'),
    ])
    expect(kinds(rows)).toEqual(['summary'])
    expect(rows[0]?.categoryKey).toBe('command')
    expect(rows[0]?.count).toBe(3)
  })
})

// ─── 混合序列(真实形态)────────────────────────────────────────────────

describe('混合序列', () => {
  it('读×3 → 命令×2 → 单条搜索 → 写×2:行序列与计数逐格对齐', () => {
    const activities = [
      act('read_file'),
      act('read_file'),
      act('read_file'),
      act('run_command'),
      act('run_command'),
      act('web_search'),
      act('write_file'),
      act('write_file'),
    ]
    const rows = buildFoldRows(activities)
    expect(kinds(rows)).toEqual(['summary', 'summary', 'item', 'summary'])
    expect(counts(rows)).toEqual([3, 2, 1, 2])
    expect(rows.map((r) => r.categoryKey)).toEqual([
      'file_read',
      'command',
      'web_search',
      'file_write',
    ])
  })

  it('不变量①:输入每一项恰好出现一次且顺序不变(Σ count === 输入长度)', () => {
    const activities = [
      act('read_file'),
      act('grep'),
      act('grep'),
      act('run_command'),
      act('image_gen'),
      act('image_gen'),
      act('edit_file'),
    ]
    const rows = buildFoldRows(activities)
    const flattened = rows.flatMap((row) => row.items)
    expect(flattened).toHaveLength(activities.length)
    expect(flattened.map((item) => item.id)).toEqual(activities.map((item) => item.id))
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(activities.length)
  })

  it('不变量③:同一入参两次调用结果逐格相同(id / kind / count 全等)', () => {
    const activities = [act('read_file'), act('read_file'), act('run_command')]
    const first = buildFoldRows(activities)
    const second = buildFoldRows(activities)
    expect(second.map((r) => r.id)).toEqual(first.map((r) => r.id))
    expect(second.map((r) => r.kind)).toEqual(first.map((r) => r.kind))
    expect(second.map((r) => r.count)).toEqual(first.map((r) => r.count))
  })

  it('id 锚定段首活动且含类目名(React key 稳定,不用下标)', () => {
    const head = act('read_file')
    const rows = buildFoldRows([head, act('read_file')])
    expect(rows[0]?.id).toBe(`fold:file_read:${head.id}`)
  })
})

// ─── 语义例外集(永不折叠工具)─────────────────────────────────────────

describe('永不折叠工具:整组保留但仍是"一行"', () => {
  it('连续 2 条含 AskUserQuestion ⇒ group 行(folded=false),不压成计数短语', () => {
    const rows = buildFoldRows([act('AskUserQuestion'), act('AskUserQuestion')])
    expect(kinds(rows)).toEqual(['group'])
    expect(rows[0]?.folded).toBe(false)
    expect(rows[0]?.count).toBe(2)
  })

  it('成对反例:同类目但**不含**例外工具 ⇒ 同一位置上判成 summary', () => {
    const plain = buildFoldRows([act('read_file'), act('read_file')])
    expect(kinds(plain)).toEqual(['summary'])
    // 同一类目、同一计数,只因混入一枚例外工具,判定从折变成留
    const mixed = buildFoldRows([act('read_file'), act('AskUserQuestion')])
    expect(kinds(mixed)).toEqual(['item', 'item'])
  })

  it('foldSummaryText 只收 summary 行:group / item 不进摘要', () => {
    const rows = buildFoldRows([
      act('read_file'),
      act('read_file'),
      act('AskUserQuestion'),
      act('AskUserQuestion'),
      act('web_search'),
    ])
    const text = foldSummaryText(rows, (key, values) => `${key}:${values?.n}`)
    expect(text).toBe('foldReadFiles:2')
    expect(text).not.toContain('foldOthers')
  })

  it('foldRowText 是单行出口:summary 出短语,group / item 一律空串', () => {
    const rows = buildFoldRows([
      act('read_file'),
      act('read_file'),
      act('AskUserQuestion'),
      act('AskUserQuestion'),
      act('run_command'),
    ])
    const tr = (key: string, values?: Record<string, number | string>) => `${key}:${values?.n}`
    expect(foldRowText(rows[0]!, tr)).toBe('foldReadFiles:2')
    expect(foldRowText(rows[1]!, tr)).toBe('')
    expect(foldRowText(rows[2]!, tr)).toBe('')
  })
})

// ─── 取词失败(装饰性摘要的失效方向)──────────────────────────────────

describe('foldSummaryText 取词失败', () => {
  const rows = () => buildFoldRows([act('read_file'), act('read_file'), act('run_command'), act('run_command')])

  it('命中时按类目顺序以 · 连接', () => {
    expect(foldSummaryText(rows(), (key, values) => `${key}=${values?.n}`)).toBe(
      'foldReadFiles=2 · foldCommands=2',
    )
  })

  it('端侧缺键(取词原样返回键名)⇒ 跳过该段,不把裸键名喷到界面', () => {
    expect(foldSummaryText(rows(), (key) => key)).toBe('')
  })

  it('取词返回空串 ⇒ 同样跳过(坏字比缺字更糟)', () => {
    expect(
      foldSummaryText(rows(), (key) => (key === 'foldReadFiles' ? '  ' : '执行 2 条命令')),
    ).toBe('执行 2 条命令')
  })
})

// ─── 折叠视图下被收起/保留的活动(与折叠判据同源)──────────────────────

describe('foldedAwayIds:被折成摘要的收起、组与单条留台面', () => {
  it('summary 行覆盖的活动全在收起集;item / group 行一条都不在', () => {
    const folded1 = act('read_file')
    const folded2 = act('read_file')
    const single = act('run_command')
    const exceptionA = act('AskUserQuestion')
    const exceptionB = act('AskUserQuestion')
    const rows = buildFoldRows([folded1, folded2, single, exceptionA, exceptionB])
    const away = foldedAwayIds(rows)
    // 连续两条 read_file 被折 ⇒ 收起
    expect(away.has(folded1.id)).toBe(true)
    expect(away.has(folded2.id)).toBe(true)
    // 单条与含例外工具的整组都留台面(折了会丢入口)
    expect(away.has(single.id)).toBe(false)
    expect(away.has(exceptionA.id)).toBe(false)
    expect(away.has(exceptionB.id)).toBe(false)
  })

  it('成对:同一批活动,同类连续 vs 混入例外工具 —— 收起集大小从 6 掉到 0', () => {
    const plain = Array.from({ length: 6 }, () => act('read_file'))
    expect(foldedAwayIds(buildFoldRows(plain)).size).toBe(6)
    // 每两条之间插一枚永不折叠工具 ⇒ 全部断成 item/group,一条都不收
    const broken = plain.flatMap((item) => [item, act('AskUserQuestion')])
    const away = foldedAwayIds(buildFoldRows(broken))
    // 6 枚 read_file 各自成 item(被 AskUserQuestion 隔开) ⇒ 一个都不收
    for (const item of plain) expect(away.has(item.id)).toBe(false)
  })

  it('空输入 ⇒ 空集(不臆造)', () => {
    expect(foldedAwayIds([]).size).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
