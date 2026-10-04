// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815966 反向用例:CI 检查六态的零值计数表必须完备。
 *
 * 原写法 `{...} as Record<CiCheckState, number>` 把断言放在**初始化表达式**上 ——
 * TS 只校验断言两侧类型兼容,不校验字面量是否列全。后果:新增一档 `CI_CHECK_STATES` 时
 * 这张表悄悄少一档,`counts[check.state] += 1` 变成 `undefined += 1` ⇒ `NaN`,
 * 而 `deriveChecksSummary` 会把它当"该态计数 0"静默算进聚合结论,编译期零报错。
 * 现已改为完备字面量(显式类型标注,无 `as`),少一档即 `tsc` 报缺键。
 */
import { describe, expect, it } from 'vitest'
import {
  CI_CHECK_STATES,
  countChecksByState,
  type CiCheck,
  type CiCheckState,
} from '../pr-checks'

const check = (state: CiCheckState): CiCheck => ({ name: `c-${state}`, state })

describe('G-815966 / countChecksByState 完备性(反向用例)', () => {
  it('故意漏掉 neutral / unknown 两档 ⇒ 必须编译期报错', () => {
    // ⚠️ 注解写 `ReturnType<typeof countChecksByState>`(生产函数自身返回类型),
    //    **不是**在测试里重抄 `Record<CiCheckState, number>`。
    //    重抄的那份与生产无关:生产改回 `as Record<…>` 时测试照样绿,守卫形同虚设
    //    (2026-10-03 实测踩过:退回 as 断言后 typecheck 仍 exit 0,守卫没起作用)。
    //    绑 ReturnType 后:生产返回完备 Record ⇒ 漏两档报错 ⇒ 被抑制;
    //    生产退回 as / Partial ⇒ 漏两档不再是错误 ⇒ 本行 ts2578 判红。
    // @ts-expect-error 故意漏两档:完备 Record<Union, T> 缺键必须报错。
    const _missingTwo: ReturnType<typeof countChecksByState> = {
      failed: 0,
      passed: 0,
      pending: 0,
      skipped: 0,
    }
    expect(_missingTwo.neutral).toBeUndefined()
  })

  it('六态封闭集新增一档时,这行必须判红(判据=Exclude 归零)', () => {
    type Unhandled = Exclude<
      CiCheckState,
      'failed' | 'passed' | 'pending' | 'skipped' | 'neutral' | 'unknown'
    >
    const _noUnhandledState: Unhandled extends never ? true : { missing: Unhandled } = true
    expect(_noUnhandledState).toBe(true)
  })

  it('空输入返回的零值表键集与六态封闭集逐字相等(漏一档 ⇒ NaN 前就判红)', () => {
    const zero = countChecksByState([])
    expect(Object.keys(zero).sort()).toEqual([...CI_CHECK_STATES].sort())
    for (const state of CI_CHECK_STATES) {
      expect(zero[state], `状态 ${state} 未登记零值`).toBe(0)
    }
  })
})

describe('G-815966 / countChecksByState 完备性(运行时)', () => {
  it('喂进"每态各一条"后六态全为 1(任何一档漏登记都会在此显形为 0 或 NaN)', () => {
    const all = CI_CHECK_STATES.map(check)
    const counts = countChecksByState(all)
    for (const state of CI_CHECK_STATES) {
      expect(counts[state], `状态 ${state} 计数不等于 1(漏登记 ⇒ 0;旧 as 写法 ⇒ NaN)`).toBe(1)
    }
    // 显式挡 NaN:旧 `as` 写法漏一档时正是这一格出 NaN,而 `toBe(1)` 已能覆盖,这里留一道白话断言。
    expect(Object.values(counts).some(Number.isNaN)).toBe(false)
  })

  it('计数和恒等于输入条数(漏登记会打破守恒)', () => {
    const counts = countChecksByState([check('failed'), check('failed'), check('neutral')])
    const sum = CI_CHECK_STATES.reduce((acc, s) => acc + counts[s], 0)
    expect(sum).toBe(3)
    expect(counts.failed).toBe(2)
    expect(counts.neutral).toBe(1)
  })

  it('null / undefined 输入返回全零而非抛错(空态不炸)', () => {
    for (const input of [null, undefined]) {
      const counts = countChecksByState(input)
      expect(Object.keys(counts).sort()).toEqual([...CI_CHECK_STATES].sort())
    }
  })
})