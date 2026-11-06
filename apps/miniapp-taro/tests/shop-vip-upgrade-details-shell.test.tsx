// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * VIP 升级页 / 详情对比表形制锁(第 5 批)。
 *  ① 纯段:buildUpgradeLevels(分→元)、buildUpgradeRights、mapCompareRows;
 *  ② 升级壳:共享 VipScreen 真渲染 + features 到达 + 只用子路径导入;
 *  ③ 阴性对照:删 upgrade 的 features={…} / compare-table 的 rows={rows} ⇒ 必红。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const state = vi.hoisted(() => ({ upgrade: null as Record<string, unknown> | null }))

vi.mock('@ihui/rn-app/features/vip/VipScreen', () => {
  const Stub = (props: Record<string, unknown>) => {
    state.upgrade = props
    return createElement('div', { 'data-shell': 'vip-upgrade' })
  }
  Stub.displayName = 'VipUpgradeShellStub'
  return { VipScreen: Stub }
})

vi.mock('@tarojs/components', async () => {
  const { createElement: h } = await import('react')
  const make = (tag: string, name: string) => {
    const C = (props: { children?: ReactNode; className?: string; onClick?: () => void }) =>
      h(tag, { className: props.className, onClick: props.onClick }, props.children)
    C.displayName = name
    return C
  }
  return { View: make('div', 'View'), Text: make('span', 'Text'), Button: make('button', 'Button') }
})

vi.mock('@tarojs/taro', () => {
  const Taro = {
    navigateBack: vi.fn(),
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
    getStorageSync: () => null,
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
    previewImage: vi.fn(),
  }
  return { default: Taro, ...Taro, useDidShow: vi.fn(), useRouter: () => ({ params: {} }) }
})

vi.mock('@/i18n', () => {
  const tt = (key: string, fallback?: string) => fallback ?? key
  return {
    useTt: () => tt,
    useI18n: () => ({ t: tt, tList: () => ['权益一', '权益二'], locale: 'zh-CN' }),
  }
})

vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

vi.mock('@/api', () => ({
  getVipLevels: vi.fn(() => Promise.resolve({ items: [] })),
  upgradeVip: vi.fn(() => Promise.resolve({ orderNo: '', payInfo: {} })),
  createAlipayMiniappPayment: vi.fn(() => Promise.resolve({})),
  post: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/utils/pay', () => ({
  requestWxPayment: vi.fn(() => Promise.resolve(undefined)),
  requestAliPayment: vi.fn(() => Promise.resolve(undefined)),
}))

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import UpgradePage from '../src/pkg-shop/vip/upgrade'
import { buildUpgradeLevels, buildUpgradeRights } from '../src/pkg-shop/vip/upgrade-props'
import { mapCompareRows } from '../src/pkg-shop/vip/details-props'

const UPGRADE_SOURCE = readFileSync(resolve('src/pkg-shop/vip/upgrade.tsx'), 'utf8')
const COMPARE_SOURCE = readFileSync(resolve('src/pkg-shop/vip/compare-table.tsx'), 'utf8')

describe('纯段', () => {
  it('档位:price 分→元(3990→39.9),benefits 字符串/对象同口径归一', () => {
    const levels = buildUpgradeLevels([
      {
        id: 1,
        levelName: '月度会员',
        levelValue: 1,
        price: 3990,
        durationDays: 30,
        status: 'active',
        benefits: [{ name: '无限对话' }, '高清绘图'],
      } as never,
    ])
    expect(levels[0]).toMatchObject({
      id: '1',
      levelName: '月度会员',
      levelValue: 1,
      price: 39.9,
      durationDays: 30,
      status: 'active',
    })
    expect(levels[0]?.benefits).toEqual(['无限对话', '高清绘图'])
  })

  it('权益清单 → features(id 稳定 right-N)', () => {
    const features = buildUpgradeRights(['无限对话', '优先客服'])
    expect(features).toEqual([
      { id: 'right-0', title: '无限对话', desc: '' },
      { id: 'right-1', title: '优先客服', desc: '' },
    ])
  })

  it('对比表:feature 键翻译 + 三档取值,未登记键原样透出', () => {
    const rows = mapCompareRows(
      [
        { feature: 'chats', basic: '10', premium: '100', enterprise: '300' },
        { feature: 'unknown_key', basic: 'a', premium: 'b', enterprise: 'c' },
      ] as never,
      (k) => (k === 'chats' ? '每日对话次数' : k),
    )
    expect(rows).toEqual([
      { label: '每日对话次数', values: ['10', '100', '300'] },
      { label: 'unknown_key', values: ['a', 'b', 'c'] },
    ])
  })
})

describe('升级页壳', () => {
  const html = renderToStaticMarkup(createElement(UpgradePage))

  it('只从子路径导入共享屏/共享矩阵(禁桶入口)', () => {
    expect(UPGRADE_SOURCE).toContain("from '@ihui/rn-app/features/vip/VipScreen'")
    expect(COMPARE_SOURCE).toContain("from '@ihui/rn-app/features/vip-compare/VipMatrix'")
    expect(UPGRADE_SOURCE).not.toMatch(/from '@ihui\/rn-app'/)
    expect(COMPARE_SOURCE).not.toMatch(/from '@ihui\/rn-app'/)
    expect(COMPARE_SOURCE).toContain('rows={rows}')
  })

  it('共享屏真被渲染且主题根在外层', () => {
    const theme = html.indexOf('data-theme-root')
    const shell = html.indexOf('data-shell="vip-upgrade"')
    expect(theme).toBeGreaterThanOrEqual(0)
    expect(shell).toBeGreaterThan(theme)
  })

  it('props 到达(features / levels / onPurchase / colorScheme)', () => {
    const p = state.upgrade
    expect(p).not.toBeNull()
    expect(UPGRADE_SOURCE).toContain("features={buildUpgradeRights(tList('vip.upgrade.rights'))}")
    expect((p?.features as unknown[]).length).toBe(2)
    expect((p?.features as { title: string }[])[0]?.title).toBe('权益一')
    expect(p?.levels).toEqual([])
    expect(typeof (p?.onPurchase as unknown)).toBe('function')
    expect(p?.colorScheme).toBe('light')
    expect(p?.purchasingId).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
