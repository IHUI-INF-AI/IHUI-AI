// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扫码面板进入即要求协议同意(2026-10-27 台账票「扫码登录路径从不触发协议同意」方案①)
 *
 * 缺陷形态:协议门禁挂在"点提交"上,而扫码 tab 结构上没有提交动作(协议区按 tab!=='qr'
 * 排除),2026-10-27 起国内访客默认首屏就是扫码 —— 整条路径不经过任何"被要求同意"就能
 * 扫码拿 token。
 *
 * 本文件把修复钉成四档,每档都有成对反证(§"摘掉新逻辑即翻红"):
 *   ① notice-dialog 主机以 tab='qr' 挂载 ⇒ 弹窗必须已经在场(主断言);
 *   ② 同一份 props 只改 defaultAgreed=true ⇒ 必须不在场(证明 ① 不是弹窗常开);
 *   ③ 从 email 切入 qr ⇒ 在场;按「不同意」关掉 ⇒ 不自动复弹(骚扰锁);
 *      切走再切回仍未同意 ⇒ 再问一次(票面"进入即触发")。
 *   ④ showAgreement=false 主机 ⇒ 任何 tab 都不代弹(尊重显式关闭,不越权)。
 * 夹具与同包 `agreement-prechecked-default.test.tsx` / `login-region-priority.test.tsx`
 * 同一套:react-dom/client + React.act,happy-dom,无 @testing-library。
 */
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { LoginForm } from '../login-form'
import type { LoginApiClient, LoginTab } from '../types'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const t = (key: string) => key

const apiClient: LoginApiClient = {
  loginByAccount: async () => ({ success: false, error: 'unused' }),
  loginByEmailCode: async () => ({ success: false, error: 'unused' }),
  loginBySms: async () => ({ success: false, error: 'unused' }),
  sendEmailCode: async () => ({ success: false, error: 'unused' }),
  sendSmsCode: async () => ({ success: false, error: 'unused' }),
}

/**
 * Radix Dialog 走 portal,内容挂在 document.body 而不是宿主 div ——
 * 断言一律读 document 面的 testid(读 host 会恒 false,那是夹具缺陷不是被测行为)。
 */
function agreeBtnVisible(): boolean {
  return !!document.querySelector('[data-testid="agreement-notice-agree"]')
}

async function clickTestId(testId: string) {
  const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
  expect(el, `必须存在 [data-testid=${testId}]`).not.toBeNull()
  await React.act(async () => {
    el?.click()
  })
}

const roots: Root[] = []

function renderForm(props: React.ComponentProps<typeof LoginForm>): void {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push(root)
  React.act(() => {
    root.render(<LoginForm {...props} />)
  })
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop()
    React.act(() => {
      root?.unmount()
    })
  }
  document.body.replaceChildren()
})

function baseProps(overrides: Partial<React.ComponentProps<typeof LoginForm>> = {}) {
  return {
    t,
    apiClient,
    canAutoSubmitCredentials: () => false,
    showThirdParty: false,
    showRegisterLink: false,
    tabs: ['email', 'qr'] as LoginTab[],
    ...overrides,
  }
}

describe('① notice-dialog 主机停在扫码面板:必须被要求同意', () => {
  it('以 tab=qr 挂载(国内首屏形态)→ AgreementNoticeDialog 已弹出', async () => {
    renderForm(baseProps({ defaultTab: 'qr' }))
    await React.act(async () => {})
    expect(agreeBtnVisible(), '扫码首屏必须进入即弹协议窗(票面主断言)').toBe(true)
  })
})

describe('② 成对反证:不是"弹窗常开"', () => {
  it('defaultAgreed=true 的主机进扫码 → 不弹', async () => {
    renderForm(baseProps({ defaultTab: 'qr', defaultAgreed: true }))
    await React.act(async () => {})
    expect(agreeBtnVisible(), '已同意主机不得被弹').toBe(false)
  })
})

describe('③ 切入/拒绝/再切入的节拍', () => {
  it('email 起步不弹 → 点扫码 tab 弹 → 不同意关掉不自动复弹 → 切走再切回仍要再问', async () => {
    renderForm(baseProps({ defaultTab: 'email' }))
    await React.act(async () => {})
    expect(agreeBtnVisible(), '非扫码 tab 不得被弹(原有提交门禁管着那条路)').toBe(false)

    await clickTestId('login-tab-qr')
    expect(agreeBtnVisible(), '切入扫码 tab 必须即弹协议窗').toBe(true)

    await clickTestId('agreement-notice-disagree')
    expect(agreeBtnVisible(), '不同意必须能关掉').toBe(false)

    // 同一次停留内不得循环复弹(等一拍 act 冲刷后仍不在场)
    await React.act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(agreeBtnVisible(), '关掉后本次停留内不得自动复弹骚扰').toBe(false)

    await clickTestId('login-tab-email')
    await clickTestId('login-tab-qr')
    expect(agreeBtnVisible(), '重新进入扫码且仍未同意 → 依规再问一次').toBe(true)
  })

  it('点「同意」后:关窗,且再切入永不再弹(agreed 是全表单唯一判据)', async () => {
    renderForm(baseProps({ defaultTab: 'qr' }))
    await React.act(async () => {})
    expect(agreeBtnVisible()).toBe(true)

    await clickTestId('agreement-notice-agree')
    expect(agreeBtnVisible(), '同意后必须关窗').toBe(false)

    await clickTestId('login-tab-email')
    await clickTestId('login-tab-qr')
    expect(agreeBtnVisible(), '已同意后不得再弹').toBe(false)
  })
})

describe('④ showAgreement=false 的主机:任何 tab 都不得代弹', () => {
  it('qr 起步 + showAgreement=false → 不弹(尊重显式关闭协议面)', async () => {
    renderForm(baseProps({ defaultTab: 'qr', showAgreement: false }))
    await React.act(async () => {})
    expect(agreeBtnVisible()).toBe(false)
  })
})
