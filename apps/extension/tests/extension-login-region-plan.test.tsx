// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * 扩展端登录地区判据接线锁(票 L28754,2026-10-27 立)
 *
 * 三族判据,缺一族就是"造好没装车":
 *   A. `pickServerLoginRegion` 的四档答复 —— domestic/overseas 之外的任何形态(脏值、国名、
 *      大小写变体、缺键、success=false、抛异常)一律 `null`。猜了某一侧就会给出错误的排法,
 *      而界面看起来完全正常(§0.3)。
 *   B. hook 端到端 —— 服务器档压过界面语言档;判不出才回落 locale;同一进程只打一次
 *      oauth-status;主推平台不可用时 featured 必须落 undefined(不是硬留一个死入口)。
 *   C. 两个登录页真的把 plan 的三项喂给了共享 LoginForm。
 *
 * §22c:排序判据走被测模块与 `@ihui/ui-react`(planLoginRegion 本尊),测试里不复制
 * 第二份"谁排第一";只 mock 网络出口 `@ihui/api-client`。
 */
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { ApiResult } from '@ihui/types'
import type { OAuthStatus } from '@ihui/api-client'
import type { ThirdPartyPlatform, ThirdPartyProvider } from '@ihui/ui-react'

import { I18nProvider } from '../src/i18n'
import {
  __test__ as loginPlanTest,
  loadServerLoginRegion,
  pickServerLoginRegion,
  useExtensionLoginPlan,
} from '../src/hooks/use-extension-login-plan'

/** 服务器答复夹具:'FAIL' = 网络层抛异常,其余当作 success=true 的响应体 */
const serverRef = { current: null as Record<string, unknown> | 'FAIL' | null }
const statusCallCounts: number[] = []
const mountedRoots: Root[] = []
let seen: ReturnType<typeof useExtensionLoginPlan>[] = []

vi.mock('@ihui/api-client', () => ({
  getOAuthStatus: async () => {
    statusCallCounts.push(1)
    const body = serverRef.current
    if (body === 'FAIL') throw new Error('network down')
    return { success: true, data: { wechat: true, google: true, ...body } as OAuthStatus }
  },
}))

// React 19 的 act 需要显式声明测试环境,否则不排空更新队列
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const PROVIDER_KEYS: ThirdPartyPlatform[] = [
  'wechat',
  'google',
  'github',
  'feishu',
  'dingtalk',
  'enterpriseWechat',
  'alipay',
  'apple',
]

/** 与 useExtensionThirdPartyAuth 注入的那一份同形:apple 未上线 ⇒ 强制禁用 */
const FULL_PROVIDERS: ThirdPartyProvider[] = PROVIDER_KEYS.map((key) => ({
  key,
  label: key,
  icon: null,
  enabled: key !== 'apple',
  forceDisabled: key === 'apple',
}))

function okWith(loginRegion: unknown): ApiResult<OAuthStatus> {
  return { success: true, data: { loginRegion } as OAuthStatus }
}

describe('A · pickServerLoginRegion 四档答复', () => {
  it('服务器判 domestic / overseas ⇒ 原样交回', () => {
    expect(pickServerLoginRegion(okWith('domestic'))).toBe('domestic')
    expect(pickServerLoginRegion(okWith('overseas'))).toBe('overseas')
  })

  it('显式 null / 缺键 / 脏值 / success=false ⇒ null(不猜方向)', () => {
    expect(pickServerLoginRegion(okWith(null))).toBeNull()
    expect(pickServerLoginRegion(okWith(undefined))).toBeNull()
    expect(pickServerLoginRegion({ success: false, error: 'boom' })).toBeNull()
    for (const bad of ['CN', 'CHINA', 'Domestic', '', 'overseas '] as const) {
      expect(pickServerLoginRegion(okWith(bad)), `脏值 ${JSON.stringify(bad)}`).toBeNull()
    }
  })
})

function Probe({ providers }: { providers: ThirdPartyProvider[] }) {
  const result = useExtensionLoginPlan(providers)
  useEffect(() => {
    seen.push(result)
  })
  return null
}

async function mountAndFlush(providers = FULL_PROVIDERS): Promise<void> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  await act(async () => {
    root.render(
      <I18nProvider>
        <Probe providers={providers} />
      </I18nProvider>,
    )
  })
  // I18nProvider 的 locale 是异步读存储后才落到 state 的,再排一次队列
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function lastPlan(): NonNullable<(typeof seen)[number]>['plan'] {
  const entry = seen.at(-1)
  if (!entry) throw new Error('探针一次都没提交 ⇒ 判据没跑起来')
  return entry.plan
}

beforeEach(() => {
  loginPlanTest.resetLoginRegionCache()
  serverRef.current = null
  statusCallCounts.length = 0
  seen = []
  localStorage.removeItem('ihui_locale')
})

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    void act(() => root.unmount())
  }
  document.body.innerHTML = ''
})

describe('B · useExtensionLoginPlan 端到端', () => {
  it('IP 判 domestic(界面语言 zh-CN)⇒ 扫码 tab 第一、微信主推', async () => {
    serverRef.current = { loginRegion: 'domestic' }
    await mountAndFlush()
    expect(lastPlan().tabs).toEqual(['qr', 'phone', 'email', 'password'])
    expect(lastPlan().featuredPlatform).toBe('wechat')
    expect(lastPlan().priorityPlatforms.slice(0, 2)).toEqual(['wechat', 'enterpriseWechat'])
  })

  it('IP 判 overseas ⇒ 压过中文界面:邮箱第一、手机号不开放、Google 主推', async () => {
    serverRef.current = { loginRegion: 'overseas' }
    await mountAndFlush()
    expect(lastPlan().region).toBe('overseas')
    expect(lastPlan().tabs).toEqual(['email', 'password', 'qr'])
    expect(lastPlan().featuredPlatform).toBe('google')
  })

  it('IP 判不出(null)+ 界面语言 zh-CN ⇒ 回落国内档', async () => {
    serverRef.current = { loginRegion: null }
    await mountAndFlush()
    expect(lastPlan().region).toBe('domestic')
    expect(lastPlan().tabs.at(0)).toBe('qr')
  })

  it('IP 判不出 + 界面语言 en ⇒ 回落海外档', async () => {
    localStorage.setItem('ihui_locale', 'en')
    serverRef.current = { loginRegion: null }
    await mountAndFlush()
    expect(lastPlan().region).toBe('overseas')
  })

  it('端点抛异常 ⇒ 按未判定回落界面语言,绝不静默选一侧', async () => {
    localStorage.setItem('ihui_locale', 'ja')
    serverRef.current = 'FAIL'
    await mountAndFlush()
    expect(lastPlan().region).toBe('overseas')
    expect(await loadServerLoginRegion()).toBeNull()
  })

  it('主推平台不可用 ⇒ featured 落 undefined(不留点了必挂的整行大按钮)', async () => {
    serverRef.current = { loginRegion: 'overseas' }
    const noGoogle = FULL_PROVIDERS.map((p) => (p.key === 'google' ? { ...p, enabled: false } : p))
    await mountAndFlush(noGoogle)
    expect(lastPlan().featuredPlatform).toBeUndefined()
    expect(lastPlan().tabs).toEqual(['email', 'password', 'qr'])
  })

  it('反向断言:同进程两处消费只打一次 oauth-status', async () => {
    serverRef.current = { loginRegion: 'domestic' }
    await mountAndFlush()
    await mountAndFlush()
    expect(statusCallCounts.length).toBe(1)
  })
})

describe('C · 两个登录页确实装车', () => {
  const pages: Record<string, string> = {
    popup: '../entrypoints/popup/App.tsx',
    sidepanel: '../entrypoints/sidepanel/pages/LoginPage.tsx',
  }

  for (const [name, rel] of Object.entries(pages)) {
    it(`${name} 页把 plan 的 tabs / 主推 / 网格优先序交给共享 LoginForm`, () => {
      const source = readFileSync(new URL(rel, import.meta.url), 'utf8')
      expect(source, `${name}: 未取数`).toContain('useExtensionLoginPlan(')
      expect(source, `${name}: tab 顺序没走判据`).toContain('tabs={loginPlan.plan.tabs}')
      expect(source, `${name}: 主推平台没走判据`).toContain(
        'thirdPartyFeaturedPlatform={loginPlan.plan.featuredPlatform}',
      )
      expect(source, `${name}: 图标网格优先序没走判据`).toContain(
        'thirdPartyPriorityPlatforms={loginPlan.plan.priorityPlatforms}',
      )
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
