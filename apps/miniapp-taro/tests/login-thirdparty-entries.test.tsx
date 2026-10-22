// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 登录页「假入口 / 误导入口」锁(§7 删除三问的可执行化)
 *
 * 立因(2026-10-22 实测,逐条读码):
 *  1. `handleSsoLogin` 只做 `Taro.navigateTo('/pages/webview/index…')`,给 web 侧的
 *     redirectUri 是 `ihui-miniapp://sso/callback`;而 `pages/webview/index.tsx` 的
 *     message handler 只有 `logger.info` ⇒ 从这条路进去拿不回登录态 = 死路。
 *  2. 挂着 `google.svg` 的图标格 onClick 就是这个 `handleSsoLogin`;全 `src` grep
 *     Google OAuth 实现命中 0 条 ⇒ 它宣称的能力从来不存在 = 假入口。
 *  3. H5 点「微信登录」的 else 分支同样导到那条死路 = 误导入口。
 *
 * 本文件只锁「不需要真机就能验证正确性」的两格(完整网页登录闭环另票)。
 * 取材:react-dom/server 静态渲染 + 打桩组件把渲染期的 props 记下来,
 * 再从记录里取 onClick 直接调用 —— 端内 vitest 是 environment:'node'(无 jsdom,
 * 且 package.json 不在本票可改面内),这是不动依赖就能触发 handlers 的唯一形态。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import msgsZhCN from '@ihui/i18n/messages/miniapp-taro/zh-CN.json'
import msgsZhTW from '@ihui/i18n/messages/miniapp-taro/zh-TW.json'
import msgsEn from '@ihui/i18n/messages/miniapp-taro/en.json'
import msgsJa from '@ihui/i18n/messages/miniapp-taro/ja.json'
import msgsKo from '@ihui/i18n/messages/miniapp-taro/ko.json'

type StubProps = { className?: string; children?: ReactNode; [key: string]: unknown }

const { nodes, taroMock } = vi.hoisted(() => ({
  nodes: [] as Array<{ kind: string; props: StubProps }>,
  taroMock: {
    navigateTo: vi.fn(),
    showToast: vi.fn(),
    showModal: vi.fn(),
    reLaunch: vi.fn(),
    getStorageSync: (_key: string) => '',
    setStorageSync: (_key: string, _val: unknown) => {},
    removeStorageSync: (_key: string) => {},
    getEnv: () => 'weapp',
    ENV_TYPE: { WEAPP: 'weapp', WEB: 'web', H5: 'h5', RN: 'rn', ALIPAY: 'alipay' },
  },
}))

/**
 * 打桩 @tarojs/components:每个元素把完整 props 记进 nodes,再落成一个只保留
 * className 的 div —— 其余 Taro 专有 prop(hoverClass / mode / maxlength / password…)
 * 透给真实 DOM 元素只会换来 React 噪声告警,而断言读的是 nodes 记录,不读 HTML。
 */
vi.mock('@tarojs/components', () => {
  const make = (kind: string) => {
    const Comp = (props: StubProps) => {
      nodes.push({ kind, props })
      return createElement('div', { className: props.className }, props.children)
    }
    Comp.displayName = `TaroStub_${kind}`
    return Comp
  }
  const stubs = {
    View: make('View'),
    Text: make('Text'),
    Input: make('Input'),
    Image: make('Image'),
    ScrollView: make('ScrollView'),
    Button: make('Button'),
  }
  return { ...stubs, default: stubs }
})

vi.mock('@tarojs/taro', () => ({ ...taroMock, default: taroMock }))

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  useTt: () => (key: string) => key,
}))

vi.mock('@/api', () => ({
  sendSmsCode: vi.fn(),
  sendEmailCode: vi.fn(),
  loginBySms: vi.fn(),
  loginByPassword: vi.fn(),
  loginByEmailCode: vi.fn(),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({ setAuth: vi.fn() }),
}))

vi.mock('@/lib/credential-storage', () => ({
  credentialStorage: {
    loadLoginHistory: () => [],
    saveLoginHistory: vi.fn(),
    removeFromLoginHistory: () => [],
    clearLoginHistory: vi.fn(),
  },
}))

vi.mock('@ihui/shared/hooks', () => ({
  useLoginForm: () => ({
    account: '',
    password: '',
    setAccount: vi.fn(),
    setPassword: vi.fn(),
    autoLogin: false,
    setAutoLogin: vi.fn(),
    loading: false,
    error: '',
    login: vi.fn(),
  }),
}))

vi.mock('@/components/ThemeRoot', () => ({
  default: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))
vi.mock('@/components/LoginPopUp', () => ({ default: () => createElement('div') }))
vi.mock('@/components/LineIcon', () => ({ default: () => createElement('i') }))
vi.mock('@/components/PhoneAreaCodePicker', () => ({ default: () => createElement('div') }))
vi.mock('@/components/FocusField', () => ({ FocusInput: () => createElement('input') }))
vi.mock('@/components/PasswordVisibilityToggle', () => ({ default: () => createElement('div') }))

import Login from '../src/pages/login/login'

/** 渲染一次登录页并把本次渲染的元素记进 nodes(先清上一轮的记录) */
function renderLogin(): void {
  nodes.length = 0
  renderToStaticMarkup(createElement(Login))
}

function nodesByClass(fragment: string): Array<{ kind: string; props: StubProps }> {
  return nodes.filter((n) => typeof n.props.className === 'string' && n.props.className.includes(fragment))
}

function clickClass(className: string): void {
  const hit = nodesByClass(className)[0]
  if (!hit) throw new Error(`登录页未渲染出 className 含 "${className}" 的元素`)
  const onClick = hit.props.onClick
  if (typeof onClick !== 'function') throw new Error(`"${className}" 没有挂 onClick`)
  ;(onClick as () => void)()
}

const originalTaroEnv = process.env.TARO_ENV

describe('登录页假入口/误导入口(§7 三问的可执行锁)', () => {
  beforeEach(() => {
    nodes.length = 0
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env.TARO_ENV = originalTaroEnv
  })

  describe('A. Google 图标格 = 假入口,必须摘除', () => {
    it('不存在挂着 Google 图标的假入口(既无 oauth 图标格,也不引 google 素材)', () => {
      renderLogin()
      expect(nodesByClass('login-oauth-btn')).toHaveLength(0)
      expect(nodesByClass('login-oauth-grid')).toHaveLength(0)
      const imageSrcs = nodes.filter((n) => n.kind === 'Image').map((n) => String(n.props.src ?? ''))
      expect(imageSrcs.filter((src) => src.includes('google'))).toHaveLength(0)
    })

    it('正向对照:摘除 Google 没把微信主入口与网页授权入口一起带走', () => {
      renderLogin()
      expect(nodesByClass('login-wechat-btn')).toHaveLength(1)
      expect(nodesByClass('login-sso-btn')).toHaveLength(1)
    })
  })

  describe('B. H5 微信失败 fallback 不得指向死路', () => {
    it('H5 点微信入口不再 navigateTo 进 webview(那条路无人接管回调)', () => {
      process.env.TARO_ENV = 'h5'
      renderLogin()
      clickClass('login-wechat-btn')
      expect(taroMock.navigateTo).not.toHaveBeenCalled()
    })

    it('H5 点微信入口改为如实提示失败与下一步', () => {
      process.env.TARO_ENV = 'h5'
      renderLogin()
      clickClass('login-wechat-btn')
      expect(taroMock.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'login.wechatUnavailable', icon: 'none' }),
      )
    })

    it('网页授权入口不再静默跳进无人接管回调的 webview', () => {
      renderLogin()
      clickClass('login-sso-btn')
      expect(taroMock.navigateTo).not.toHaveBeenCalled()
    })

    it('网页授权入口给出可见的暂不支持提示(不是空点击)', () => {
      renderLogin()
      clickClass('login-sso-btn')
      expect(taroMock.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'login.ssoLoginTitle',
          content: 'login.ssoUnavailable',
          showCancel: false,
        }),
      )
    })
  })

  describe('文案五语言同批(§19)', () => {
    const packs: Record<string, { login?: Record<string, unknown> }> = {
      'zh-CN': msgsZhCN,
      'zh-TW': msgsZhTW,
      en: msgsEn,
      ja: msgsJa,
      ko: msgsKo,
    }

    it('login.wechatUnavailable 在五种语言里都存在且非空', () => {
      for (const [locale, pack] of Object.entries(packs)) {
        const value = pack.login?.wechatUnavailable
        expect(typeof value, `${locale} 缺 login.wechatUnavailable`).toBe('string')
        expect((value as string).trim().length, `${locale} 的 login.wechatUnavailable 是空串`).toBeGreaterThan(0)
      }
    })

    it('login.ssoUnavailable 在五种语言里都存在且非空(暂不支持提示不是空壳)', () => {
      for (const [locale, pack] of Object.entries(packs)) {
        const value = pack.login?.ssoUnavailable
        expect(typeof value, `${locale} 缺 login.ssoUnavailable`).toBe('string')
        expect((value as string).trim().length, `${locale} 的 login.ssoUnavailable 是空串`).toBeGreaterThan(0)
      }
    })

    it('既有 login.wechatFailed 未被挪用为 H5 提示(两端语义必须分开)', () => {
      renderLogin()
      process.env.TARO_ENV = 'h5'
      clickClass('login-wechat-btn')
      const titles = taroMock.showToast.mock.calls.map((call) => String((call[0] as { title?: unknown })?.title))
      expect(titles).not.toContain('login.wechatFailed')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
