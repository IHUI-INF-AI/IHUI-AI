// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect } from 'react'
import { I18nProvider, useI18n } from '../src/i18n'

/**
 * 钉的是 `I18nProvider` 的 context value 身份稳定性(母型缺陷回归锁)。
 *
 * 立因:该 Provider 原本把 `value={{ locale, setLocale, t }}` 写成每次渲染新建的字面量,
 * 而 `t`/`setLocale` 本身也是渲染期新建的箭头函数 ⇒ 整个 context 值**每次渲染都换身份**。
 * 后果不是"多渲染一次"这么轻:真实页面里 `const { t } = useI18n()` 的 `t` 一旦进了
 * effect 依赖数组,就会跟着换身份重跑 —— 子席在 tests/wallet.test.tsx 实测到
 * `[load]` effect 重跑、`getBalance` 被真调 2 次(首轮 3 连跑稳定红即此型)。
 * 该子席当时是在**测试替身**里把 `t` 改稳绕过去的,生产侧这具母型没动。
 *
 * 三条判据,缺一就是假绿:
 *  ① 消费者确实被渲染了 ≥2 次(重渲染真的传导到了订阅者)——否则下面两条恒成立,测试是空的;
 *  ② 重渲染前后 `t` / `setLocale` / 整个 context value 的引用**不变**,且依赖 `t` 的 effect
 *     只跑 1 次(这条就是 getBalance 被调两次的那台机的最小形状);
 *  ③ 反向对照:切语言后 `t` 必须真的换词典(取到的文案变成 en)且 effect 必须重跑 ——
 *     防的是"把 value memo 成常量/依赖漏写 locale"这种把语言冻住的假修复。
 */

type I18nContextValue = ReturnType<typeof useI18n>

/** 每次渲染在提交后登记一次,用于量身份是否随渲染漂移 */
let seenContexts: I18nContextValue[] = []
/** 依赖 `t` 的 effect 实际执行次数(缺陷形态下 = 渲染次数,修复后应恒为 1) */
let tDependentEffectRuns = 0

function Consumer() {
  const ctx = useI18n()
  const { t } = ctx

  // 无依赖数组 ⇒ 每次提交后都记一次当前身份(不写渲染期副作用)
  useEffect(() => {
    seenContexts.push(ctx)
  })

  // 这就是钱包那台机的形状:effect 依赖 t,t 换身份 ⇒ effect 重跑 ⇒ 请求被真发第二次
  useEffect(() => {
    tDependentEffectRuns += 1
  }, [t])

  return null
}

function tree() {
  return (
    <I18nProvider>
      <Consumer />
    </I18nProvider>
  )
}

const WELCOME_ZH = '欢迎使用智汇 AI'
const WELCOME_EN = 'Welcome to IHUI AI'

/**
 * 本端 tsconfig 开了 noUncheckedIndexedAccess ⇒ 下标取值是 `| undefined`。
 * 这里不接受"拿 undefined 继续断言":取不到样本就是判据没跑起来,必须当场点名。
 */
function seenAt(index: number): I18nContextValue {
  const ctx = seenContexts[index]
  if (!ctx) {
    throw new Error(`第 ${index} 次登记没有 context 样本(当前共 ${String(seenContexts.length)} 次)`)
  }
  return ctx
}

function lastSeen(): I18nContextValue {
  return seenAt(seenContexts.length - 1)
}

describe('mobile-rn I18nProvider:context value 与 t 的身份必须跨渲染稳定', () => {
  beforeEach(() => {
    seenContexts = []
    tDependentEffectRuns = 0
  })

  it('父级重渲染一次:t / setLocale / value 引用不变,依赖 t 的 effect 不重跑', () => {
    const { rerender } = render(tree())
    rerender(tree())

    // 判据①:重渲染确实传导到了订阅者(枚举到 0 个样本 ⇒ 本测试什么都没判)
    expect(seenContexts.length).toBeGreaterThanOrEqual(2)

    const first = seenAt(0)
    const last = lastSeen()

    // 判据②:三条身份逐一钉住
    expect(last).toBe(first)
    expect(last.t).toBe(first.t)
    expect(last.setLocale).toBe(first.setLocale)

    // 判据②之果:effect 只跑挂载那一次,不跟着渲染次数走
    expect(tDependentEffectRuns).toBe(1)
  })

  it('切语言不是冻词典:locale 变化必须换 t 并让依赖 t 的 effect 重跑', async () => {
    const { rerender } = render(tree())
    expect(seenAt(0).t('home.welcome')).toBe(WELCOME_ZH)

    await act(async () => {
      await lastSeen().setLocale('en')
    })
    rerender(tree())

    const last = lastSeen()
    // 取词真的换成 en(而不是回落 zh-CN,也不是把中文冻在 memo 里)
    expect(last.t('home.welcome')).toBe(WELCOME_EN)
    expect(last.locale).toBe('en')
    // 词典换了 ⇒ t 的身份**必须**变;恒等就是过度 memo(语言切不动)
    expect(last.t).not.toBe(seenAt(0).t)
    // 且消费方的 effect 必须感知到这一次真实变化
    expect(tDependentEffectRuns).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
