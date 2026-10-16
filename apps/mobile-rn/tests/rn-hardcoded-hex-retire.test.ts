// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票:RN 端硬编码 hex 治理(守门 218 存量 12→10)—— 最小断言:
// IntroducePopup 头像描边 / DevEnterScreen 提示文字与确认按钮底 三处必须取 design-token 档,
// 不得回潮为字面量 hex(#BFBEFF / #B0AEFA / #CFCEFF 是退役前的旧 Uniapp 紫)。
// 取材为源码静态断言(不 import RN 组件,避开共享工作区在飞的 RN mock 依赖)。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { rnLightTokens } from '@ihui/design-tokens'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8')

const INTRODUCE_POPUP = 'apps/mobile-rn/src/components/IntroducePopup.tsx'
const DEV_ENTER = 'apps/mobile-rn/src/screens/DevEnterScreen.tsx'

describe('RN 紫档硬编码退役(守门 218 存量 12→10)', () => {
  it('brandAccent 档在 design-tokens 里真实可取(阳性对照:断言的不是空气)', () => {
    expect(rnLightTokens.brandAccent.deep).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(rnLightTokens.brandAccent.DEFAULT).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('IntroducePopup 头像描边取 tokens.brandAccent.deep,旧紫 #BFBEFF 不得回潮', () => {
    const src = read(INTRODUCE_POPUP)
    expect(/borderColor:\s*tokens\.brandAccent\.deep/.test(src)).toBe(true)
    expect(/#BFBEFF/i.test(src)).toBe(false)
  })

  it('DevEnterScreen 提示文字/确认按钮底取 brandAccent 档,旧紫 #B0AEFA/#CFCEFF 不得回潮', () => {
    const src = read(DEV_ENTER)
    expect(/promptContent:[\s\S]*?color:\s*tokens\.brandAccent\.deep/.test(src)).toBe(true)
    expect(/promptConfirm:[\s\S]*?backgroundColor:\s*tokens\.brandAccent\.DEFAULT/.test(src)).toBe(
      true,
    )
    expect(/#B0AEFA/i.test(src)).toBe(false)
    expect(/#CFCEFF/i.test(src)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
