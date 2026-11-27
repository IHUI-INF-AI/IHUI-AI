// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-11 崩溃看门狗重启腿判据测试(2026-11-28)。
 *
 * 钉四件事:
 *   1. 窗口预算是闭区间 [now-window, now],边界上的事件计入;
 *   2. 预算耗尽 ⇒ refuse 且带 used,不静默重启;
 *   3. 时钟倒退 ⇒ unjudged(不是 refuse)—— 不判"不该重启",而是"判不了";
 *   4. 脏事件被丢弃而不抛,一个 NaN 不能让整次判活失败。
 */

import { describe, expect, it } from 'vitest'

import {
  WATCHDOG_BACKOFF_MS,
  WATCHDOG_MAX_RESTARTS,
  WATCHDOG_WINDOW_MS,
  restartBudget,
  sanitizeRestartEvents,
  watchdogRestart,
} from '../src/daemon/watchdog-restart.js'

const NOW = 1_700_000_000_000

describe('sanitizeRestartEvents', () => {
  it('丢弃非有限数并按时间升序', () => {
    expect(sanitizeRestartEvents([3, NaN, 1, Infinity, 2])).toEqual([1, 2, 3])
  })

  it('非数组输入返回空数组', () => {
    expect(sanitizeRestartEvents(null)).toEqual([])
    expect(sanitizeRestartEvents('x')).toEqual([])
    expect(sanitizeRestartEvents({})).toEqual([])
  })

  it('不改入参', () => {
    const input = [3, 1, 2]
    sanitizeRestartEvents(input)
    expect(input).toEqual([3, 1, 2])
  })
})

describe('restartBudget', () => {
  it('空事件时全部剩余', () => {
    expect(restartBudget([], NOW)).toEqual({
      used: 0,
      remaining: WATCHDOG_MAX_RESTARTS,
      allowed: true,
    })
  })

  it('窗口左边界的事件计入(闭区间)', () => {
    const state = restartBudget([NOW - WATCHDOG_WINDOW_MS], NOW)
    expect(state.used).toBe(1)
  })

  it('窗口外的事件不计入', () => {
    const state = restartBudget([NOW - WATCHDOG_WINDOW_MS - 1], NOW)
    expect(state.used).toBe(0)
  })

  it('达到上限即不允许', () => {
    const events = Array.from({ length: WATCHDOG_MAX_RESTARTS }, (_, i) => NOW - i)
    expect(restartBudget(events, NOW).allowed).toBe(false)
    expect(restartBudget(events, NOW).remaining).toBe(0)
  })

  it('自定义窗口与上限', () => {
    const state = restartBudget([NOW - 100], NOW, { windowMs: 200, maxRestarts: 1 })
    expect(state.used).toBe(1)
    expect(state.allowed).toBe(false)
  })

  it('非法 windowMs/maxRestarts 回落默认', () => {
    const state = restartBudget([NOW], NOW, { windowMs: 0, maxRestarts: -2 })
    expect(state.used).toBe(1)
    expect(state.remaining).toBe(WATCHDOG_MAX_RESTARTS - 1)
  })

  it('now 非法时不允许', () => {
    expect(restartBudget([], NaN).allowed).toBe(false)
  })

  it('未来事件不计入窗口', () => {
    expect(restartBudget([NOW + 1_000], NOW).used).toBe(0)
  })
})

describe('watchdogRestart', () => {
  it('now 非法 ⇒ unjudged', () => {
    for (const bad of [undefined, null, NaN, 'x', Infinity]) {
      const d = watchdogRestart({ events: [], now: bad })
      expect(d.verdict).toBe('unjudged')
      expect(d.reason).toBe('unjudged_input')
      expect(d.delayMs).toBe(0)
    }
  })

  it('时钟倒退 ⇒ unjudged 而非 refuse', () => {
    const d = watchdogRestart({ events: [NOW + 5_000], now: NOW })
    expect(d.verdict).toBe('unjudged')
    expect(d.reason).toBe('clock_backwards')
  })

  it('预算耗尽 ⇒ refuse 带 used', () => {
    const events = Array.from({ length: WATCHDOG_MAX_RESTARTS }, (_, i) => NOW - i)
    const d = watchdogRestart({ events, now: NOW })
    expect(d.verdict).toBe('refuse')
    expect(d.reason).toBe('budget_exhausted')
    expect(d.used).toBe(WATCHDOG_MAX_RESTARTS)
  })

  it('首次重启零延迟', () => {
    const d = watchdogRestart({ events: [], now: NOW })
    expect(d.verdict).toBe('restart')
    expect(d.reason).toBe('ok')
    expect(d.delayMs).toBe(0)
    expect(d.used).toBe(0)
  })

  it('第二次起退避', () => {
    const d = watchdogRestart({ events: [NOW - 1_000], now: NOW })
    expect(d.verdict).toBe('restart')
    expect(d.delayMs).toBe(WATCHDOG_BACKOFF_MS[1])
    expect(d.used).toBe(1)
  })

  it('退避不超过末端封顶', () => {
    const d = watchdogRestart({ events: [NOW - 4, NOW - 3, NOW - 2, NOW - 1], now: NOW, maxRestarts: 9 })
    const capped = WATCHDOG_BACKOFF_MS[WATCHDOG_BACKOFF_MS.length - 1]
    expect(d.delayMs).toBe(capped)
  })

  it('脏事件不拖垮判活', () => {
    const d = watchdogRestart({ events: [NaN, 'x', NOW - 1, null], now: NOW })
    expect(d.verdict).toBe('restart')
    expect(d.used).toBe(1)
  })

  it('events 缺省视为空', () => {
    const d = watchdogRestart({ now: NOW })
    expect(d.verdict).toBe('restart')
  })

  it('窗口外旧崩溃不占预算', () => {
    const d = watchdogRestart({ events: [NOW - WATCHDOG_WINDOW_MS - 1], now: NOW })
    expect(d.used).toBe(0)
    expect(d.verdict).toBe('restart')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
