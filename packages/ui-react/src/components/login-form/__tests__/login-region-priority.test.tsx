// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LoginForm } from '../login-form'
import { sortByPlatformPriority } from '../third-party-login-buttons'
import { planLoginRegion, resolveLoginRegion } from '../region-policy'
import type {
  LoginApiClient,
  LoginTab,
  ThirdPartyConfig,
  ThirdPartyPlatform,
  ThirdPartyProvider,
} from '../types'

/**
 * 地区→登录方式优先级(2026-10-27 立)。
 *
 * 需求原话:国内 IP ⇒ 微信扫码登录最优先显示;国外 IP ⇒ 邮箱登录 + Google/GitHub
 * 三方登录最优先显示。本文件把这条需求钉成三件事,缺一都算没落地:
 *   1. 判据(谁排第一、剔谁、主推谁) —— 纯函数档;
 *   2. 渲染(顺序真的按数组走,不再硬编码) —— DOM 档;
 *   3. 异步(地区判据晚于首帧到达时,选中项跟着新首位挪,但不得覆盖用户已做的手动切换)。
 * 每一档都有"摘掉新逻辑即翻红"的反向断言(成对夹具),防止判据写对而接线漏掉。
 */

const roots: ReturnType<typeof createRoot>[] = []

// React 19 要求显式声明 act 环境,否则每次 React.act 都往 stderr 刷一条警告。
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

interface Harness {
  host: HTMLElement
  rerender: (node: React.ReactElement) => void
}

function renderForm(node: React.ReactElement): Harness {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push(root)
  React.act(() => {
    root.render(node)
  })
  return {
    host,
    rerender: (next) => {
      React.act(() => {
        root.render(next)
      })
    },
  }
}

const t = (key: string): string => key

const apiClient: LoginApiClient = {
  loginByAccount: async () => ({ success: false, error: 'unused' }),
  loginByEmailCode: async () => ({ success: false, error: 'unused' }),
  loginBySms: async () => ({ success: false, error: 'unused' }),
  sendEmailCode: async () => ({ success: true, data: { sent: true } }),
  sendSmsCode: async () => ({ success: true, data: { sent: true } }),
}

/** 只渲染 tab 头与表单主体,第三方区/协议关掉,避免把 OAuth 与 Dialog 的副作用卷进来。 */
function form(props: { tabs?: LoginTab[]; defaultTab?: LoginTab }): React.ReactElement {
  return (
    <LoginForm
      t={t}
      apiClient={apiClient}
      canAutoSubmitCredentials={() => false}
      showThirdParty={false}
      showAgreement={false}
      showRegisterLink={false}
      tabs={props.tabs}
      defaultTab={props.defaultTab}
    />
  )
}

function tabOrder(host: HTMLElement): string[] {
  return Array.from(host.querySelectorAll('[data-testid^="login-tab-"]')).map(
    (el) => el.getAttribute('data-testid') ?? '',
  )
}

function activeTabTestId(host: HTMLElement): string | null {
  return (
    host
      .querySelector('[data-state="active"][data-testid^="login-tab-"]')
      ?.getAttribute('data-testid') ?? null
  )
}

/* ── 判据档 ──────────────────────────────────────────────────────────────── */

describe('resolveLoginRegion — IP 优先、locale 兜底', () => {
  it('服务器判出 domestic 时,即便界面是英文也按国内算(IP 压过 locale)', () => {
    expect(resolveLoginRegion({ ipRegion: 'domestic', locale: 'en' })).toBe('domestic')
  })

  it('服务器判出 overseas 时,即便界面是中文也按海外算', () => {
    expect(resolveLoginRegion({ ipRegion: 'overseas', locale: 'zh-CN' })).toBe('overseas')
  })

  it('未判定(null/undefined)才回落 locale:zh-CN⇒国内,其余⇒海外', () => {
    expect(resolveLoginRegion({ ipRegion: null, locale: 'zh-CN' })).toBe('domestic')
    expect(resolveLoginRegion({ ipRegion: undefined, locale: 'ja' })).toBe('overseas')
  })
})

describe('planLoginRegion — 国内', () => {
  it('扫码排第一、微信为主推、微信在网格优先序首位', () => {
    const plan = planLoginRegion({ ipRegion: 'domestic', locale: 'en' })
    expect(plan.tabs[0]).toBe('qr')
    expect(plan.tabs).toEqual(['qr', 'phone', 'email', 'password'])
    expect(plan.featuredPlatform).toBe('wechat')
    expect(plan.priorityPlatforms[0]).toBe('wechat')
  })

  it('微信未配置时不主推(避免一排下去就失败的整行大按钮)', () => {
    const plan = planLoginRegion({
      ipRegion: 'domestic',
      locale: 'zh-CN',
      isPlatformAvailable: (p) => p !== 'wechat',
    })
    expect(plan.featuredPlatform).toBeUndefined()
  })

  it('调用方没开放扫码(移动全屏 tabs 三项)时不擅自塞进 qr', () => {
    const plan = planLoginRegion({
      ipRegion: 'domestic',
      locale: 'zh-CN',
      requestedTabs: ['email', 'phone', 'password'],
    })
    expect(plan.tabs).not.toContain('qr')
    expect(plan.tabs).toEqual(['phone', 'email', 'password'])
  })
})

describe('planLoginRegion — 海外', () => {
  it('邮箱第一、手机号整体不开放、Google 主推、GitHub 紧随其后', () => {
    const plan = planLoginRegion({ ipRegion: 'overseas', locale: 'zh-CN' })
    expect(plan.tabs).toEqual(['email', 'password', 'qr'])
    expect(plan.tabs).not.toContain('phone')
    expect(plan.featuredPlatform).toBe('google')
    expect(plan.priorityPlatforms.slice(0, 2)).toEqual(['google', 'github'])
  })

  it('Google 未配置时不主推,但优先序仍把 Google/GitHub 摆在前面', () => {
    const plan = planLoginRegion({
      ipRegion: 'overseas',
      locale: 'en',
      isPlatformAvailable: (p) => p !== 'google',
    })
    expect(plan.featuredPlatform).toBeUndefined()
    expect(plan.priorityPlatforms[0]).toBe('google')
  })

  it('只传 phone 时兜底不为空列表(空列表会让表单整体消失)', () => {
    const plan = planLoginRegion({
      ipRegion: 'overseas',
      locale: 'en',
      requestedTabs: ['phone'],
    })
    expect(plan.tabs.length).toBeGreaterThan(0)
    expect(plan.tabs[0]).toBe('email')
  })
})

describe('sortByPlatformPriority — 表外平台不丢', () => {
  const providers = (keys: ThirdPartyPlatform[]) =>
    keys.map((key) => ({ key, label: key, icon: null, enabled: true }))

  it('按优先序重排,未列名的保持原相对顺序排在后面', () => {
    const sorted = sortByPlatformPriority(providers(['wechat', 'google', 'feishu', 'github']), [
      'google',
      'github',
    ])
    expect(sorted.map((p) => p.key)).toEqual(['google', 'github', 'wechat', 'feishu'])
  })

  it('反向断言:优先序为空数组时顺序一个都不动(排序不是"没给表就乱排")', () => {
    const sorted = sortByPlatformPriority(providers(['wechat', 'google', 'github']), [])
    expect(sorted.map((p) => p.key)).toEqual(['wechat', 'google', 'github'])
  })

  it('同一条执行器也服务扫码渠道列表(不为第二处另写一份排序)', () => {
    const panels = [
      { key: 'app' as const, labelKey: 'a', icon: null, webUrl: '/' },
      { key: 'wechat' as const, labelKey: 'w', icon: null, webUrl: '/' },
      { key: 'feishu' as const, labelKey: 'f', icon: null, webUrl: '/' },
    ]
    expect(sortByPlatformPriority(panels, ['wechat']).map((p) => p.key)).toEqual([
      'wechat',
      'app',
      'feishu',
    ])
    expect(sortByPlatformPriority(panels, []).map((p) => p.key)).toEqual([
      'app',
      'wechat',
      'feishu',
    ])
  })
})

describe('planLoginRegion — 扫码 tab 内部渠道序', () => {
  it('国内档首位是微信;"微信扫码最优先"要连进 tab 之后第一屏也算', () => {
    expect(planLoginRegion({ ipRegion: 'domestic', locale: 'zh-CN' }).qrPlatformPriority[0]).toBe(
      'wechat',
    )
    // IP 判不出时随 locale 走:中文⇒国内档⇒仍然微信第一
    expect(planLoginRegion({ ipRegion: null, locale: 'zh-CN' }).qrPlatformPriority[0]).toBe(
      'wechat',
    )
  })

  it('海外档给空表 = 一个都不重排(判据不越权改调用方的渠道序)', () => {
    expect(planLoginRegion({ ipRegion: 'overseas', locale: 'en' }).qrPlatformPriority).toEqual([])
  })
})

/* ── 渲染档:顺序真的跟着 tabs 数组走 ────────────────────────────────────── */

describe('LoginForm — tab 渲染顺序', () => {
  it('国内首位是扫码;摘掉"按数组顺序渲染"这行即翻红(不再是硬编码 email→phone→password→qr)', () => {
    const { host } = renderForm(form({ tabs: ['qr', 'phone', 'email', 'password'] }))
    expect(tabOrder(host)).toEqual([
      'login-tab-qr',
      'login-tab-phone',
      'login-tab-email',
      'login-tab-password',
    ])
  })

  it('同一组 tab 换个数组顺序,DOM 顺序跟着变(证明组件不自带顺序)', () => {
    const { host } = renderForm(form({ tabs: ['email', 'password', 'qr'] }))
    expect(tabOrder(host)).toEqual(['login-tab-email', 'login-tab-password', 'login-tab-qr'])
  })

  it('表外脏键不渲染成空白 tab,列宽网格也不为它留一格', () => {
    const { host } = renderForm(form({ tabs: ['email', 'nope' as LoginTab, 'password'] }))
    expect(tabOrder(host)).toEqual(['login-tab-email', 'login-tab-password'])
    const list = host.querySelector('[role="tablist"]')
    expect(list?.getAttribute('style')).toContain('repeat(2,')
  })
})

/* ── 透传档:优先序真的从 LoginForm 走到了网格 ───────────────────────────── */

describe('LoginForm — 第三方网格优先序透传', () => {
  const providers = (keys: ThirdPartyPlatform[]): ThirdPartyProvider[] =>
    keys.map((key) => ({ key, label: key, icon: null, enabled: true }))

  function config(keys: ThirdPartyPlatform[]): ThirdPartyConfig {
    return { providers: providers(keys), currentPlatform: null, onLogin: () => {} }
  }

  function gridOrder(host: HTMLElement): string[] {
    return Array.from(host.querySelectorAll('[data-testid^="third-party-"]')).map(
      (el) => el.getAttribute('data-testid') ?? '',
    )
  }

  it('thirdPartyPriorityPlatforms 传到网格:海外把 Google/GitHub 提到微信之前', () => {
    const { host } = renderForm(
      <LoginForm
        t={t}
        apiClient={apiClient}
        canAutoSubmitCredentials={() => false}
        showAgreement={false}
        showRegisterLink={false}
        tabs={['email', 'password']}
        thirdParty={config(['wechat', 'google', 'github'])}
        thirdPartyPriorityPlatforms={['google', 'github']}
      />,
    )
    expect(gridOrder(host)).toEqual([
      'third-party-google',
      'third-party-github',
      'third-party-wechat',
    ])
  })

  it('反向断言:不传优先序时一个都不动(证明上一条的红来自判据,不是组件自己乱排)', () => {
    const { host } = renderForm(
      <LoginForm
        t={t}
        apiClient={apiClient}
        canAutoSubmitCredentials={() => false}
        showAgreement={false}
        showRegisterLink={false}
        tabs={['email', 'password']}
        thirdParty={config(['wechat', 'google', 'github'])}
      />,
    )
    expect(gridOrder(host)).toEqual([
      'third-party-wechat',
      'third-party-google',
      'third-party-github',
    ])
  })

  it('主推平台从网格里摘出去(整行大按钮与图标格不重复同一个入口)', () => {
    const { host } = renderForm(
      <LoginForm
        t={t}
        apiClient={apiClient}
        canAutoSubmitCredentials={() => false}
        showAgreement={false}
        showRegisterLink={false}
        tabs={['email', 'password']}
        thirdParty={config(['wechat', 'google', 'github'])}
        thirdPartyFeaturedPlatform="google"
        thirdPartyPriorityPlatforms={['google', 'github']}
      />,
    )
    expect(
      host.querySelector('[data-testid="third-party-featured-google"]'),
      'Google 应渲染为整行主推大按钮',
    ).not.toBeNull()
    const grid = Array.from(host.querySelectorAll('[data-testid^="third-party-"]')).filter(
      (el) => !(el.getAttribute('data-testid') ?? '').startsWith('third-party-featured-'),
    )
    expect(grid.map((el) => el.getAttribute('data-testid'))).toEqual([
      'third-party-github',
      'third-party-wechat',
    ])
  })
})

/* ── 异步档:地区晚于首帧到达 ────────────────────────────────────────────── */

describe('LoginForm — 地区判据晚到时的选中项', () => {
  it('用户没手动切过时,选中项跟着新首位挪', () => {
    const { host, rerender } = renderForm(form({ tabs: ['email', 'password'] }))
    expect(activeTabTestId(host)).toBe('login-tab-email')

    rerender(form({ tabs: ['password', 'email'] }))
    expect(activeTabTestId(host)).toBe('login-tab-password')
  })

  it('用户手动切过之后不再被判据挪走(先证明点击真的改变了选中项)', () => {
    const { host, rerender } = renderForm(form({ tabs: ['email', 'password'] }))
    const passwordTrigger = host.querySelector<HTMLElement>('[data-testid="login-tab-password"]')
    expect(passwordTrigger, '必须渲染 password tab').not.toBeNull()
    // 前置断言:点击确实生效 —— 否则下面那条"没被挪走"会因为点击根本没工作而假绿。
    // Radix TabsTrigger 在 **mousedown**(button===0 且非 ctrl)上切换 value,不监听 click;
    // 派发错事件类型会静默无效,所以这里必须用 mousedown,并由下一行断言它真的改变了选中项。
    React.act(() => {
      passwordTrigger?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    })
    expect(activeTabTestId(host)).toBe('login-tab-password')

    rerender(form({ tabs: ['email', 'password'] }))
    expect(activeTabTestId(host)).toBe('login-tab-password')
  })

  it('调用方显式传了 defaultTab 时,首位变化不覆盖它', () => {
    const { host, rerender } = renderForm(
      form({ tabs: ['password', 'email'], defaultTab: 'email' }),
    )
    expect(activeTabTestId(host)).toBe('login-tab-email')

    rerender(form({ tabs: ['qr', 'password', 'email'], defaultTab: 'email' }))
    expect(activeTabTestId(host)).toBe('login-tab-email')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
