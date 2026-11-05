// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * distribution/index 薄壳形制锁(批 5:分销总览 + 收益卡 + 分佣浮标)。
 *
 * 判的是「端内壳有没有把共享屏接上并用显式 props 注入三段变体」,不是壳内部实现:
 *  ① 共享屏真被渲染、主题根在壳外层;
 *  ② 被删重复段源码锁(CommissionOverview / DistributionStats / 分佣比例卡 / CustomerServiceFloat 不得复活);
 *  ③ 三段 props 真到共享屏(摘掉任一即红);
 *  ④ 共享屏确有承接分支 + 无平台导航/客服 API;
 *  ⑤ RN 侧真消费点存在。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const captured = vi.hoisted(() => ({
  dist: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app/features/distribution/DistributionScreen', () => ({
  DistributionScreen: (props: Record<string, unknown>) => {
    captured.dist = props
    return createElement('div', { 'data-shell': 'distribution-screen' })
  },
}))

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) =>
    createElement('div', props, props.children as ReactNode),
  Text: (props: Record<string, unknown>) =>
    createElement('span', props, props.children as ReactNode),
  Image: (props: Record<string, unknown>) => createElement('img', { src: props.src }),
  Button: (props: Record<string, unknown>) =>
    createElement('button', props, props.children as ReactNode),
}))

vi.mock('@tarojs/taro', () => {
  const Taro = {
    navigateTo: vi.fn(() => Promise.resolve()),
    navigateBack: vi.fn(() => Promise.resolve()),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
  }
  return { default: Taro, useDidShow: vi.fn(), ...Taro }
})

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
  useTt: () => (key: string, fallback?: string) => fallback ?? key,
}))

vi.mock('@/api', () => ({
  getOperatorDataCardData: vi.fn(async () => ({
    avatar: '',
    nickname: '张三',
    identity: '操盘手',
    companyName: '智汇公司',
    verified: true,
    stats: { dayEarnings: 12.34, dayOrders: 3, dayInvites: 1 },
  })),
  get: vi.fn(async (url: string) => {
    if (url === '/distribution/commission-rates') return { rates: { V1: '20%' } }
    return {
      level: 'V2',
      totalCommission: 1234,
      pendingCommission: 500,
      withdrawnCommission: 734,
      availableCommission: 500,
      orderCount: 9,
      invitedCount: 6,
    }
  }),
  getWxCode: vi.fn(async () => ({ url: 'qr.png' })),
  realNameAuth: vi.fn(async () => ({ success: true })),
}))

vi.mock('@/hooks/use-auth-ready-gate', () => ({
  useAuthReadyGate: () => ({ waitUntilReady: () => () => {} }),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: (selector: (s: { user: Record<string, unknown> }) => unknown) =>
    selector({ user: { nickname: '张三', avatar: '', username: 'zhangsan' } }),
}))

vi.mock('@/constants/icon-urls', () => ({
  aizhsUrl: (path: string) => `https://cdn.test/${path}`,
  bspappUrl: (path: string) => `https://cdn.test/${path}`,
}))

vi.mock('@/utils/save-album', () => ({ saveImageToPhotosAlbum: vi.fn(async () => {}) }))
vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))
vi.mock('@/components/FocusField', () => ({ FocusInput: () => null }))
vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import DistributionIndex from '../src/pages/distribution/index'

const INDEX_SOURCE = readFileSync(resolve('src/pages/distribution/index.tsx'), 'utf8')
const DIST_SHARED = readFileSync(
  resolve('../../packages/app/src/features/distribution/DistributionScreen.tsx'),
  'utf8',
)
const RN_DIST = readFileSync(
  resolve('../../apps/mobile-rn/src/screens/DistributionScreen.tsx'),
  'utf8',
)

describe('distribution/index 薄壳(直载 distribution/DistributionScreen)', () => {
  const html = renderToStaticMarkup(createElement(DistributionIndex))
  const props = () => captured.dist as Record<string, unknown>

  it('① 共享屏真被渲染,主题根在壳外层', () => {
    expect(INDEX_SOURCE).toContain("from '@ihui/rn-app/features/distribution/DistributionScreen'")
    expect(html).toContain('data-shell="distribution-screen"')
    expect(html.indexOf('data-theme-root')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('data-shell="distribution-screen"')).toBeGreaterThan(
      html.indexOf('data-theme-root'),
    )
  })

  it('② 被删重复段不得复活(源码锁)', () => {
    expect(INDEX_SOURCE).not.toContain('CommissionOverview')
    expect(INDEX_SOURCE).not.toContain('DistributionStats')
    expect(INDEX_SOURCE).not.toContain('CustomerServiceFloat')
    expect(INDEX_SOURCE).not.toContain('earnCommission.rateTitle')
    expect(INDEX_SOURCE).not.toContain('dist-stats')
    expect(INDEX_SOURCE).not.toContain('NavBar')
  })

  it('③ 三段显式 props 真到共享屏(摘掉任一即红)', () => {
    const overview = props().overviewCard as Record<string, unknown>
    expect(overview).toBeTruthy()
    expect(overview.nickname).toBe('张三')
    expect(overview.identity).toBe('操盘手')
    expect(INDEX_SOURCE).toContain('overviewCard={overviewCard}')

    const earnings = props().earningsCard as Record<string, unknown>
    expect(earnings).toBeTruthy()
    expect((earnings.tabs as unknown[]).length).toBe(3)
    expect(earnings.activeTab).toBe('day')
    expect((earnings.items as unknown[]).length).toBe(3)
    expect(typeof earnings.onSelectTab).toBe('function')
    expect(INDEX_SOURCE).toContain('earningsCard={earningsCard}')

    const float = props().serviceFloat as Record<string, unknown>
    expect(float).toBeTruthy()
    expect(typeof float.onPress).toBe('function')
    expect(float.label).toBe('我的佣金')
    expect(INDEX_SOURCE).toContain('serviceFloat={serviceFloat}')
  })

  it('④ 共享屏承接分支 + 无平台导航/客服 API', () => {
    expect(DIST_SHARED).toContain('{overviewCard ? (')
    expect(DIST_SHARED).toContain('{earningsCard ? (')
    expect(DIST_SHARED).toContain('{serviceFloat ? (')
    expect(DIST_SHARED).not.toMatch(/Taro|wx\.|navigateTo|openCustomerServiceChat/)
  })

  it('⑤ RN 真消费点', () => {
    expect(RN_DIST).toContain('overviewCard={overviewCard}')
    expect(RN_DIST).toContain('earningsCard={earningsCard}')
    expect(RN_DIST).toContain('serviceFloat={info ? serviceFloat : undefined}')
  })

  it('⑥ 数据腿保留(overview / rates / 实名 / 二维码 / 门控)', () => {
    expect(INDEX_SOURCE).toContain("'/distribution/overview'")
    expect(INDEX_SOURCE).toContain("'/distribution/commission-rates'")
    expect(INDEX_SOURCE).toContain('getOperatorDataCardData')
    expect(INDEX_SOURCE).toContain('getWxCode')
    expect(INDEX_SOURCE).toContain('realNameAuth')
    expect(INDEX_SOURCE).toContain('gate.waitUntilReady')
  })
})
