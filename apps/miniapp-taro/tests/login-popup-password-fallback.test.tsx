// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 登录弹窗里的「账号密码兜底」这一格(2026-10-23 机主定档:小程序不该有登录页,
 * 账号密码是微信手机号一键验证拿不到时的退路,必须住在弹窗里)。
 *
 * 两条判据,各配一个"已知应命中"的正例,免得"没渲染"和"渲染不出来"同色:
 *  ① 组件面:不传回调 ⇒ 一行都不多;传了 ⇒ 只出收起态入口,不提前摊开两个字段。
 *  ② 样式面:字段样式全仓只住 app.css 一份,登录页私有表里不得再有第二份定义。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 端内 vitest 是 environment:'node' 且没有 jsdom:`@tarojs/components` 的传递依赖带构建期
 * 全局(`ENABLE_INNER_HTML`),真 import 会在收集期就炸(同仓 login-thirdparty-entries.test.tsx
 * 的既有处置)。这里按同一套桩法把 Taro 原语换成"记录 props 的裸元素"。
 */
vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Stub = (props: { children?: ReactNode; [k: string]: unknown }) =>
      createElement(tag, { 'data-props': JSON.stringify(Object.keys(props)) }, props.children)
    Stub.displayName = `Taro${tag}`
    return Stub
  }
  return { View: make('div'), Text: make('span'), Image: make('img'), Button: make('button') }
})
vi.mock('@tarojs/taro', () => ({
  default: { navigateTo: vi.fn(), showToast: vi.fn(), login: vi.fn() },
  navigateTo: vi.fn(),
  showToast: vi.fn(),
  login: vi.fn(),
}))
vi.mock('@/i18n', () => ({
  useTt: () => (_k: string, fb: string) => fb,
  t: (_k: string) => '',
}))
vi.mock('@/components/FocusField', () => {
  const FocusInput = (props: Record<string, unknown>) =>
    createElement('input', { 'data-placeholder': props.placeholder as string })
  FocusInput.displayName = 'FocusInputStub'
  return {
    FocusInput,
    useFieldFocus: () => ({ spread: {}, focusStyle: undefined }),
  }
})

import LoginPopUp from '../src/components/LoginPopUp'

const FIELD_CLASSES = ['.login-field', '.login-label', '.login-input'] as const

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(LoginPopUp as never, { visible: true, ...props } as never))

describe('LoginPopUp 的账号密码兜底', () => {
  it('只传一键登录回调时,弹窗里不出现「密码登录」这一格(默认零增量)', () => {
    const html = render({ onOneClickLogin: async () => {} })
    expect(html).toContain('微信一键登录')
    expect(html).not.toContain('密码登录')
  })

  it('传了回调才出现入口,且默认收起 —— 不提前摊开两个输入框', () => {
    const html = render({
      onOneClickLogin: async () => {},
      onPasswordLogin: async () => {},
    })
    expect(html).toContain('密码登录')
    // 收起态不该有账号输入框的占位文案(展开后才出)
    expect(html).not.toContain('手机号 / 邮箱 / 账号')
  })

  it('正向对照:占位文案确实会随展开出现(证明上一条不是判据失明)', () => {
    // 直接查源码面:占位串住在组件里,只有 pwdOpen 分支能拿到它
    const src = readFileSync(
      resolve(__dirname, '../src/components/LoginPopUp.tsx'),
      'utf8',
    ) as unknown as string
    expect(src).toContain('手机号 / 邮箱 / 账号')
    expect(src).toMatch(/pwdOpen \?/)
  })
})

describe('登录字段样式全仓只住一份', () => {
  const appCss = readFileSync(resolve(__dirname, '../src/app.css'), 'utf8') as unknown as string
  const pageCss = readFileSync(
    resolve(__dirname, '../src/pages/login/login.css'),
    'utf8',
  ) as unknown as string

  it('app.css 里确实定义了这三个类(正例:没有"两处都没有"的假绿)', () => {
    for (const cls of FIELD_CLASSES) {
      expect(appCss).toContain(`\n${cls} {`)
    }
  })

  it.each(FIELD_CLASSES)('%s 不得在登录页私有表里再定义一份', (cls) => {
    // 页面里 `.login-phone-row .login-input` 这类**复合**选择器是覆盖,不算第二份定义
    const ownDefinition = new RegExp(`\\n\\${cls.replace('.', '\\.')} \\{`).test(pageCss)
    expect(ownDefinition).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
