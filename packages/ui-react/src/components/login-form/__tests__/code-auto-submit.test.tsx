// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 验证码"输满 6 位即自动校验登录"(2026-11-23 立)
 *
 * 立因:机主实报"验证码第 6 位输完后还要自己去点登录",且同批要求
 * "两个输入框不得同时显示激活描边"(那条落在 auth-shell.css,不在本文件射程)。
 *
 * 本文件钉四档,任一档翻红即说明自动提交路径退化:
 *   ① 5 位不提交、第 6 位提交一次,且带的是当前账号与完整验证码;
 *   ② 未同意协议 ⇒ 一次都不打接口,只走 onRequireAgree 同一条提示路径;
 *   ③ 输满后补同意 ⇒ 补交一次(协议弹窗关掉即完成登录,不用再点按钮);
 *   ④ 登录失败后改一位再补齐 ⇒ 可重试,且不会原地重复打接口。
 *
 * 夹具沿用同目录 `third-party-agreement-gate.test.tsx`(react-dom/client + React.act,
 * 本包无 @testing-library 依赖);受控输入用原生 value setter + input 事件驱动 onChange。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { CodeLoginForm } from '../code-login-form'
import type { ApiResult, LoginApiClient, LoginResult } from '../types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const t = (key: string) => key

const roots: Root[] = []

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop()
    React.act(() => {
      root?.unmount()
    })
  }
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function render(node: React.ReactElement): Root {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push(root)
  React.act(() => {
    root.render(node)
  })
  return root
}

/** 受控输入:走原型上的原生 setter 再派发 input 事件,React 才能看到变化 */
function type(el: HTMLInputElement | null, value: string) {
  expect(el, '目标输入框必须存在').not.toBeNull()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  React.act(() => {
    setter.call(el, value)
    el!.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function makeClient(overrides: Partial<LoginApiClient> = {}): LoginApiClient {
  return {
    loginByAccount: async () => loginFail(),
    loginByEmailCode: async () => loginFail(),
    loginBySms: async () => loginFail(),
    sendEmailCode: async () => ({ success: false, error: 'unused' }),
    sendSmsCode: async () => ({ success: false, error: 'unused' }),
    ...overrides,
  }
}

/** 判别联合的文字面量必须显式声明,否则 mock 的 `success: boolean` 不满足 ApiResult 约束 */
const loginFail = (error = 'bad'): ApiResult<LoginResult> => ({ success: false, error })
const loginOk = (accessToken = 'tok'): ApiResult<LoginResult> => ({
  success: true,
  data: { accessToken, refreshToken: 'r', expiresIn: 3600, user: { id: 'u1' } },
})

type SmsFn = (phone: string, code: string) => Promise<ApiResult<LoginResult>>
const smsMock = () => vi.fn<SmsFn>(async () => loginFail())
const smsMockOk = () => vi.fn<SmsFn>(async () => loginOk())

const PHONE = '13800138000'

function form(props: {
  apiClient: LoginApiClient
  agreed?: boolean
  onRequireAgree?: () => void
}): React.ReactElement {
  return (
    <CodeLoginForm
      accountType="phone"
      t={t}
      apiClient={props.apiClient}
      agreed={props.agreed ?? true}
      onRequireAgree={props.onRequireAgree}
      onAgreedChange={() => {}}
    />
  )
}

const accountInput = () => document.querySelector('#login-form-phone') as HTMLInputElement
const codeInput = () => document.querySelector('#login-form-phone-code') as HTMLInputElement

/* ── ① 满 6 位自动提交 ─────────────────────────────────────────────────── */

describe('验证码输满 6 位', () => {
  it('5 位不提交,第 6 位自动提交一次且带完整账号与验证码', async () => {
    const loginBySms = smsMock()
    render(form({ apiClient: makeClient({ loginBySms }) }))

    type(accountInput(), PHONE)
    type(codeInput(), '12345')
    expect(loginBySms, '5 位时不得发起登录').not.toHaveBeenCalled()

    await React.act(async () => {
      type(codeInput(), '123456')
    })
    expect(loginBySms, '第 6 位落定即自动提交一次').toHaveBeenCalledTimes(1)
    expect(loginBySms).toHaveBeenCalledWith(PHONE, '123456')
  })

  it('已提交过不再原地重复打接口', async () => {
    const loginBySms = smsMock()
    render(form({ apiClient: makeClient({ loginBySms }) }))

    type(accountInput(), PHONE)
    await React.act(async () => {
      type(codeInput(), '123456')
    })
    await React.act(async () => {
      type(codeInput(), '123456')
    })
    expect(loginBySms, '同一份 6 位码只自动提交一次').toHaveBeenCalledTimes(1)
  })
})

/* ── ② 未同意协议:一次都不打接口 ───────────────────────────────────────── */

describe('未同意协议时输满 6 位', () => {
  it('不发起登录,只走 onRequireAgree 同一条提示路径', async () => {
    const loginBySms = smsMockOk()
    const onRequireAgree = vi.fn()
    render(form({ apiClient: makeClient({ loginBySms }), agreed: false, onRequireAgree }))

    type(accountInput(), PHONE)
    await React.act(async () => {
      type(codeInput(), '123456')
    })

    expect(loginBySms, '未同意时不得发起登录').not.toHaveBeenCalled()
    expect(onRequireAgree, '必须复用主登录按钮的同意提示路径').toHaveBeenCalledTimes(1)
  })
})

/* ── ③ 输满后再同意:补交一次 ───────────────────────────────────────────── */

describe('输满 6 位后才同意协议', () => {
  it('同意那一刻补交一次,不用再点登录', async () => {
    const loginBySms = smsMockOk()
    const onRequireAgree = vi.fn()
    const client = makeClient({ loginBySms })
    const root = render(form({ apiClient: client, agreed: false, onRequireAgree }))

    type(accountInput(), PHONE)
    await React.act(async () => {
      type(codeInput(), '123456')
    })
    expect(loginBySms).not.toHaveBeenCalled()

    await React.act(async () => {
      root.render(form({ apiClient: client, agreed: true, onRequireAgree }))
    })
    expect(loginBySms, '同意后补交一次').toHaveBeenCalledTimes(1)
    expect(loginBySms).toHaveBeenCalledWith(PHONE, '123456')
  })
})

/* ── ④ 失败后可重试 ─────────────────────────────────────────────────────── */

describe('登录失败后', () => {
  it('改一位再补齐可重试,且成功时走 onSuccess', async () => {
    const loginBySms = smsMock().mockResolvedValueOnce(loginFail()).mockResolvedValueOnce(loginOk())
    const onSuccess = vi.fn()
    render(
      <CodeLoginForm
        accountType="phone"
        t={t}
        apiClient={makeClient({ loginBySms })}
        agreed
        onAgreedChange={() => {}}
        onSuccess={onSuccess}
      />,
    )

    type(accountInput(), PHONE)
    await React.act(async () => {
      type(codeInput(), '123456')
    })
    expect(loginBySms).toHaveBeenCalledTimes(1)

    // 删一位(长度掉回 5)⇒ 标记放开;重输满 6 位 ⇒ 再自动试一次
    type(codeInput(), '12345')
    await React.act(async () => {
      type(codeInput(), '654321')
    })

    expect(loginBySms, '改一位再补齐应重试').toHaveBeenCalledTimes(2)
    expect(loginBySms).toHaveBeenLastCalledWith(PHONE, '654321')
    expect(onSuccess, '成功后必须回调 onSuccess').toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
