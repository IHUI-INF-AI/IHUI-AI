// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方登录按钮的协议同意门禁(2026-10-27 立)
 *
 * 立因:服务端通用 OAuth 回调 `POST /api/auth/:platform/callback` 改为 fail-closed
 * —— 发起期必须已在 Redis 落"用户协议同意"记录(绑定 state),否则 403
 * `OAUTH_AGREEMENT_REQUIRED`。而共享 LoginForm 的第三方按钮此前**不受 agreed 约束**,
 * 用户不勾协议点微信/Google 照样跳厂商,回跳时必被 403 挡死。
 *
 * 本文件钉两档,且互为反例:
 *   ① 未勾同意点第三方 ⇒ onLogin 一次都不能调,且出现与主登录按钮同一条的「请先同意」提示
 *      (摘掉门禁这档即翻红:跳厂商照旧发生);
 *   ② 勾选后点第三方 ⇒ onLogin(platform, true),第二参是发起期同意标记,
 *      由调用方透传给 recordOAuthConsent(摘掉透传即翻红)。
 *
 * 渲染走 react-dom/client + React.act,与同目录 `agreement-prechecked-default.test.tsx`
 * 同一套夹具(本包没有 @testing-library 依赖)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { LoginForm } from '../login-form'
import type { LoginApiClient, ThirdPartyConfig } from '../types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/* ── 夹具 ────────────────────────────────────────────────────────────────── */

/** i18n 由调用方注入,这里把 key 原样带回,便于断言"提示走的是哪一条文案" */
const t = (key: string) => key

const apiClient: LoginApiClient = {
  loginByAccount: async () => ({ success: false, error: 'unused' }),
  loginByEmailCode: async () => ({ success: false, error: 'unused' }),
  loginBySms: async () => ({ success: false, error: 'unused' }),
  sendEmailCode: async () => ({ success: false, error: 'unused' }),
  sendSmsCode: async () => ({ success: false, error: 'unused' }),
}

const roots: Root[] = []

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop()
    React.act(() => {
      root?.unmount()
    })
  }
  document.body.replaceChildren()
})

function render(node: React.ReactElement): HTMLElement {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push(root)
  React.act(() => {
    root.render(node)
  })
  return host
}

function click(el: Element | null) {
  expect(el, '目标元素必须存在').not.toBeNull()
  React.act(() => {
    // cancelable 必须为 true:AgreementCheckbox 靠 preventDefault 掐掉 label 的转发,
    // 构造事件的缺省 cancelable=false 会让那一步静默失效。
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
  })
}

function thirdParty(onLogin: ThirdPartyConfig['onLogin']): ThirdPartyConfig {
  return {
    providers: [{ key: 'wechat', label: 'WeChat', icon: null, enabled: true }],
    currentPlatform: null,
    onLogin,
  }
}

/** inline 模式:未同意时的红字提示直接落在 DOM 上,便于断言;弹窗模式走 portal 不在本文件射程 */
function form(onLogin: ThirdPartyConfig['onLogin'], defaultAgreed = false): React.ReactElement {
  return (
    <LoginForm
      t={t}
      apiClient={apiClient}
      canAutoSubmitCredentials={() => false}
      showRegisterLink={false}
      tabs={['email']}
      agreementMode="inline"
      defaultAgreed={defaultAgreed}
      thirdParty={thirdParty(onLogin)}
    />
  )
}

/* ── ① 未同意:按钮仍在,但点击只提示、不发起登录 ───────────────────────── */

describe('未勾选协议时点第三方按钮', () => {
  it('不调用 onLogin,并出现「请先同意」提示(与主登录按钮同一条路径)', () => {
    const onLogin = vi.fn()
    const host = render(form(onLogin))

    const button = host.querySelector('[data-testid="third-party-wechat"]')
    expect(button, '未同意时按钮仍须可见(点后才提示,不改布局)').not.toBeNull()
    click(button)

    expect(onLogin, '未同意时不得发起第三方登录').not.toHaveBeenCalled()
    expect(host.textContent, '必须复用 auth.agreeRequired 提示').toContain('auth.agreeRequired')
  })
})

/* ── ② 已同意:透传 agreementAccepted=true ─────────────────────────────── */

describe('勾选协议后点第三方按钮', () => {
  it('点击复选框后 onLogin(platform, true) 被调用,提示消失', () => {
    const onLogin = vi.fn()
    const host = render(form(onLogin))

    // 复选框有两枚:tab 内表单自带一枚、LoginForm 底部的 inline 一枚,同源于 agreed;
    // 点最靠后那枚(LoginForm 自己的)证明门禁读的是父组件状态。
    const labels = host.querySelectorAll('[data-testid="agreement-checkbox"]')
    expect(labels.length).toBeGreaterThan(1)
    // 取最后一枚(LoginForm 自己那枚),证明门禁读的是父组件的 agreed 状态
    const label = labels[labels.length - 1] as HTMLElement
    const box = label.querySelector('[data-testid="agreement-checkbox-box"]') as HTMLElement
    const input = label.querySelector('input[type="checkbox"]') as HTMLInputElement

    React.act(() => {
      // 点 label 关联的 sr-only input = 用户点勾选框的等价路径。
      // 不走 span.click():happy-dom 的 label 激活不认 preventDefault,会让 input 再被点一次、
      // onChange 连发两次(true→false),净结果回到未勾选 —— 那是宿主实现的偏差,不是用户路径。
      input.click()
    })
    expect(box.getAttribute('aria-checked')).toBe('true')

    click(host.querySelector('[data-testid="third-party-wechat"]'))

    expect(onLogin).toHaveBeenCalledTimes(1)
    expect(onLogin).toHaveBeenCalledWith('wechat', true)
    expect(host.textContent).not.toContain('auth.agreeRequired')
  })

  it('成对反例:defaultAgreed=true 时无需再点复选框,直接放行', () => {
    const onLogin = vi.fn()
    const host = render(form(onLogin, true))

    click(host.querySelector('[data-testid="third-party-wechat"]'))

    expect(onLogin).toHaveBeenCalledWith('wechat', true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
