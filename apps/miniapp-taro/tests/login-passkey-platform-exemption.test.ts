// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端 Passkey 平台豁免标注锁(G-874,2026-10-25 立)。
 *
 * 票面判据:小程序无 WebAuthn,须按 AGENTS §9 显式标注平台豁免。web 端入口
 * (packages/ui-react login-form)已接,小程序侧不跟着出现 Passkey 入口。
 * 本文件只锁"标注在位"这一格,并配一条阳性对照(抹掉标注的文本必须被判死),
 * 避免"没标注"和"判据失明"同色。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const LOGIN_UI_REL = 'src/components/LoginPopUp.tsx'
const LOGIN_UI_ABS = resolve(__dirname, '..', LOGIN_UI_REL)

/** 与仓内既有措辞同形:voice-recorder.ts 的「平台独占:<差异>」括号式豁免标注。 */
const EXEMPTION = /平台独占[:：]\s*小程序无 WebAuthn/

function hasPasskeyExemption(src: string): boolean {
  return EXEMPTION.test(src)
}

describe('小程序登录组件的 Passkey 平台豁免标注(G-874 / AGENTS §9)', () => {
  const src = readFileSync(LOGIN_UI_ABS, 'utf8')

  it('LoginPopUp 头注显式写明「平台独占:小程序无 WebAuthn」', () => {
    expect(
      hasPasskeyExemption(src),
      '小程序登录组件缺 §9 平台豁免标注:小程序无 WebAuthn,应标注为平台独占',
    ).toBe(true)
  })

  it('阳性对照:抹掉该标注的文本必须被判死(证明上一条不是恒真)', () => {
    const mutated = src.replace(EXEMPTION, '')
    expect(mutated).not.toBe(src)
    expect(hasPasskeyExemption(mutated)).toBe(false)
  })
})
