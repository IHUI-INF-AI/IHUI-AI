// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会员中心(5B)形制锁:
 *  ① 纯段:toLevelItems(分→元)、normalizeBenefits、pickEntryLevel/pickPermanentLevel;
 *  ② 壳:共享段 VipLevelsSection 真渲染 + 只走子路径导入 + 不注入 onPurchase(纯展示);
 *  ③ 阴性对照 N2:把导入改回桶入口 `@ihui/rn-app` ⇒ 源守护必红。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const state = vi.hoisted(() => ({ section: null as Record<string, unknown> | null }))

vi.mock('@ihui/rn-app/features/vip/VipLevelsSection', () => {
  const Stub = (props: Record<string, unknown>) => {
    state.section = props
    return createElement('div', { 'data-shell': 'member-vip-levels' })
  }
  Stub.displayName = 'VipLevelsSectionStub'
  return { VipLevelsSection: Stub }
})

vi.mock('@tarojs/components', async () => {
  const { createElement: h } = await import('react')
  const make = (tag: string, name: string) => {
    const C = (props: { children?: ReactNode; className?: string; onClick?: () => void }) =>
      h(tag, { className: props.className, onClick: props.onClick }, props.children)
    C.displayName = name
    return C
  }
  return {
    View: make('div', 'View'),
    Text: make('span', 'Text'),
    Image: make('img', 'Image'),
    Button: make('button', 'Button'),
    ScrollView: make('div', 'ScrollView'),
  }
})

vi.mock('@tarojs/taro', () => {
  const Taro = {
    navigateTo: vi.fn(),
    navigateBack: vi.fn(),
    getStorageSync: () => null,
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    redirectTo: vi.fn(),
    previewImage: vi.fn(),
  }
  return { default: Taro, ...Taro, useDidShow: vi.fn(), useRouter: () => ({ params: {} }) }
})

vi.mock('@/i18n', () => {
  // 真 i18n 的 t/tt 永远返回字符串;mock 必须同口径,否则 `tt(key, t(key,vars))` 会把对象当 React child
  const t = (key: string, _vars?: Record<string, unknown>) => key
  const tt = (key: string, fallback?: string, _vars?: Record<string, unknown>) =>
    typeof fallback === 'string' ? fallback : key
  return { useTt: () => tt, t }
})

vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('@/components/LineIcon', () => ({
  default: () => createElement('i', { 'data-icon': 'x' }),
}))
vi.mock('@/hooks/use-auth-ready-gate', () => ({
  useAuthReadyGate: () => ({ waitUntilReady: (fn: () => void) => fn }),
}))

vi.mock('@/api', () => ({
  getMemberInfo: vi.fn(() => Promise.resolve({ integral: 10, growth: 600, coupons: 2 })),
  getMemberBenefits: vi.fn(() => Promise.resolve({ list: [] })),
  getProfile: vi.fn(() => Promise.resolve(null)),
  getVipLevels: vi.fn(() => Promise.resolve({ items: [] })),
}))

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import MemberIndexPage from '../src/pages/member'
import {
  normalizeBenefits,
  pickEntryLevel,
  pickPermanentLevel,
  toLevelItems,
} from '../src/pages/member/member-index-props'

const MEMBER_SOURCE = readFileSync(resolve('src/pages/member/index.tsx'), 'utf8')

describe('纯段', () => {
  it('档位:price 分→元(3990→39.9),benefits 字符串/对象同口径归一', () => {
    const items = toLevelItems([
      {
        id: 'lv1',
        levelName: '月度会员',
        levelValue: 1,
        price: 3990,
        durationDays: 30,
        status: 1,
        benefits: [{ name: '无限对话' }, '高清绘图', '  '],
      } as never,
    ])
    expect(items[0]).toEqual({
      id: 'lv1',
      levelName: '月度会员',
      levelValue: 1,
      price: 39.9,
      durationDays: 30,
      status: 1,
      benefits: ['无限对话', '高清绘图'],
    })
  })

  it('benefits 非数组 ⇒ 空列表(不伪造)', () => {
    expect(normalizeBenefits(null)).toEqual([])
    expect(normalizeBenefits({ a: 'x' })).toEqual([])
  })

  it('入口档=在架最低价;永久档=在架最长时长;都只看 status=1', () => {
    const levels = [
      { id: 'a', price: 3990, durationDays: 30, status: 1 },
      { id: 'b', price: 29900, durationDays: 365, status: 1 },
      { id: 'c', price: 1000, durationDays: 400, status: 0 },
      { id: 'd', price: 32400, durationDays: 36500, status: 1 },
    ] as never
    expect(pickEntryLevel(levels)?.id).toBe('a')
    expect(pickPermanentLevel(levels)?.id).toBe('d')
  })
})

describe('会员中心壳', () => {
  const html = renderToStaticMarkup(createElement(MemberIndexPage))

  it('只从子路径导入共享段/纯函数(禁桶入口),且页内已无 vip-levels', () => {
    expect(MEMBER_SOURCE).toContain("from '@ihui/rn-app/features/vip/VipLevelsSection'")
    expect(MEMBER_SOURCE).not.toMatch(/from '@ihui\/rn-app'/)
    expect(MEMBER_SOURCE).not.toContain("from './vip-levels'")
  })

  it('主题根在外层,共享段在内层', () => {
    const theme = html.indexOf('data-theme-root')
    const shell = html.indexOf('data-shell="member-vip-levels"')
    expect(theme).toBeGreaterThanOrEqual(0)
    expect(shell).toBeGreaterThan(theme)
  })

  it('props 到达:标题传 vip.plans、membership/purchasingId 显式 null、t 为函数', () => {
    const p = state.section
    expect(p).not.toBeNull()
    expect(MEMBER_SOURCE).toContain("title={tt('vip.plans', '套餐选择')}")
    expect(p?.title).toBe('套餐选择')
    expect(p?.membership).toBeNull()
    expect(p?.purchasingId).toBeNull()
    expect(typeof p?.t).toBe('function')
  })

  it('不注入 onPurchase(会员中心已有自身 CTA ⇒ 段为纯展示)', () => {
    expect(MEMBER_SOURCE).not.toMatch(/onPurchase=/)
    expect(state.section?.onPurchase).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
