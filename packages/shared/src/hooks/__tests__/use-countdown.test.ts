// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useCountdown 截止戳派生夹具(2026-11-08,同型根因自查 shared 时间类)。
 *
 * shared 包没有 react-dom / 测试渲染器(devDeps 仅 vitest + @types/react),
 * 因此行为证据落在 hook 的纯转移函数上 —— hook 本体只剩「useState + 调度」的接线。
 * 红证(legacy):源文件为 tick 自减时,本文件导入即失败且源码守卫命中 `prev - 1`。
 */
import * as fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createCountdownState,
  pauseCountdown,
  remainingSeconds,
  resetCountdown,
  startCountdown,
  tickCountdown,
} from '../use-countdown'

const T0 = 1_760_000_000_000

describe('remainingSeconds — 唯一取整口径', () => {
  it('向上取整', () => {
    expect(remainingSeconds(T0 + 1_000, T0)).toBe(1)
    expect(remainingSeconds(T0 + 999, T0)).toBe(1)
    expect(remainingSeconds(T0 + 1, T0)).toBe(1)
    expect(remainingSeconds(T0 + 30_000, T0)).toBe(30)
  })

  it('已过期钳到 0(不出负数)', () => {
    expect(remainingSeconds(T0, T0)).toBe(0)
    expect(remainingSeconds(T0 - 5_000, T0)).toBe(0)
  })
})

describe('按截止戳派生 — 后台节流回归(legacy 会少走 19 秒)', () => {
  it('墙钟跳 20s 只发生一次 tick,仍落到 10', () => {
    let state = startCountdown(createCountdownState(30), T0)
    // 正常一帧
    state = tickCountdown(state, T0 + 1_000)
    expect(state.count).toBe(29)
    // 页面后台被节流:这 20 秒里 interval 没跑,只剩这一次 tick
    state = tickCountdown(state, T0 + 20_000)
    expect(state.count).toBe(10) // legacy 按 tick 自减只会得到 28
    expect(state.isRunning).toBe(true)
  })

  it('到期一次落零并停表', () => {
    let state = startCountdown(createCountdownState(5), T0)
    state = tickCountdown(state, T0 + 60_000)
    expect(state).toEqual({ deadlineMs: null, count: 0, isRunning: false })
  })

  it('未启动时 tick 是恒等转移', () => {
    const idle = createCountdownState(30)
    expect(tickCountdown(idle, T0 + 60_000)).toBe(idle)
  })
})

describe('pause / start 语义保持', () => {
  it('pause 取墙钟剩余,resume 以新截止戳继续', () => {
    let state = startCountdown(createCountdownState(30), T0)
    state = pauseCountdown(state, T0 + 10_000)
    expect(state).toEqual({ deadlineMs: null, count: 20, isRunning: false })
    // 暂停期间 tick 不得改动
    expect(tickCountdown(state, T0 + 30_000)).toBe(state)
    // 10 秒后再启动 ⇒ 20 秒额度,截到 T0 + 30s
    state = startCountdown(state, T0 + 10_000)
    expect(state.deadlineMs).toBe(T0 + 30_000)
    state = tickCountdown(state, T0 + 30_001)
    expect(state).toEqual({ deadlineMs: null, count: 0, isRunning: false })
  })

  it('0 秒不启动;reset 停止并落到指定值', () => {
    expect(startCountdown(createCountdownState(0), T0)).toEqual({
      deadlineMs: null,
      count: 0,
      isRunning: false,
    })
    expect(resetCountdown(7)).toEqual({ deadlineMs: null, count: 7, isRunning: false })
  })
})

describe('源码守卫 — 不得回退到 tick 自减', () => {
  const source = fs.readFileSync(new URL('../use-countdown.ts', import.meta.url), 'utf8')
  const ticker = fs.readFileSync(new URL('../deadline-ticker.ts', import.meta.url), 'utf8')

  it('没有 prev - 1 / count - 1 这类自减', () => {
    expect(source).not.toMatch(/prev\s*-\s*1/)
    expect(source).not.toMatch(/count\s*-\s*1/)
    expect(source).not.toMatch(/setCount\s*\(/)
  })

  it('派生与对表路径都钉住(use-countdown → deadline-ticker)', () => {
    expect(source).toMatch(/Date\.now/)
    expect(source).toMatch(/Math\.ceil/)
    expect(source).toMatch(/useDeadlineTicker/)
    expect(ticker).toMatch(/visibilitychange/)
    expect(ticker).toMatch(/focus/)
    expect(ticker).toMatch(/setInterval/)
  })

  it('返回体暴露 sync(供 Taro/RN 回前台显式对表)', () => {
    expect(source).toMatch(/sync:\s*\(\)\s*=>\s*void/)
    expect(source).toMatch(/return\s*\{[\s\S]*?sync\s*\}/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
