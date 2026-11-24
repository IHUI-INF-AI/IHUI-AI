// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import {
  contentKeyOf,
  createListVersionGate,
  stabilizeListItems,
  structurallyEqualIgnoringKeyOrder,
} from '../list-stabilization'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..')

/** 取不到输入即「未判定」,绝不回落成「没问题」(§0.3)。 */
function readSource(relative: string): string {
  try {
    return readFileSync(join(ROOT, relative), 'utf8')
  } catch {
    throw new Error(`消费点正文读取失败:${relative} —— 取不到输入即未判定,绝不回落成"没问题"`)
  }
}

describe('判据① 同内容不同键序 ⇒ 必须判等(阳性对照:JSON.stringify 这一型必红)', () => {
  const shaped = { id: 'm1', title: 'A', groupIndex: 0 }
  const reordered = { groupIndex: 0, title: 'A', id: 'm1' }

  it('structurallyEqualIgnoringKeyOrder 忽略键序', () => {
    // 阳性对照:夹具确实"同内容不同键序" —— 否则下面这句绿只是尺子空转
    expect(JSON.stringify(shaped)).not.toBe(JSON.stringify(reordered))
    expect(structurallyEqualIgnoringKeyOrder(shaped, reordered)).toBe(true)
  })

  it('contentKeyOf 对同内容不同键序给出同一枚串', () => {
    expect(contentKeyOf(shaped)).toBe(contentKeyOf(reordered))
    expect(JSON.stringify(shaped)).not.toBe(JSON.stringify(reordered))
  })

  it('整表只是键序变了 ⇒ 拿回的数组就是上一帧那份(引用相同)', () => {
    const prev = [shaped, { id: 'm2', title: 'B' }]
    const next = [{ ...reordered }, { id: 'm2', title: 'B' }]
    const out = stabilizeListItems(prev, next)
    expect(out).toBe(prev)
    expect(out[0]).toBe(prev[0])
    expect(out[1]).toBe(prev[1])
  })
})

describe('判据② `undefined` 与"键缺失"必须同视', () => {
  it('值为 undefined 的键不参与比较', () => {
    expect(structurallyEqualIgnoringKeyOrder({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(contentKeyOf({ a: 1, b: undefined })).toBe(contentKeyOf({ a: 1 }))
  })

  it('嵌套层同样同视', () => {
    expect(
      structurallyEqualIgnoringKeyOrder(
        { id: 'x', meta: { unreadAt: 5, title: undefined } },
        { id: 'x', meta: { unreadAt: 5 } },
      ),
    ).toBe(true)
  })

  it('`null` 是一个值,不得与"键缺失"并成一档(过度折叠会把内容变了读成没变)', () => {
    expect(structurallyEqualIgnoringKeyOrder({ a: null }, { a: undefined })).toBe(false)
    expect(contentKeyOf({ a: null })).not.toBe(contentKeyOf({}))
  })

  it('数组按序逐元素比较,顺序变了就是变了', () => {
    expect(structurallyEqualIgnoringKeyOrder([1, 2], [2, 1])).toBe(false)
    expect(structurallyEqualIgnoringKeyOrder([{ a: 1 }], [{ a: 1 }])).toBe(true)
  })

  it('非普通对象(Map/Date/类实例)按引用判等,不猜私有语义', () => {
    const mapA = new Map([['k', 1]])
    const mapB = new Map([['k', 1]])
    expect(structurallyEqualIgnoringKeyOrder(mapA, mapB)).toBe(false)
    expect(structurallyEqualIgnoringKeyOrder(mapA, mapA)).toBe(true)
  })
})

describe('列表逐元素复用(增删改各自走对的方向)', () => {
  it('尾部追加:前缀逐元素复用旧引用,数组换新', () => {
    const a = { id: 'a', n: 1 }
    const b = { id: 'b', n: 2 }
    const prev = [a, b]
    const next = [
      { n: 1, id: 'a' },
      { id: 'b', n: 2 },
      { id: 'c', n: 3 },
    ]
    const out = stabilizeListItems(prev, next)
    expect(out).not.toBe(prev)
    expect(out[0]).toBe(a)
    expect(out[1]).toBe(b)
    expect(out[2]).toBe(next[2])
  })

  it('中间一项内容变了:只有那一项换新引用', () => {
    const a = { id: 'a', n: 1 }
    const b = { id: 'b', n: 2 }
    const prev = [a, b]
    const out = stabilizeListItems(prev, [
      { id: 'a', n: 1 },
      { id: 'b', n: 99 },
    ])
    expect(out[0]).toBe(a)
    expect(out[1]).not.toBe(b)
    expect(out[1]).toEqual({ id: 'b', n: 99 })
  })

  it('空表对空表也是同一份引用(首帧之后不得每帧换)', () => {
    const prev: { id: string }[] = []
    expect(stabilizeListItems(prev, [])).toBe(prev)
  })
})

describe('判据③ 版本网关:构造不出可靠内容 key 就放行并计数,不得当成"已去重"', () => {
  it('同一内容(键序不同)在窗口内只放行首个', () => {
    const at = 1000
    const gate = createListVersionGate({ windowMs: 500, now: () => at })
    expect(gate.bump({ content: { ws: 'a', updatedAt: 7 } }).outcome).toBe('bumped')
    expect(gate.bump({ content: { updatedAt: 7, ws: 'a' } }).outcome).toBe('deduped')
    expect(gate.snapshot()).toMatchObject({
      version: 1,
      dedupedCount: 1,
      noContentKeyPassThrough: 0,
    })
  })

  it('真实 mutation(updatedAt 变了)不得被去重吞掉', () => {
    const gate = createListVersionGate({ windowMs: 500, now: () => 1000 })
    gate.bump({ content: { ws: 'a', updatedAt: 7 } })
    expect(gate.bump({ content: { ws: 'a', updatedAt: 8 } }).outcome).toBe('bumped')
  })

  it('窗口过后同内容允许再放行一次', () => {
    let at = 1000
    const gate = createListVersionGate({ windowMs: 500, now: () => at })
    gate.bump({ content: { ws: 'a' } })
    at = 1400
    expect(gate.bump({ content: { ws: 'a' } }).outcome).toBe('deduped')
    at = 1600
    expect(gate.bump({ content: { ws: 'a' } }).outcome).toBe('bumped')
  })

  it('不带 meta:版本号加一、计数加一,且不计入 deduped', () => {
    const gate = createListVersionGate({ windowMs: 500, now: () => 0 })
    const first = gate.bump()
    const second = gate.bump()
    expect(first.outcome).toBe('passed-through')
    expect(second.outcome).toBe('passed-through')
    expect(second.version).toBe(2)
    expect(gate.snapshot()).toMatchObject({ dedupedCount: 0, noContentKeyPassThrough: 2 })
  })

  it('content 显式为 null/undefined 同样算"判不出" ⇒ 放行计数,不静默去重', () => {
    const gate = createListVersionGate({ windowMs: 500, now: () => 0 })
    expect(gate.bump({ content: null }).outcome).toBe('passed-through')
    expect(gate.bump({ content: undefined }).outcome).toBe('passed-through')
    expect(gate.snapshot().noContentKeyPassThrough).toBe(2)
  })

  it('键上限有界:超出按插入序淘汰最旧(防长会话无界增长)', () => {
    const gate = createListVersionGate({ windowMs: 10_000, maxKeys: 2, now: () => 0 })
    gate.bump({ content: { k: 1 } })
    gate.bump({ content: { k: 2 } })
    gate.bump({ content: { k: 3 } })
    expect(gate.snapshot().trackedKeys).toBe(2)
    // 最旧的 k:1 已被淘汰 ⇒ 再来一次是 bumped 而不是 deduped
    expect(gate.bump({ content: { k: 1 } }).outcome).toBe('bumped')
  })
})

describe('装车锁 两处消费点必须真在调用这套单源(注释式引用不算)', () => {
  const UNREAD = 'apps/web/src/lib/unread-field-sync.ts'
  const DERIVATIONS = 'apps/web/src/components/chat/message-list/use-message-list-derivations.ts'

  it('unread-field-sync 的 bump 去重走网关,旧的本地拼串键已不在场', () => {
    const src = readSource(UNREAD)
    expect(src.includes('createListVersionGate('), '未取到网关构造 ⇒ 未装车').toBe(true)
    expect(src.includes('versionGate.bump('), '未取到 bump 调用点 ⇒ 未装车').toBe(true)
    expect(
      src.includes('noContentKeyPassThrough: versionGate.snapshot()'),
      '计数仍读本地变量',
    ).toBe(true)
    // 反向:第二份真相源的形状(本地窗口 Map + 四字段拼串)不得残留
    expect(src.includes('recentUnreadByKey'), '本地去重窗口仍在 ⇒ 留了第二份真相源').toBe(false)
    expect(/dedupeKey\s*=\s*\[/.test(src), '拼串去重键仍在 ⇒ 未收敛到内容 key').toBe(false)
  })

  it('message-list 派生处两张列表都过了稳定化', () => {
    const src = readSource(DERIVATIONS)
    expect(src.includes("from '@ihui/shared/ui/list-stabilization'"), '未引共享出口 ⇒ 未装车').toBe(
      true,
    )
    const callCount = (src.match(/stabilizeListItems\(/g) ?? []).length
    expect(
      callCount,
      `调用点应覆盖 planSteps 与 derivedEvents 两张表,现读到 ${callCount}`,
    ).toBeGreaterThanOrEqual(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
