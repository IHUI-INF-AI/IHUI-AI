// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 登录表单「同意条款」复选框的缺省档(2026-10-03 数据出域合规整改)
 *
 * 缺陷形态:两个对外导出的子组件(`PasswordLoginForm` / `CodeLoginForm`,经
 * `EmailCodeLoginForm` / `PhoneCodeLoginForm` 薄 wrapper 同样可达)把 `agreed` 的
 * **解构缺省**写成了 `true`,而内层 `LoginForm` 的 `defaultAgreed` 是 `false`。
 * 子组件不持有协议 state —— `AgreementCheckbox` 的 `checked` 直接吃这个 prop,
 * 所以那个解构缺省就是"调用方不传 agreed 时初始渲染成什么样"的唯一开关:
 * 任何直接用导出子组件的调用方,拿到的都是"用户已同意隐私政策"。
 *
 * 断言对象是**生产组件真实渲染出的 aria-checked**,不是把缺省值在测试里重抄一遍
 * (那只是复读实现)。渲染走 react-dom/client + React.act,与同包
 * `webview-frame-sandbox.test.tsx` 同一套夹具:本包没有 @testing-library 依赖,
 * 而 react / react-dom 是直接依赖,这两件在本包内可解析。
 *
 * ⚠️ 覆盖面如实声明:happy-dom 只如实实现 DOM 与 aria 属性,不执行 CSS。
 *    "勾上时那个方框真的变蓝了"这一维在本提交链上没有尺子,只能由
 *    `aria-checked` + 生产组件的 className 分支推得。
 */
// @ts-expect-error: packages/ui-react 未安装 vitest(无 vitest.config.ts、package.json 无 test
// script、devDeps 里没有它),所以 'vitest' 的类型不在本包 tsc 视野内;运行期由测试器注入。
// 本包补上 vitest 入口后必须删掉这一行 —— 留着它会让"装了却没人用"重新变成隐形。
import { describe, it, expect, afterEach } from 'vitest'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { PasswordLoginForm } from '../password-login-form'
import { CodeLoginForm } from '../code-login-form'
import { EmailCodeLoginForm } from '../email-code-login-form'
import { PhoneCodeLoginForm } from '../phone-code-login-form'
import type { ApiResult, LoginApiClient, LoginResult } from '../types'

/* React 19 的 act() 要求宿主声明"这是 act 环境",否则每次调用只打一条
   "not configured to support act(...)" 警告并走非确定性的排空路径。 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/* ── 夹具 ────────────────────────────────────────────────────────────────── */

/** i18n 由调用方注入,这里只需把 key 原样带回来,便于失败时看出是哪一条文案 */
const t = (key: string) => key

/**
 * 登录 API 客户端:全部方法都记一手,好让"提交到底有没有真的打出去"可断言。
 * 默认返回失败 —— 本文件从不依赖登录成功,只关心提交**是否被发起**。
 */
function makeApiClient(calls: string[]): LoginApiClient {
  const fail = (name: string) => async (): Promise<ApiResult<LoginResult>> => {
    calls.push(name)
    return { success: false, error: 'not-used-in-this-test' }
  }
  return {
    loginByAccount: async () => {
      calls.push('loginByAccount')
      return { success: false, error: 'not-used-in-this-test' }
    },
    loginByEmailCode: fail('loginByEmailCode'),
    loginBySms: fail('loginBySms'),
    sendEmailCode: async () => ({ success: false, error: 'not-used-in-this-test' }),
    sendSmsCode: async () => ({ success: false, error: 'not-used-in-this-test' }),
  }
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

/** 渲染一个组件并把宿主 div 交回给调用方(用例自己再查 DOM) */
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

/**
 * 协议复选框的勾选态。
 *
 * 读 `role="checkbox"` 那个 span 的 `aria-checked`:它是 AgreementCheckbox 里
 * 真正承载勾选语义的一枚(外层 label 只有点击代理职责,2026-09-22 起不再有 role)。
 * 同时把 sr-only 真实 input 的 `checked` 一起读出来 —— 两者同源于 `checked` prop,
 * 不一致就说明有一处漏了。
 */
function agreementState(host: HTMLElement): { aria: string | null; input: boolean } {
  const box = host.querySelector('[data-testid="agreement-checkbox-box"]')
  expect(box, '必须渲染出 AgreementCheckbox').not.toBeNull()
  const input = host.querySelector<HTMLInputElement>(
    '[data-testid="agreement-checkbox"] input[type="checkbox"]',
  )
  expect(input, 'AgreementCheckbox 必须带 sr-only 真实 input').not.toBeNull()
  return {
    aria: box?.getAttribute('aria-checked') ?? null,
    input: input?.checked ?? false,
  }
}

/** 断言"未勾选":aria 与真实 input 两处都得是未勾(缺省不得只改一处) */
function expectNotPreChecked(host: HTMLElement) {
  const state = agreementState(host)
  expect(state.aria, 'aria-checked 不得为 true —— 缺省必须是"未同意"').toBe('false')
  expect(state.input, '真实 checkbox 的 checked 不得为 true').toBe(false)
}

/** 断言"已勾选":显式传 agreed={true} 的受控通道必须仍然能勾上 */
function expectPreChecked(host: HTMLElement) {
  const state = agreementState(host)
  expect(state.aria, 'aria-checked 应为 true —— 显式传 true 必须仍然生效').toBe('true')
  expect(state.input, '真实 checkbox 的 checked 应为 true').toBe(true)
}

/**
 * 写输入框的值。
 *
 * React 受控 input 不认直接 `el.value = x`(它把 value 记在自己那份 props 上,
 * 下一次渲染会覆回去),必须走原型上的原生 setter,再派发 `input` 事件让 React
 * 的 onChange 真正收到。
 */
function setInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  expect(setter, '拿不到 HTMLInputElement.value 的原生 setter').toBeTruthy()
  React.act(() => {
    setter?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** 触发表单提交(走 form.requestSubmit,与组件内部 Enter 兜底同一条路) */
function submitForm(host: HTMLElement) {
  const form = host.querySelector('form')
  expect(form, '必须渲染出 <form>').not.toBeNull()
  React.act(() => {
    form?.requestSubmit()
  })
}

/* ── ① 缺省不预勾选(本次整改的主断言) ─────────────────────────────────────── */

describe('未传 agreed 时不得预勾选', () => {
  it('PasswordLoginForm:缺省渲染为未同意', () => {
    const host = render(
      <PasswordLoginForm
        t={t}
        apiClient={makeApiClient([])}
        canAutoSubmitCredentials={() => false}
      />,
    )
    expectNotPreChecked(host)
  })

  it('CodeLoginForm(accountType=email):缺省渲染为未同意', () => {
    const host = render(
      <CodeLoginForm accountType="email" t={t} apiClient={makeApiClient([])} />,
    )
    expectNotPreChecked(host)
  })

  it('CodeLoginForm(accountType=phone):缺省渲染为未同意', () => {
    const host = render(
      <CodeLoginForm accountType="phone" t={t} apiClient={makeApiClient([])} />,
    )
    expectNotPreChecked(host)
  })

  // 两个薄 wrapper 是 index.ts 对外真正导出的名字,走 wrapper 也得是同一个缺省档
  it('EmailCodeLoginForm / PhoneCodeLoginForm 薄 wrapper:缺省同样不预勾选', () => {
    const email = render(<EmailCodeLoginForm t={t} apiClient={makeApiClient([])} />)
    expectNotPreChecked(email)
    const phone = render(<PhoneCodeLoginForm t={t} apiClient={makeApiClient([])} />)
    expectNotPreChecked(phone)
  })
})

/* ── ② 显式传 true 仍能勾上(受控通道没被这次整改堵死) ────────────────────── */

describe('显式传 agreed={true} 仍能勾上', () => {
  it('PasswordLoginForm:传 true 即为已同意', () => {
    const host = render(
      <PasswordLoginForm
        t={t}
        apiClient={makeApiClient([])}
        canAutoSubmitCredentials={() => false}
        agreed
      />,
    )
    expectPreChecked(host)
  })

  it('CodeLoginForm:传 true 即为已同意', () => {
    const host = render(
      <CodeLoginForm accountType="email" t={t} apiClient={makeApiClient([])} agreed />,
    )
    expectPreChecked(host)
  })
})

/* ── ③ 缺省为 false 之后,提交门禁是真的拦得住 ────────────────────────────── */

describe('未同意时提交被拦下,且不发起登录请求', () => {
  it('PasswordLoginForm:账密齐全 + 未勾协议 → 走 onRequireAgree,不调 loginByAccount', () => {
    const calls: string[] = []
    const required: string[] = []
    const host = render(
      <PasswordLoginForm
        t={t}
        apiClient={makeApiClient(calls)}
        canAutoSubmitCredentials={() => false}
        onRequireAgree={() => required.push('required')}
      />,
    )
    // 先把账号密码填满 —— 否则"被拦下"可能只是撞上了空账号校验,证明不了协议门禁
    const account = host.querySelector<HTMLInputElement>('[data-testid="login-account-input"]')
    const password = host.querySelector<HTMLInputElement>('[data-testid="login-password-input"]')
    expect(account, '必须有账号输入框').not.toBeNull()
    expect(password, '必须有密码输入框').not.toBeNull()
    setInputValue(account as HTMLInputElement, 'someone@example.com')
    setInputValue(password as HTMLInputElement, 'hunter2-correct-horse')

    submitForm(host)

    expect(required, '未勾协议必须回调 onRequireAgree').toEqual(['required'])
    expect(calls, '门禁拦下时不得发起任何登录请求').toEqual([])
  })

  it('CodeLoginForm:账号与验证码齐全 + 未勾协议 → 走 onRequireAgree,不调 loginByEmailCode', () => {
    const calls: string[] = []
    const required: string[] = []
    const host = render(
      <CodeLoginForm
        accountType="email"
        t={t}
        apiClient={makeApiClient(calls)}
        onRequireAgree={() => required.push('required')}
      />,
    )
    const account = host.querySelector<HTMLInputElement>('[data-testid="login-email-input"]')
    const code = host.querySelector<HTMLInputElement>('[data-testid="login-email-code-input"]')
    expect(account, '必须有邮箱输入框').not.toBeNull()
    expect(code, '必须有验证码输入框').not.toBeNull()
    setInputValue(account as HTMLInputElement, 'someone@example.com')
    setInputValue(code as HTMLInputElement, '123456')

    submitForm(host)

    expect(required, '未勾协议必须回调 onRequireAgree').toEqual(['required'])
    expect(calls, '门禁拦下时不得发起任何登录请求').toEqual([])
  })

  it('勾上协议后同一份表单就能走完校验(证明上一条不是被别的校验挡下的)', () => {
    const calls: string[] = []
    const required: string[] = []
    const host = render(
      <CodeLoginForm
        accountType="email"
        t={t}
        apiClient={makeApiClient(calls)}
        onRequireAgree={() => required.push('required')}
        agreed
      />,
    )
    expectPreChecked(host)
    const account = host.querySelector<HTMLInputElement>('[data-testid="login-email-input"]')
    const code = host.querySelector<HTMLInputElement>('[data-testid="login-email-code-input"]')
    setInputValue(account as HTMLInputElement, 'someone@example.com')
    setInputValue(code as HTMLInputElement, '123456')

    submitForm(host)

    // onSubmit 是 async,act 同步刷完第一轮;这里只看"门禁是否放行"这一维
    expect(required, '已同意时不得再要求同意').toEqual([])
    expect(calls, '已同意且校验齐全时必须真的发起登录请求').toContain('loginByEmailCode')
  })
})
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‍‌‌‌‌‌‌‌‌‌‌‌‍‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‌‌‌‌‍‍‌‌‌‍‌‌‌‍‌‍‍‌‌‍‍**‌‌‌‌‌‌‌‌‌‌‌‌‌‌‌‌‌‍‌‌‌‌‌‌‌‌‍‍‌‌‌‍‍‍‍‍**‌‌‌‌‍‍‌‌‍‍‍‍‍**‌‌‍‌‌‌‍‍‌‌‍‌‌‌‍‍‍‍‌‌‌‌‌‍‌‍‍‍‍‌‍‌‌‌‍‌‌‍‍‌‌‍‌‍‍⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
