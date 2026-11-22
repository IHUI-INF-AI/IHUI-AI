// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * pkg-ai/developer/income 薄壳形制锁。
 *
 *  ① 共享屏 model-income/ModelIncomeScreen 真被渲染、主题根在壳外层;
 *  ② 页内不再保留第二份「汇总卡/tabs/列表项」实现(旧 income-card/income-tabs/income-list-item 全撤);
 *  ③ 壳 → 共享屏的 props 契约锁(含 withdrawDisabled 真值);
 *  ④ 共享屏确有列表项可选字段与 withdrawDisabled 的可选承接分支(删分支即红);
 *  ⑤ 缺段仍在页内:服务费提示、提现明细入口/面板 cashList、提现金额弹窗(FocusInput);
 *  ⑥ 小程序不传 orderAmount / rate(接口无此列),只由 RN 传真值(列表项可选字段不是小程序独占 prop);
 *  ⑦ 无新 i18n key(页面 tt() 的 key 全部能在 miniapp-taro 词包里解析);
 *  ⑧ 数据层/分页/useDidShow/鉴权门/提现提交保留。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const captured = vi.hoisted(() => ({
  income: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app/features/model-income/ModelIncomeScreen', () => ({
  ModelIncomeScreen: (props: Record<string, unknown>) => {
    captured.income = props
    return createElement('div', { 'data-shell': 'model-income-screen' })
  },
}))

// 页内独有段用 Taro 的 View/Text;node 环境不加载真实 @tarojs/components
vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => createElement('div', props),
  Text: (props: Record<string, unknown>) => createElement('span', props),
}))

vi.mock('@tarojs/taro', () => {
  const Taro = { navigateBack: vi.fn(), navigateTo: vi.fn(), stopPullDownRefresh: vi.fn() }
  return { default: Taro, useDidShow: vi.fn(), ...Taro }
})

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-CN' }),
  useTt: () => (key: string, fallback?: string) => fallback ?? key,
}))

vi.mock('@/api', () => ({
  getBuyInfo: vi.fn(async () => ({})),
  getBuyList: vi.fn(async () => ({ list: [], total: 0 })),
  getDeveloperWithdrawalList: vi.fn(async () => ({ list: [] })),
  post: vi.fn(async () => ({ success: true })),
}))

// 不触发数据腿:本册只判壳→共享屏的 props 契约
vi.mock('@/hooks/use-auth-ready-gate', () => ({
  useAuthReadyGate: () => ({ waitUntilReady: () => () => {} }),
}))

vi.mock('@/utils/auth', () => ({ getUserInfo: () => ({ uuid: 'u1' }) }))
vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('@/components/FocusField', () => ({
  FocusInput: (props: Record<string, unknown>) => createElement('input', props),
}))
vi.mock('@/components/LineIcon', () => ({
  default: (props: Record<string, unknown>) =>
    createElement('span', { 'data-icon': String(props.name ?? '') }),
}))
vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import DeveloperIncome from '../src/pkg-ai/developer/income'

const PAGE_SOURCE = readFileSync(resolve('src/pkg-ai/developer/income.tsx'), 'utf8')
const SHARED_SOURCE = readFileSync(
  resolve('../../packages/app/src/features/model-income/ModelIncomeScreen.tsx'),
  'utf8',
)
const RN_SOURCE = readFileSync(
  resolve('../../apps/mobile-rn/src/screens/ModelIncomeScreen.tsx'),
  'utf8',
)
const MESSAGES = JSON.parse(
  readFileSync(resolve('../../packages/i18n/messages/miniapp-taro/zh-CN.json'), 'utf8'),
) as Record<string, unknown>

const lookup = (path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, MESSAGES)

describe('pkg-ai/developer/income 薄壳(直载 model-income/ModelIncomeScreen + 端内缺段)', () => {
  const html = renderToStaticMarkup(createElement(DeveloperIncome))
  const props = () => captured.income as Record<string, unknown>

  it('① 共享屏真被渲染,主题根在壳外层', () => {
    expect(PAGE_SOURCE).toContain("from '@ihui/rn-app/features/model-income/ModelIncomeScreen'")
    expect(html).toContain('data-shell="model-income-screen"')
    expect(html.indexOf('data-theme-root')).toBeGreaterThanOrEqual(0)
    expect(html.indexOf('data-shell="model-income-screen"')).toBeGreaterThan(
      html.indexOf('data-theme-root'),
    )
  })

  it('② 汇总卡/tabs/列表项不再有第二份实现', () => {
    expect(PAGE_SOURCE).not.toContain('income-card-top')
    expect(PAGE_SOURCE).not.toContain('income-tabs')
    expect(PAGE_SOURCE).not.toContain('income-list-item')
    expect(PAGE_SOURCE).not.toContain('settleText')
    expect(PAGE_SOURCE).not.toContain('headerTitle')
    expect(PAGE_SOURCE).not.toContain('useReachBottom')
    expect(PAGE_SOURCE).not.toContain('income-withdraw-btn')
  })

  it('③ 壳 → 共享屏 props 契约锁(withdrawDisabled 真值)', () => {
    expect(typeof props().t).toBe('function')
    expect(props().items).toEqual([])
    expect(props().summary).toMatchObject({
      totalCommission: 0,
      availableCommission: 0,
      withdrawnCommission: 0,
      pendingCommission: 0,
      day: 0,
    })
    expect(props().loading).toBe(true)
    expect(props().refreshing).toBe(false)
    expect(props().error).toBe('')
    expect(props().activeTab).toBe('all')
    expect(typeof props().onSelectTab).toBe('function')
    expect(typeof props().onRefresh).toBe('function')
    expect(props().showWithdrawModal).toBe(false)
    expect(typeof props().onOpenWithdraw).toBe('function')
    expect(typeof props().onCloseWithdraw).toBe('function')
    expect(typeof props().onConfirmWithdraw).toBe('function')
    // available 初值 0 ⇒ true;缺省是 false,与缺省不同才算真消费
    expect(props().withdrawDisabled).toBe(true)
    expect(props().loadingMore).toBe(false)
    expect(props().hasMore).toBe(false)
    expect(typeof props().onLoadMore).toBe('function')
    expect(typeof props().onBack).toBe('function')
    expect(typeof props().onRetry).toBe('function')
    expect(props().colorScheme).toBe('light')

    // 源码字面锁:契约不得被悄悄摘掉
    expect(PAGE_SOURCE).toContain('withdrawDisabled={available <= 0}')
    expect(PAGE_SOURCE).toContain('items={sharedItems}')
    expect(PAGE_SOURCE).toContain('onSelectTab={onChangeTab}')
    expect(PAGE_SOURCE).toContain('showWithdrawModal={showIncomePopup}')
    expect(PAGE_SOURCE).toContain('onConfirmWithdraw={onIncomeMethodConfirm}')
    expect(PAGE_SOURCE).toContain('onLoadMore={() => {')
  })

  it('④ 共享屏有列表项可选字段 + withdrawDisabled 的可选承接分支', () => {
    expect(SHARED_SOURCE).toContain('withdrawDisabled = false')
    expect(SHARED_SOURCE).toContain('styles.withdrawBtnDisabled')
    expect(SHARED_SOURCE).toContain('item.status ? (')
    expect(SHARED_SOURCE).toContain('{item.createdAt ?')
    expect(SHARED_SOURCE).toContain('{item.userNickname ? (')
    expect(SHARED_SOURCE).toContain('item.orderAmount !== undefined')
    expect(SHARED_SOURCE).toContain('item.rate !== undefined')
    expect(SHARED_SOURCE).toContain('item.commissionAmount !== undefined')
    expect(SHARED_SOURCE).toContain("isSettled(item.status ?? '')")
  })

  it('⑤ 缺段仍在页内(服务费提示 / 提现明细入口+面板 / 金额弹窗)', () => {
    expect(PAGE_SOURCE).toContain('income-fee-tip')
    expect(PAGE_SOURCE).toContain("tt('developer.income.feeTip'")
    expect(PAGE_SOURCE).toContain('onSwitchToDetail')
    expect(PAGE_SOURCE).toContain('loadCashList')
    expect(PAGE_SOURCE).toContain('getDeveloperWithdrawalList')
    expect(PAGE_SOURCE).toContain('cash-list')
    expect(PAGE_SOURCE).toContain('cashStatusText')
    expect(PAGE_SOURCE).toContain('FocusInput')
    expect(PAGE_SOURCE).toContain("post('/developer/withdrawals'")
    // 缺段不进共享屏:RN 侧没有这些段,共享屏也不承接
    expect(SHARED_SOURCE).not.toContain('cashList')
    expect(SHARED_SOURCE).not.toContain('withdrawals')
    expect(SHARED_SOURCE).not.toContain('feeTip')
  })

  it('⑥ 列表项可选字段由 RN 传真值,小程序不造假', () => {
    for (const prop of ['orderAmount', 'rate', 'userNickname', 'commissionAmount']) {
      expect(RN_SOURCE).toContain(`${prop}: r.${prop}`)
    }
    expect(RN_SOURCE).toContain('withdrawDisabled={(overview?.availableCommission ?? 0) <= 0}')
    // 小程序侧不传 orderAmount / rate:接口无此列,缺省交给共享屏可选渲染
    expect(PAGE_SOURCE).not.toContain('orderAmount:')
    expect(PAGE_SOURCE).not.toContain('rate:')
    expect(PAGE_SOURCE).toContain(
      'commissionAmount: rawAmount === undefined ? undefined : Number(rawAmount)',
    )
  })

  it('⑦ 无新 i18n key:页面 tt() 的 key 全部可解析', () => {
    const keys = Array.from(PAGE_SOURCE.matchAll(/\btt\('([^']+)'/g)).map((m) => m[1]!)
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) {
      expect(lookup(key), `缺少 i18n key: ${key}`).toBeTypeOf('string')
    }
  })

  it('⑧ 数据层/分页/useDidShow/鉴权门/提现提交保留', () => {
    expect(PAGE_SOURCE).toContain('loadBuyInfo')
    expect(PAGE_SOURCE).toContain('getBuyInfo')
    expect(PAGE_SOURCE).toContain('fetchIncomeList')
    expect(PAGE_SOURCE).toContain('getBuyList')
    expect(PAGE_SOURCE).toContain('const PAGE_SIZE = 10')
    expect(PAGE_SOURCE).toContain('useDidShow')
    expect(PAGE_SOURCE).toContain('useAuthReadyGate')
    expect(PAGE_SOURCE).toContain('confirmWithdraw')
    expect(PAGE_SOURCE).toContain('void fetchIncomeList(page + 1, settlement, true)')
  })
})
