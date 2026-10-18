// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 生产监控大屏"未知态"判据的回归锁(每次提交都跑的那一层,不是自检档)。
 * 立因:这页以前把 null 兜成 0 / 兜成"恰好通过阈值"的值,于是"Prometheus 挂了"在看板上
 * 长得和"机器很闲很健康"一模一样。要锁的就是这两种混淆,所以每条断言都成对:
 * **测到的 0 必须算测到,没测到的一律不得参与判定。**
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { isNum, isUnset, thresholdTone } from '../unknown-state'

describe('监控大屏未知态判据(§0.3 没判不得冒充判过)', () => {
  it('测到的 0 是有效读数,不得与"没测到"混为一谈', () => {
    expect(isNum(0)).toBe(true)
    expect(isNum(-1)).toBe(true)
  })

  it('null / undefined / NaN / Infinity 都不是读数', () => {
    expect(isNum(null)).toBe(false)
    expect(isNum(undefined)).toBe(false)
    expect(isNum(Number.NaN)).toBe(false)
    expect(isNum(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isNum(Number.NEGATIVE_INFINITY)).toBe(false)
  })

  it('阈值染色遇到非有限值必须返回 unknown,且分类器一次都不被调用', () => {
    let calls = 0
    const classify = (n: number) => {
      calls++
      return n > 0.01 ? 'bad' : 'ok'
    }
    expect(thresholdTone(null, classify)).toBe('unknown')
    expect(thresholdTone(undefined, classify)).toBe('unknown')
    expect(thresholdTone(Number.NaN, classify)).toBe('unknown')
    expect(calls).toBe(0)
  })

  it('有效值正常参与判定:0 走 ok、超阈走 bad(证明 unknown 不是万能挡箭牌)', () => {
    const classify = (n: number) => (n > 0.01 ? 'bad' : 'ok')
    expect(thresholdTone(0, classify)).toBe('ok')
    expect(thresholdTone(0.5, classify)).toBe('bad')
  })

  it('布尔档位:false 是"测到且健康",null/undefined 才是未知', () => {
    expect(isUnset(false)).toBe(false)
    expect(isUnset(true)).toBe(false)
    expect(isUnset(null)).toBe(true)
    expect(isUnset(undefined)).toBe(true)
  })

  it('形状锁:判据只住 unknown-state.ts,页面里不得再有第二份实现', () => {
    const page = readFileSync(resolve(__dirname, '..', 'page.tsx'), 'utf8')
    for (const probe of [
      'function isNum(',
      'function isUnset(',
      'function thresholdTone(',
      'type StatusTone =',
    ]) {
      expect(page, `页面里不该再出现本地判据 ${probe}`).not.toContain(probe)
    }
    expect(page).toContain("from './unknown-state'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
