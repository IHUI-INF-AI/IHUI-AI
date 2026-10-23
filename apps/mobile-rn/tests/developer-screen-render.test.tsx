// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DeveloperScreen 的「跨端单一真相源」自证(§17:UI 改动不能只凭代码审查)。
 *
 * 2026-10-23 现读:三处现状**并不是同一屏**(RN = 开发者空间页;共享层旧版 = 套餐开通订阅页,
 * 该语义已由 `features/dev-enter-cover` 承接;小程序 `pkg-ai/developer/index.tsx` = 我的智能体列表)。
 * 收敛后本套件钉住四件事:
 *  ① RN 那一屏渲染的**就是**共享层 `packages/app/src/features/developer/DeveloperScreen.tsx`
 *     —— 替身按既有纪律转发真身(同一函数对象),而壳里一个 <Text> 都没有、也没有样式表;
 *  ② 四入口与两张问题卡的构成/顺序 = 跨端单一源 `@ihui/shared/constants/developer-space`;
 *  ③ 上屏的是真文案而不是裸 i18n 键,且 devSpace.* + developerInfo.* 五语言齐备;
 *  ④ 迁移门判据(守门 check-rn-app-migration 的 `__test__`,§22c 不复制判据)对本壳零违规,
 *     **白名单那行「无跨端需求」豁免被摘掉后仍判绿** ⇒ 发起人可以放心摘线。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import type { AuthUser, DeveloperDevInfo } from '@ihui/api-client'
import { messages, getValueByPath } from '../src/i18n'
import {
  DEVELOPER_SPACE_ENTRIES,
  DEVELOPER_SPACE_PROBLEMS,
} from '@ihui/shared/constants/developer-space'
import { __test__ as rnAppGate } from '../../../scripts/check-rn-app-migration.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const shellText = readFileSync(resolve(HERE, '../src/screens/DeveloperScreen.tsx'), 'utf8')
const sharedText = [
  resolve(HERE, '../../../packages/app/src/features/developer/DeveloperScreen.tsx'),
  resolve(HERE, '../../../packages/app/src/features/developer/developer-styles.ts'),
]
  .map((p) => readFileSync(p, 'utf8'))
  .join('\n')

const nav = vi.hoisted(() => ({ goBack: vi.fn(), navigate: vi.fn() }))
const pops = vi.hoisted(() => ({ appAlert: vi.fn() }))
const clipboard = vi.hoisted(() => ({ setString: vi.fn() }))
/** 可变夹具:各用例改它,被 mock 的 useAuth / getDeveloperDevInfo 在渲染时现读 */
const state = vi.hoisted(() => ({
  user: null as AuthUser | null,
  devInfo: null as DeveloperDevInfo | null,
}))

vi.mock('@react-navigation/native', () => ({ useNavigation: () => nav }))
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light', theme: 'system', setTheme: vi.fn() }),
}))
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }))
vi.mock('../src/components/BottomPops', () => ({ appAlert: pops.appAlert }))
vi.mock('@react-native-clipboard/clipboard', () => ({ default: clipboard }))
vi.mock('@ihui/api-client', () => ({
  getDeveloperDevInfo: () => Promise.resolve({ success: true, data: state.devInfo }),
}))
// 页头返回键与顶栏底色承载件各有自己的套件;react-native 原语用 tests/__mocks__/react-native.ts 那份
vi.mock('../src/components/NavBar', () => ({
  NavBar: ({ title, onBack }: { title?: string; onBack?: () => void }) =>
    createElement('div', { 'data-role': 'navbar', onClick: onBack }, title),
}))
vi.mock('../src/components/NavChrome', () => ({
  NavChrome: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))

import DeveloperScreen from '../src/screens/DeveloperScreen'
import { I18nProvider } from '../src/i18n'
import { DeveloperScreen as SharedFromStub } from '@ihui/rn-app'
import { DeveloperScreen as RealSharedDeveloperScreen } from '../../../packages/app/src/features/developer/DeveloperScreen'

const zh = messages['zh-CN'] as Record<string, unknown>
const val = (key: string) => getValueByPath(zh, key) as string
/** 屏本身不含 Provider(真机由 App.tsx 挂),渲染必须包一层 —— 包的是真的取词实现,不是替身 */
const renderScreen = () => render(createElement(I18nProvider, null, createElement(DeveloperScreen)))

const USER = { id: 'u1', nickname: '张三', username: 'zhangsan', email: 'dev@example.com' }
const SUBSCRIBED = {
  account: { email: 'dev@example.com', phone: null, nickname: null, username: null },
  subscription: {
    id: 's1',
    userId: 'u1',
    pricingId: null,
    period: 'year',
    startTime: '2026-01-01T00:00:00Z',
    endTime: '2026-12-31T00:00:00Z',
    status: 1,
    autoRenew: 0,
    orderId: null,
  },
  apiKeys: { count: 2, activeCount: 1, firstActiveKey: 'ihui-pub-key-1' },
  developer: {
    name: '智汇工作室',
    description: '做 AI 智能体的工作室',
    status: 1,
    website: 'https://aizhs.top',
  },
}
const NO_SUBSCRIPTION = {
  account: null,
  subscription: null,
  apiKeys: { count: 0, activeCount: 0, firstActiveKey: null },
  developer: null,
}

/** 单调不减判定(undefined 兜成 +∞) */
const monotonic = (xs: number[]) =>
  xs.every((p, i) => i === 0 || (xs[i - 1] ?? Number.POSITIVE_INFINITY) <= p)
const bodyText = () => document.body.textContent ?? ''

describe('DeveloperScreen 渲染的是共享层那一份', () => {
  beforeEach(() => {
    cleanup()
    nav.navigate.mockClear()
    nav.goBack.mockClear()
    clipboard.setString.mockClear()
    pops.appAlert.mockClear()
    state.user = USER
    state.devInfo = SUBSCRIBED
  })

  it('壳委托的正是真实共享屏(同一函数对象),而壳自身不画任何版式', () => {
    expect(SharedFromStub).toBe(RealSharedDeveloperScreen)
    expect(shellText).toMatch(/DeveloperScreen as SharedDeveloperScreen } from '@ihui\/rn-app'/)
    // 壳只留一层 flex 容器 + 页头(既有薄壳形态,同 ConversationImportScreen);
    // 任何 <Text>/<View> 版式或第二份样式表都是"把版式又抄回端内"的那一型
    expect(shellText).not.toMatch(/<Text|<ScrollView|StyleSheet\.create/)
    expect(sharedText).toMatch(/StyleSheet\.create/)
  })

  it('迁移门判据(源脚本 __test__,不复制判据)对本壳零违规;摘掉豁免同样零违规', () => {
    const run = (whitelist: Map<string, { why: string; expires: string }>, text: string) =>
      rnAppGate.verdict({
        screens: [{ name: 'DeveloperScreen.tsx', text }],
        baseline: new Map([['DeveloperScreen.tsx', text]]),
        sharedNames: new Set([rnAppGate.stemOf('DeveloperScreen.tsx')]),
        headScreenNames: new Set(['DeveloperScreen.tsx']),
        whitelist,
        today: rnAppGate.isoToday(),
      })
    expect(run(rnAppGate.WHITELIST_ENTRIES, shellText).violations).toEqual([])
    // 阳性对照 1:白名单那行「开发者空间页…无跨端需求」被摘掉后,真壳仍判绿(靠的是真 import)
    expect(run(new Map(), shellText).violations).toEqual([])
    // 阳性对照 2:同一把尺子把 import 抹掉必须判 V1 红(否则上一条断言是恒真的)
    const stripped = shellText.replace(/'@ihui\/rn-app'/g, "'../screens/DeveloperScreenLocal'")
    expect(run(new Map(), stripped).violations.map((v: { code: string }) => v.code)).toEqual(['V1'])
  })

  it('开发者信息卡逐行上屏(名称/简介/状态/账号/密钥插值/网址/到期时间)', async () => {
    renderScreen()
    for (const key of [
      'developerInfo.title',
      'developerInfo.nameLabel',
      'developerInfo.descLabel',
      'developerInfo.statusLabel',
      'developerInfo.accountLabel',
      'developerInfo.apiKeyLabel',
      'developerInfo.urlLabel',
      'developerInfo.expiryLabel',
    ]) {
      await waitFor(() => expect(screen.queryByText(val(key)), `${key} 未上屏`).not.toBeNull())
    }
    const expiry = new Intl.DateTimeFormat('zh-CN').format(new Date('2026-12-31T00:00:00Z'))
    expect(screen.queryByText(val('developerInfo.statusApproved'))).not.toBeNull()
    expect(screen.queryByText('智汇工作室')).not.toBeNull()
    expect(screen.queryByText('已创建 2 个')).not.toBeNull()
    expect(screen.queryByText(expiry), '到期时间未走 Intl.DateTimeFormat').not.toBeNull()
  })

  it('四入口构成与顺序 = 跨端单一源表,逐条跳到已注册路由', async () => {
    renderScreen()
    await waitFor(() => expect(screen.queryByText(val('devSpace.entryMyAgents'))).not.toBeNull())
    const text = bodyText()
    const positions = DEVELOPER_SPACE_ENTRIES.map((e) => text.indexOf(val(e.labelKey)))
    for (const [i, p] of positions.entries()) {
      expect(p, `${DEVELOPER_SPACE_ENTRIES[i]?.labelKey} 未上屏`).toBeGreaterThanOrEqual(0)
    }
    expect(monotonic(positions), '入口顺序与跨端单一源不一致').toBe(true)
    /** 分派语义逐条钉住(RN 端既有路由与参数形态;表里只有 id,路由不住在跨端表内) */
    const expected: Record<string, unknown[]> = {
      myAgents: ['DevEnter'],
      agentIncome: ['ModelIncome', { agentId: undefined }],
      n8nModel: ['N8nModel'],
      businessCard: ['BusinessCard', {}],
    }
    for (const entry of DEVELOPER_SPACE_ENTRIES) {
      nav.navigate.mockClear()
      fireEvent.click(screen.getByText(val(entry.labelKey)))
      const call = expected[entry.id] ?? []
      expect(nav.navigate, `${entry.id} 没跳 ${String(call[0])}`).toHaveBeenCalledWith(...call)
    }
    expect(Object.keys(expected).length).toBe(DEVELOPER_SPACE_ENTRIES.length)
  })

  it('两张问题卡按表序上屏,点击复制外链并提示到浏览器打开', async () => {
    renderScreen()
    await waitFor(() =>
      expect(screen.queryByText(val('devSpace.faqIncentiveTitle'))).not.toBeNull(),
    )
    const text = bodyText()
    const ordered = DEVELOPER_SPACE_PROBLEMS.flatMap((p) => [p.titleKey, p.descKey, p.btnKey])
    const positions = ordered.map((k) => text.indexOf(val(k)))
    expect(monotonic(positions), '问题卡内容与顺序与跨端单一源不一致').toBe(true)
    fireEvent.click(screen.getByText(val('devSpace.faqIncentiveBtn')))
    expect(clipboard.setString).toHaveBeenCalledWith(DEVELOPER_SPACE_PROBLEMS[0]?.url)
    expect(pops.appAlert).toHaveBeenCalledWith(val('common.hint'), val('devSpace.linkCopied'))
  })

  it('复制密钥 / 续费 / 咨询客服 / 返回四条端能力各走既有出口', async () => {
    renderScreen()
    await waitFor(() => expect(screen.queryByText('已创建 2 个')).not.toBeNull())
    fireEvent.click(screen.getByText(val('devSpace.copy')))
    expect(clipboard.setString).toHaveBeenCalledWith('ihui-pub-key-1')
    expect(pops.appAlert).toHaveBeenCalledWith(val('common.hint'), val('devSpace.copied'))
    // 「续费」两处(头部 CTA + 到期时间行尾动作)同指开通封面页
    for (const btn of screen.getAllByText(val('devSpace.renew'))) fireEvent.click(btn)
    expect(nav.navigate).toHaveBeenCalledWith('DevEnterCover')
    fireEvent.click(screen.getByText(val('devSpace.contactDesc')))
    expect(nav.navigate).toHaveBeenCalledWith('CustomerService')
    fireEvent.click(screen.getByText(val('devSpace.title')))
    expect(nav.goBack).toHaveBeenCalled()
  })

  it('未开通开发者:不渲染信息卡,头部 CTA 取「成为开发者」并跳开通封面', async () => {
    state.devInfo = NO_SUBSCRIPTION
    renderScreen()
    await waitFor(() => expect(screen.queryByText(val('devSpace.faqHeading'))).not.toBeNull())
    expect(screen.queryByText(val('developerInfo.title'))).toBeNull()
    fireEvent.click(screen.getByText(val('developer.becomeDeveloper')))
    expect(nav.navigate).toHaveBeenCalledWith('DevEnterCover')
  })

  it('没有任何裸 i18n 键上屏', async () => {
    renderScreen()
    await waitFor(() => expect(screen.queryByText(val('devSpace.faqHeading'))).not.toBeNull())
    expect(bodyText()).not.toMatch(/\b(?:devSpace|developerInfo)\.[A-Za-z][\w.]*/)
    // 阳性对照:同一把尺子喂一个真键名必须判红(否则这条断言是恒真的)
    const probe = render(createElement('span', null, 'devSpace.title'), {
      container: document.createElement('div'),
    })
    expect(probe.container.textContent).toMatch(/\b(?:devSpace|developerInfo)\.[A-Za-z][\w.]*/)
    probe.unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
