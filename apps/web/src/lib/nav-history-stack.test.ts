// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  NAV_HISTORY_MAX_ENTRIES,
  buildNavSessionEntityKey,
  canGoBack,
  canGoForward,
  createNavHistory,
  goBack,
  goForward,
  navTargetExists,
  pushRunsNavEntry,
  pushSessionNavEntry,
  removeSessionFromNavHistory,
  type NavHistory,
} from './nav-history-stack'

/**
 * 浏览器式导航历史栈 单测(2026-09-30,票 G-977980)。
 *
 * 锁定五条不变量:
 *  1. push→back→push:前进历史被截断
 *  2. 删除当前条目后 back 目标正确(cursor 语义保持)
 *  3. 50 条溢出 cursor 平移
 *  4. 相邻重复 push 去重
 *  5. back 目标不在可见列表但 meta 表有 → 仍可导航
 */

const WS = { workspacePath: 'G:/ws/a' }
const WS_REMOTE = { workspacePath: 'G:/ws/a', workspaceIdentity: 'remote:host:1' }

function pushSessions(history: NavHistory, sessionIds: string[]): NavHistory {
  let next = history
  for (const sessionId of sessionIds) {
    next = pushSessionNavEntry(next, { ...WS, sessionId })
  }
  return next
}

describe('push / back / forward', () => {
  it('push→back→push 截断前进历史', () => {
    let history = createNavHistory()
    history = pushSessions(history, ['s1', 's2', 's3'])
    expect(history.entries.map((entry) => (entry.kind === 'session' ? entry.sessionId : ''))).toEqual([
      's1',
      's2',
      's3',
    ])
    expect(history.cursor).toBe(2)

    const back = goBack(history)
    expect(back?.entry).toMatchObject({ kind: 'session', sessionId: 's2' })
    history = back!.history

    // 从 s2 push s9:s3 及其后全部作废
    history = pushSessionNavEntry(history, { ...WS, sessionId: 's9' })
    expect(history.entries.map((entry) => (entry.kind === 'session' ? entry.sessionId : ''))).toEqual([
      's1',
      's2',
      's9',
    ])
    expect(canGoForward(history)).toBe(false)
    expect(goForward(history)).toBeNull()
  })

  it('相邻重复 push 去重(历史回放/连续打开同一目标)', () => {
    let history = createNavHistory()
    history = pushSessions(history, ['s1', 's2'])
    // 连续打开当前目标:不重复入栈
    history = pushSessionNavEntry(history, { ...WS, sessionId: 's2' })
    expect(history.entries).toHaveLength(2)
    // 后退到 s1 再前进回放 s2,重复 push 同一目标:仍不重复入栈
    history = goBack(history)!.history
    history = goForward(history)!.history
    history = pushSessionNavEntry(history, { ...WS, sessionId: 's2' })
    expect(history.entries).toHaveLength(2)
    expect(history.cursor).toBe(1)
  })

  it('不同会话/不同工作区身份不去重', () => {
    let history = createNavHistory()
    history = pushSessions(history, ['s1'])
    history = pushSessionNavEntry(history, { ...WS, sessionId: 's2' })
    history = pushSessionNavEntry(history, { ...WS_REMOTE, sessionId: 's1' })
    expect(history.entries).toHaveLength(3)
  })

  it('空栈 back/forward 返回 null', () => {
    const history = createNavHistory()
    expect(canGoBack(history)).toBe(false)
    expect(goBack(history)).toBeNull()
    expect(goForward(history)).toBeNull()
  })
})

describe('溢出与删除', () => {
  it('50 条溢出裁剪最旧,cursor 同步平移', () => {
    let history = createNavHistory()
    const ids = Array.from({ length: NAV_HISTORY_MAX_ENTRIES + 3 }, (_, i) => `s${i}`)
    history = pushSessions(history, ids)
    expect(history.entries).toHaveLength(NAV_HISTORY_MAX_ENTRIES)
    // s0/s1/s2 被裁掉,最旧是 s3;cursor 仍指向最新条目
    expect(history.entries[0]).toMatchObject({ kind: 'session', sessionId: 's3' })
    expect(history.cursor).toBe(NAV_HISTORY_MAX_ENTRIES - 1)
    const current = history.entries[history.cursor]
    expect(current).toMatchObject({ sessionId: `s${NAV_HISTORY_MAX_ENTRIES + 2}` })

    // 后退一路应逐个命中裁剪后的次序
    expect(goBack(history)?.entry).toMatchObject({ sessionId: `s${NAV_HISTORY_MAX_ENTRIES + 1}` })
  })

  it('删除中间条目:其余条目与 cursor 语义保持', () => {
    let history = pushSessions(createNavHistory(), ['s1', 's2', 's3'])
    history = goBack(history)!.history // cursor 指向 s2
    history = removeSessionFromNavHistory(history, 's2')
    expect(history.entries.map((entry) => (entry.kind === 'session' ? entry.sessionId : ''))).toEqual([
      's1',
      's3',
    ])
    // 当前(s2)被删:沿用旧位置取最近目标 → 现在位置上是 s3
    expect(history.entries[history.cursor]).toMatchObject({ sessionId: 's3' })
    // back 目标是 s1,前进目标不存在(s3 已是栈顶)
    expect(goBack(history)?.entry).toMatchObject({ sessionId: 's1' })
    expect(canGoForward(history)).toBe(false)
  })

  it('删除非当前条目:cursor 保持指向原条目', () => {
    let history = pushSessions(createNavHistory(), ['s1', 's2', 's3'])
    history = goBack(history)!.history // cursor 指向 s2
    history = removeSessionFromNavHistory(history, 's1')
    expect(history.entries.map((entry) => (entry.kind === 'session' ? entry.sessionId : ''))).toEqual([
      's2',
      's3',
    ])
    expect(history.entries[history.cursor]).toMatchObject({ sessionId: 's2' })
    expect(goBack(history)).toBeNull()
  })

  it('删除全部会话条目后栈清空;运行记录条目原样保留', () => {
    let history = pushSessions(createNavHistory(), ['s1', 's2'])
    history = pushRunsNavEntry(history, WS)
    history = pushSessions(history, ['s3'])
    history = removeSessionFromNavHistory(history, 's1')
    history = removeSessionFromNavHistory(history, 's2')
    history = removeSessionFromNavHistory(history, 's3')
    expect(history.entries).toHaveLength(1)
    expect(history.entries[0]).toMatchObject({ kind: 'runs' })
    expect(history.cursor).toBe(0)
  })

  it('删除不存在的条目返回原引用(不可变更新零拷贝)', () => {
    const history = pushSessions(createNavHistory(), ['s1'])
    expect(removeSessionFromNavHistory(history, 'nope')).toBe(history)
  })
})

describe('导航目标存在性', () => {
  it('back 目标不在可见列表但 meta 表有 → 仍可导航', () => {
    const entry = { kind: 'session' as const, ...WS, sessionId: 's-old' }
    const exists = navTargetExists({
      entry,
      visibleSessions: [{ sessionId: 's-current' }],
      sessionMetaByEntityKey: { [buildNavSessionEntityKey(entry)]: { sessionId: 's-old' } },
    })
    expect(exists).toBe(true)
  })

  it('可见列表有 → 存在,即便 meta 表没有', () => {
    const entry = { kind: 'session' as const, ...WS, sessionId: 's-live' }
    expect(
      navTargetExists({
        entry,
        visibleSessions: [{ sessionId: 's-live' }],
        sessionMetaByEntityKey: {},
      }),
    ).toBe(true)
  })

  it('两边都没有 → 不存在(按钮应禁用)', () => {
    const entry = { kind: 'session' as const, ...WS, sessionId: 's-gone' }
    expect(
      navTargetExists({ entry, visibleSessions: [], sessionMetaByEntityKey: {} }),
    ).toBe(false)
  })

  it('工作区身份不同 → meta 表查不到(不串工作区)', () => {
    const local = { kind: 'session' as const, ...WS, sessionId: 's1' }
    const remoteMeta = {
      [buildNavSessionEntityKey({ ...WS_REMOTE, sessionId: 's1' })]: { sessionId: 's1' },
    }
    expect(
      navTargetExists({ entry: local, visibleSessions: [], sessionMetaByEntityKey: remoteMeta }),
    ).toBe(false)
  })

  it('运行记录条目恒存在', () => {
    expect(
      navTargetExists({
        entry: { kind: 'runs', ...WS },
        visibleSessions: [],
        sessionMetaByEntityKey: {},
      }),
    ).toBe(true)
  })
})
