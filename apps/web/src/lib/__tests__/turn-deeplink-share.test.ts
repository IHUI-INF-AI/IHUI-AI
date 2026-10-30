// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 差距⑤(2026-10-30 立):「分享此回合」深链生成侧用例。咬四件事:
//  ① 往返 —— buildTurnDeepLinkUrl 产出的 URL 用接收端 parseTurnParam 读回必须与原序号一致;
//  ② 完整页盖章 —— user 行开轮、自 1 起,与 apps/api createMessage 同一口径;
//  ③ 截断页(hasMore=true)整页 null —— 页头被截断不猜号;
//  ④ projectTurnOrdinals 三态 —— number 采信续算 / null 阻断 / undefined 仅在可推导时续算,
//     windowed=true 未盖章行一律不给号。
import { describe, expect, it } from 'vitest'
import {
  buildTurnDeepLinkUrl,
  markPageTurnOrdinals,
  parseTurnParam,
  projectTurnOrdinals,
  stampCompletePageTurnOrdinals,
} from '@/lib/turn-deeplink'

describe('buildTurnDeepLinkUrl · 生成→接收往返', () => {
  it('URL 的 conversationId 与 turn 用接收端读回,与原入参一致', () => {
    const url = buildTurnDeepLinkUrl('https://aizhs.top', 'conv-abc', 7)
    const parsed = new URL(url)
    expect(parsed.origin).toBe('https://aizhs.top')
    expect(parsed.pathname).toBe('/chat')
    expect(parsed.searchParams.get('conversationId')).toBe('conv-abc')
    expect(parseTurnParam(parsed.searchParams.get('turn'))).toBe(7)
  })

  it('turn=0 也往返(接收端接受非负整数)', () => {
    const parsed = new URL(buildTurnDeepLinkUrl('http://localhost:3000', 'c1', 0))
    expect(parseTurnParam(parsed.searchParams.get('turn'))).toBe(0)
  })
})

describe('stampCompletePageTurnOrdinals · 完整页计数口径', () => {
  it('user 开轮、1 起;assistant/system 沿用当前轮;开头边角料归第 1 轮', () => {
    const rows = stampCompletePageTurnOrdinals([
      { role: 'assistant' },
      { role: 'user' },
      { role: 'system' },
      { role: 'assistant' },
      { role: 'user' },
    ])
    expect(rows.map((r) => r.turnOrdinal)).toEqual([1, 1, 1, 1, 2])
  })
})

describe('markPageTurnOrdinals · 分页三态', () => {
  const rows = [{ role: 'user' }, { role: 'assistant' }, { role: 'user' }]

  it('hasMore=false ⇒ 页头即 turn 1,按口径盖章', () => {
    expect(markPageTurnOrdinals(rows, false).map((r) => r.turnOrdinal)).toEqual([1, 1, 2])
  })

  it('hasMore=true ⇒ 页头被截断,整页 null(不猜)', () => {
    expect(markPageTurnOrdinals(rows, true).map((r) => r.turnOrdinal)).toEqual([null, null, null])
  })
})

describe('projectTurnOrdinals · id→序号投影(三态)', () => {
  it('number 盖章行直接采信,其后 live(undefined)行按口径续算', () => {
    const map = projectTurnOrdinals([
      { id: 'h1', role: 'user', turnOrdinal: 5 },
      { id: 'h2', role: 'assistant', turnOrdinal: 5 },
      { id: 'l1', role: 'user' },
      { id: 'l2', role: 'assistant' },
    ])
    expect(map.get('h1')).toBe(5)
    expect(map.get('h2')).toBe(5)
    expect(map.get('l1')).toBe(6)
    expect(map.get('l2')).toBe(6)
  })

  it('null(截断页/更早行)阻断推导 ⇒ 其后 live 行不给号', () => {
    const map = projectTurnOrdinals([
      { id: 'p1', role: 'user', turnOrdinal: null },
      { id: 'p2', role: 'assistant', turnOrdinal: null },
      { id: 'l1', role: 'user' },
      { id: 'l2', role: 'assistant' },
    ])
    expect(map.size).toBe(0)
  })

  it('null 之后的盖章行仍采信自身序号,但 live 续算保持阻断(恢复只靠整表重盖)', () => {
    const map = projectTurnOrdinals([
      { id: 'p1', role: 'user', turnOrdinal: null },
      { id: 'l1', role: 'user' },
      { id: 's1', role: 'user', turnOrdinal: 3 },
      { id: 'l2', role: 'assistant' },
    ])
    expect(map.has('l1')).toBe(false)
    expect(map.get('s1')).toBe(3)
    expect(map.has('l2')).toBe(false)
  })

  it('整表重盖(翻到底重计)后全部恢复', () => {
    const stamped = stampCompletePageTurnOrdinals([
      { id: 'p1', role: 'user' },
      { id: 'p2', role: 'assistant' },
      { id: 'l1', role: 'user' },
    ])
    const map = projectTurnOrdinals(stamped.map((r) => ({ ...r })))
    expect(map.get('p1')).toBe(1)
    expect(map.get('p2')).toBe(1)
    expect(map.get('l1')).toBe(2)
  })

  it('windowed=true ⇒ 未盖章行一律不给号(含盖章行之后的 live 行),盖章行仍采信', () => {
    const map = projectTurnOrdinals(
      [
        { id: 'l0', role: 'user' },
        { id: 'w1', role: 'user', turnOrdinal: 9 },
        { id: 'w2', role: 'assistant', turnOrdinal: 9 },
        { id: 'l1', role: 'user' },
      ],
      { windowed: true },
    )
    expect(map.has('l0')).toBe(false)
    expect(map.get('w1')).toBe(9)
    expect(map.get('w2')).toBe(9)
    expect(map.has('l1')).toBe(false)
  })

  it('会话开头即 assistant 的 live 行归第 1 轮(Math.max 兜底)', () => {
    const map = projectTurnOrdinals([{ id: 'a1', role: 'assistant' }])
    expect(map.get('a1')).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
