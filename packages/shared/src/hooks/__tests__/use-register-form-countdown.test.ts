// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * useRegisterForm 验证码倒计时夹具(2026-11-08,同型根因自查 shared 时间类)。
 *
 * hook 本体无法在 shared 的 node 环境渲染(无 react-dom),因此:
 * 1. 用与 hook 完全相同的转移序列验「墙钟跳变后仍按截止戳落位」;
 * 2. 用源码守卫钉住实现路径,防止有人把 setInterval 自减写回去。
 * 红证(legacy):`return c - 1` + `timerRef` 命中两条守卫,且转移函数导入失败。
 */
import * as fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resetCountdown, startCountdown, tickCountdown } from '../use-countdown'

const T0 = 1_760_000_000_000

describe('注册验证码倒计时 — 截止戳派生', () => {
  it('发码成功后的序列:reset(0) → start(60) → 后台跳 30s 单次 tick = 30', () => {
    let state = resetCountdown(0) // initialCountdown = 0
    expect(state.count).toBe(0)
    expect(state.isRunning).toBe(false)

    state = startCountdown(resetCountdown(60), T0)
    expect(state).toMatchObject({ count: 60, isRunning: true })

    // 后台 30 秒没有 tick,回到前台只跑一次
    state = tickCountdown(state, T0 + 30_000)
    expect(state.count).toBe(30) // legacy 自减在后台只会落到 59
    expect(state.isRunning).toBe(true)
  })

  it('到点归零,按钮解禁(与 codeBtnDisabled 判据一致)', () => {
    let state = startCountdown(resetCountdown(60), T0)
    state = tickCountdown(state, T0 + 61_000)
    expect(state.count).toBe(0)
    expect(state.isRunning).toBe(false)
  })
})

describe('源码守卫 — 不得回退到 setInterval 自减', () => {
  const source = fs.readFileSync(new URL('../use-register-form.ts', import.meta.url), 'utf8')

  it('没有 c - 1 / setCountdown / timerRef 的旧实现', () => {
    expect(source).not.toMatch(/c\s*-\s*1/)
    expect(source).not.toMatch(/\bsetCountdown\(/)
    expect(source).not.toMatch(/timerRef/)
  })

  it('委托给截止戳转移与统一对表 hook', () => {
    expect(source).toMatch(/startDeadlineCountdown/)
    expect(source).toMatch(/tickCountdown/)
    expect(source).toMatch(/useDeadlineTicker/)
    expect(source).toMatch(/resetCountdown/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
