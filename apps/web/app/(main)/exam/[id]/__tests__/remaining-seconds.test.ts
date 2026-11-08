// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * W-01 回归锁:考试倒计时必须以截止时间戳为准。
 * 立因:旧实现每秒 `setLeftSec((s) => s - 1)`,把"经过的时间"当成 tick 次数;
 * 浏览器在后台会节流/暂停定时器,锁屏或系统休眠更是直接不走 —— 自减型倒计时于是跟着冻住,
 * 切后台十分钟回来还剩原来的时间,考试被无声延长,而且没有任何门看得见。
 * 这层锁管两件事:①纯函数口径(ceil、越过截止夹 0);②源码不得回退成自减型。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { mmss, remainingSeconds } from '../helpers'

const SRC = readFileSync(resolve(__dirname, '..', 'PageClient.tsx'), 'utf8')

describe('剩余时间按截止戳重算(不按 tick 次数自减)', () => {
  it('刚开始:截止戳减现在正好满额,显示与 duration:00 一致', () => {
    expect(remainingSeconds(150_000, 0)).toBe(150)
    expect(mmss(remainingSeconds(150_000, 0))).toBe('02:30')
  })

  it('中途:定时器晚到/跳格都不影响读数(读数只由时间差决定)', () => {
    expect(remainingSeconds(150_000, 91_300)).toBe(59)
  })

  it('后台冻住十分钟后回前台:读数必须补齐(旧自减会原地不动)', () => {
    // 旧实现后台 600 秒一格没减,回来仍显示 02:30 ⇒ 考试多给十分钟
    expect(remainingSeconds(150_000, 601_000)).toBe(0)
  })

  it('刚好到点 ⇒ 0;越过截止点一律夹 0(不出现负数)', () => {
    expect(remainingSeconds(150_000, 150_000)).toBe(0)
    expect(remainingSeconds(150_000, 1_000_000)).toBe(0)
  })

  it('不足 1 秒仍显示 1(向上取整,与开始满额口径一致)', () => {
    expect(remainingSeconds(150_000, 149_001)).toBe(1)
    expect(mmss(remainingSeconds(150_000, 149_001))).toBe('00:01')
  })
})

describe('PageClient 倒计时源码锁(回退即红)', () => {
  it('不得再每秒自减', () => {
    expect(SRC).not.toMatch(/setLeftSec\(\s*\(\s*s\s*\)\s*=>\s*s\s*-\s*1\s*\)/)
  })

  it('必须以截止戳起算,并在回到前台时立刻补算', () => {
    expect(SRC).toContain('deadlineRef.current = Date.now() + duration * 60_000')
    expect(SRC).toContain('const tick = () => setLeftSec(remainingSeconds(deadline))')
    expect(SRC).toContain("document.addEventListener('visibilitychange', tick)")
    expect(SRC).toContain("window.addEventListener('focus', tick)")
    expect(SRC).toContain("window.addEventListener('pageshow', tick)")
  })

  it('自动交卷必须一次性(0 秒读数不得反复触发提交)', () => {
    expect(SRC).toContain('autoSubmitStartedRef.current = true')
    expect(SRC).toContain('!autoSubmitStartedRef.current')
    expect(SRC).toContain('deadlineRef.current !== null')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
