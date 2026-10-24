// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AboutScreen 的行为级自证(§17:UI 改动不能只凭代码审查)。
 *
 * 本机真机跑的是 release 包、模拟器没有 debug 包 ⇒ 出不了像素图;这条套件把能机判的部分
 * 全部钉住:六段内容真的渲染、七个合规入口真的跳到已注册屏、两个 CTA 真的落到在册出口、
 * 且**没有裸 i18n 键上屏**。最后一项是这页最容易坏而类型层看不见的一种。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { messages, getValueByPath, type Locale } from '../src/i18n'

const nav = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: nav.navigate, goBack: nav.goBack }),
}))

// 图标素材不是本页的判据;替掉以免 lucide 的 RN 依赖把套件拖进收集期失败。
// 名单必须覆盖 AboutScreen + aboutPageSections 两处 import —— 漏一个就是运行时 export 缺失。
vi.mock('lucide-react-native', () => {
  const icon = (name: string) => {
    const MockIcon = () => createElement('i', { 'data-icon': name })
    // react/display-name:箭头直返的匿名组件在 DevTools/报错栈里认不出是谁,补名
    MockIcon.displayName = `MockIcon(${name})`
    return MockIcon
  }
  return Object.fromEntries(
    [
      'BookOpen',
      'ChevronRight',
      // packages/app 的 BackChevron 用 ChevronLeft —— 薄壳接共享屏后本页会渲染到它
      'ChevronLeft',
      'Rocket',
      'Sparkles',
      'Globe',
      'Blocks',
      'CircleDollarSign',
      'ShieldCheck',
      'Database',
      'Cpu',
      'Plug',
      'Workflow',
      'Users',
    ].map((n) => [n, icon(n.toLowerCase())]),
  )
})

// 页头返回键与状态栏避让各有自己的套件,这里只证明"屏把内容渲染出来了"
vi.mock('../src/components/NavBar', () => ({
  NavBar: ({ title }: { title?: string }) => createElement('div', { 'data-role': 'navbar' }, title),
}))
vi.mock('../src/components/NavChrome', () => ({
  NavChrome: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))

import { AboutScreen } from '../src/screens/AboutScreen'
import { WEB_BASE_URL } from '../src/lib/webview-portal-config'
import { I18nProvider } from '../src/i18n'

/** 屏本身不含 Provider(真机由 App.tsx 挂),渲染必须包一层 —— 包的是真的取词实现,不是替身 */
const renderScreen = () => render(createElement(I18nProvider, null, createElement(AboutScreen)))

const zh = messages['zh-CN'] as Record<string, unknown>
const val = (k: string) => getValueByPath(zh, k) as string

describe('AboutScreen 渲染与跳转', () => {
  beforeEach(() => {
    cleanup()
    nav.navigate.mockClear()
    nav.goBack.mockClear()
  })

  it('六段内容逐段在屏(取的是词包里的真文案,不是键名)', () => {
    renderScreen()
    for (const k of [
      'about.heroBadge',
      'about.heroTitle',
      'about.heroSubtitle',
      'about.storyBadge',
      'about.storyTitle',
      'about.storyP1',
      'about.storyP2',
      'about.platformTitle',
      'about.numbersTitle',
      'about.ctaTitle',
      'about.ctaDesc',
      'about.complianceTitle',
    ]) {
      expect(screen.queryByText(val(k)), `${k} 未上屏`).not.toBeNull()
    }
    // 4 价值观 + 6 平台能力 + 4 数字见证,一张都不能少
    for (const k of [
      'about.valueOpenTitle',
      'about.valueCrossTitle',
      'about.valueFreeTitle',
      'about.valueEnterpriseTitle',
      'about.platformAgentsTitle',
      'about.platformRagTitle',
      'about.platformModelsTitle',
      'about.platformMcpTitle',
      'about.platformWorkflowTitle',
      'about.platformCollabTitle',
      'about.statUsers',
      'about.statAgents',
      'about.statLanguages',
      'about.statOpensource',
    ]) {
      expect(screen.queryByText(val(k)), `${k} 未上屏`).not.toBeNull()
    }
  })

  it('没有任何裸 i18n 键上屏', () => {
    const { container } = renderScreen()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\b(?:about|menu)\.[A-Za-z][\w.]*/)
    // 阳性对照:同一把尺子喂一个真键名必须判红(否则这条断言是恒真的)
    const probe = createElement('span', null, 'about.heroTitle')
    const r2 = render(probe, { container: document.createElement('div') })
    expect(r2.container.textContent).toMatch(/\b(?:about|menu)\.[A-Za-z][\w.]*/)
  })

  it('10 条合规/帮助入口逐条跳到已注册屏(条目与顺序由共享分段表 ABOUT_ENTRY_IDS 定)', () => {
    renderScreen()
    const rows: Array<[string, string]> = [
      ['menu.agreement', 'Agreement'],
      ['menu.privacy', 'Privacy'],
      ['menu.appPermission', 'AppPermission'],
      ['menu.usageRules', 'UsageRules'],
      ['menu.businessLicense', 'BusinessLicense'],
      ['menu.icpRecord', 'IcpRecord'],
      ['menu.modelRecord', 'ModelRecord'],
      ['menu.apiSettings', 'ApiSettings'],
      ['help.title', 'Help'],
      ['customerService.title', 'CustomerService'],
    ]
    for (const [key, target] of rows) {
      fireEvent.click(screen.getByText(val(key)))
      expect(nav.navigate, `${key} 没跳 ${target}`).toHaveBeenCalledWith(target)
    }
    expect(nav.navigate).toHaveBeenCalledTimes(rows.length)
  })

  it('CTA 落点:注册进本端屏,开放平台走 WebView 且 URL 由同源底座拼出', () => {
    renderScreen()
    fireEvent.click(screen.getByText(val('about.ctaPrimary')))
    expect(nav.navigate).toHaveBeenCalledWith('Register')
    fireEvent.click(screen.getByText(val('about.ctaSecondary')))
    expect(nav.navigate).toHaveBeenCalledWith('WebView', {
      url: `${WEB_BASE_URL}/developer`,
      title: val('about.ctaSecondary'),
    })
  })
})

describe('about.* 五语言齐备(渲染之外最容易坏的一格)', () => {
  const USED = [
    'heroBadge',
    'heroTitle',
    'heroSubtitle',
    'storyBadge',
    'storyTitle',
    'storyP1',
    'storyP2',
    'valueOpenTitle',
    'valueOpenDesc',
    'valueCrossTitle',
    'valueCrossDesc',
    'valueFreeTitle',
    'valueFreeDesc',
    'valueEnterpriseTitle',
    'valueEnterpriseDesc',
    'platformTitle',
    'platformAgentsTitle',
    'platformAgentsDesc',
    'platformRagTitle',
    'platformRagDesc',
    'platformModelsTitle',
    'platformModelsDesc',
    'platformMcpTitle',
    'platformMcpDesc',
    'platformWorkflowTitle',
    'platformWorkflowDesc',
    'platformCollabTitle',
    'platformCollabDesc',
    'numbersTitle',
    'statUsers',
    'statUsersDesc',
    'statAgents',
    'statAgentsDesc',
    'statLanguages',
    'statLanguagesDesc',
    'statOpensource',
    'statOpensourceDesc',
    'ctaTitle',
    'ctaDesc',
    'ctaPrimary',
    'ctaSecondary',
    'complianceTitle',
  ]

  it.each(['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as Locale[])(
    '%s:42 键全部取到非空字符串,且不等于键名本身',
    (locale) => {
      const pack = messages[locale] as Record<string, unknown>
      for (const k of USED) {
        const v = getValueByPath(pack, `about.${k}`)
        expect(typeof v, `${locale}.about.${k} 缺失`).toBe('string')
        expect((v as string).trim(), `${locale}.about.${k} 空值`).not.toBe('')
        expect(v, `${locale}.about.${k} 落成了键名`).not.toBe(`about.${k}`)
      }
    },
  )

  it('阳性对照:同一把尺子问一个不存在的键必须取不到值', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as Locale[]) {
      expect(
        getValueByPath(messages[locale] as Record<string, unknown>, 'about.__definitely_missing__'),
        `${locale} 不该有这个键`,
      ).toBeUndefined()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
