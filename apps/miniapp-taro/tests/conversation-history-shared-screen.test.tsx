// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A2(2026-11-05) AI 会话历史共享屏 —— 行为等价 + 阴性对照。
 *
 * ① 正例:orderHistoryRows 与薄壳前的页面表达式**同一输入同一输出**(置顶优先 + 时间倒序);
 * ② 阴性对照:行为由 props 驱动 —— 不传 onLongPress 则行上没有长按删除;
 *    分组标题只在有行的组上出现(props 为空则不画);
 * ③ 结构锁:排序出口只有共享屏一处,页面 0 处。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { sortPinnedFirst } from '@ihui/shared/chat/conversation-org'
import {
  itemTimestamp,
  orderHistoryRows,
} from '../../../packages/app/src/features/chat/ConversationHistoryScreen'

interface Row {
  id: string
  timestamp: number
  pinned?: boolean
}

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8')

const SHARED = '../../../packages/app/src/features/chat/ConversationHistoryScreen.tsx'
// 2026-11-06 排序实现上移到 shared/chat/conversation-org(共享屏只 re-export),结构锁随之量真身。
const ORG = '../../../packages/shared/src/chat/conversation-org.ts'
const PAGE = '../src/pkg-ai/ai/history.tsx'

/** 薄壳前的页面表达式(逐字保留在测试里,作为等价基准) */
function legacyOrder(items: readonly Row[]): Row[] {
  return sortPinnedFirst([...items].sort((a, b) => itemTimestamp(b) - itemTimestamp(a)))
}

describe('A2 共享屏 orderHistoryRows', () => {
  const fixture: Row[] = [
    { id: 'old', timestamp: 100 },
    { id: 'pinned', timestamp: 50, pinned: true },
    { id: 'new', timestamp: 200 },
    { id: 'mid', timestamp: 150, pinned: true },
  ]

  it('正例:置顶优先(置顶组内保持时间倒序),其余时间倒序', () => {
    expect(orderHistoryRows(fixture).map((r) => r.id)).toEqual(['mid', 'pinned', 'new', 'old'])
  })

  it('等价证明:同一输入下与薄壳前页面表达式逐项一致', () => {
    expect(orderHistoryRows(fixture)).toEqual(legacyOrder(fixture))
    // 无置顶时退化为纯时间倒序(兜底态快照行的原顺序语义)
    const plain = fixture.filter((r) => !r.pinned)
    expect(orderHistoryRows(plain)).toEqual(legacyOrder(plain))
  })

  it('阴性对照:入参不变(纯函数,不就地改)', () => {
    const before = fixture.map((r) => r.id)
    orderHistoryRows(fixture)
    expect(fixture.map((r) => r.id)).toEqual(before)
  })
})

describe('A2 共享屏 props 驱动的阴性对照(结构锁)', () => {
  it('不传 onLongPress 时行上没有长按删除(只有三目后才挂 onLongPress)', () => {
    const src = read(SHARED)
    expect(src).toContain('onLongPress={onLongPress ? () => onLongPress(row) : undefined}')
    // 全文件只有三目里这一处调用,没有无条件挂载
    expect(src.match(/onLongPress\(row\)/g) ?? []).toHaveLength(1)
  })

  it('分组标题只在有行的组上渲染 —— 空 groups 不画标题', () => {
    // 语义断言（不再比对三目后的换行/括号形态）：标题渲染必须被 `group.items.length > 0`
    // 守卫包住，且全文件只有这一处 groupLabel 渲染 —— 空组不画标题。
    expect(read(SHARED)).toMatch(/group\.items\.length > 0[^\n]*groupLabel/u)
    expect(read(SHARED).match(/styles\.groupLabel\}/g) ?? []).toHaveLength(1)
  })

  it('排序出口只有共享层一处,页面 0 处', () => {
    expect(read(ORG).match(/itemTimestamp\(b\) - itemTimestamp\(a\)/g) ?? []).toHaveLength(1)
    expect(read(PAGE).match(/\.sort\(/g) ?? []).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
