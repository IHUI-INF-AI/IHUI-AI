// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 钱包充值/提现薄壳形制锁(第 3 批)。
 *  ① 共享屏纯段各一条(resolveAppTopupSegments / resolveWithdrawSegments);
 *  ② 壳页各一条:渲染共享屏 + props 逐个到达;
 *  ③ 阴性对照:删掉页面一处传参(rateTiers / recordsLabel)⇒ ② 必红。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const state = vi.hoisted(() => ({
  recharge: null as Record<string, unknown> | null,
  withdraw: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app/features/app-topup/AppTopupScreen', () => {
  const Stub = (props: Record<string, unknown>) => {
    state.recharge = props
    return createElement('div', { 'data-shell': 'app-topup' })
  }
  Stub.displayName = 'AppTopupShellStub'
  return { AppTopupScreen: Stub }
})

vi.mock('@ihui/rn-app/features/withdraw/WithdrawScreen', () => {
  const Stub = (props: Record<string, unknown>) => {
    state.withdraw = props
    return createElement('div', { 'data-shell': 'withdraw' })
  }
  Stub.displayName = 'WithdrawShellStub'
  return { WithdrawScreen: Stub }
})

vi.mock('@tarojs/taro', () => {
  const Taro = {
    navigateBack: vi.fn(),
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
  }
  return { default: Taro, ...Taro, useDidShow: vi.fn() }
})

vi.mock('@/i18n', () => {
  const tt = (key: string, fallback?: string) => fallback ?? key
  return {
    useTt: () => tt,
    useI18n: () => ({ t: tt, locale: 'zh-CN' }),
  }
})

vi.mock('@/rn-compat/theme', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

vi.mock('@/api', () => ({
  getProfile: vi.fn(() => Promise.resolve(null)),
  createRecharge: vi.fn(() => Promise.resolve({ outTradeNo: '', payParams: null })),
  createAlipayMiniappPayment: vi.fn(() => Promise.resolve({ outTradeNo: '', tradeNo: '' })),
  getDistributionInfo: vi.fn(() => Promise.resolve({ available: 0 })),
  withdraw: vi.fn(() => Promise.resolve(undefined)),
}))

vi.mock('@/utils/pay', () => ({
  requestWxPayment: vi.fn(() => Promise.resolve(undefined)),
  requestAliPayment: vi.fn(() => Promise.resolve(undefined)),
}))

vi.mock('@/hooks/use-auth-ready-gate', () => ({
  useAuthReadyGate: () => ({ ready: true, allow: true, waitUntilReady: (cb: () => void) => cb() }),
}))

vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import RechargePage from '../src/pkg-shop/wallet/recharge/index'
import WithdrawalPage from '../src/pkg-shop/wallet/withdrawal/index'
import { resolveAppTopupSegments, TOPUP_TIERS } from '@ihui/rn-app/features/app-topup/view-model'
import { resolveWithdrawSegments } from '@ihui/rn-app/features/withdraw/view-model'
import {
  buildWithdrawMethods,
  formatWithdrawAmount,
} from '../src/pkg-shop/wallet/withdrawal/withdrawal-props'

const RECHARGE_SOURCE = readFileSync(resolve('src/pkg-shop/wallet/recharge/index.tsx'), 'utf8')
const WITHDRAW_SOURCE = readFileSync(resolve('src/pkg-shop/wallet/withdrawal/index.tsx'), 'utf8')

describe('共享屏纯段', () => {
  it('resolveAppTopupSegments:未注入档位回落三档,有选中档位可提交', () => {
    const seg = resolveAppTopupSegments({ selectedId: '100', customAmount: '' })
    expect(seg.tiers).toEqual(TOPUP_TIERS)
    expect(seg.canSubmit).toBe(true)
    expect(seg.showUser).toBe(false)
    expect(seg.showBalance).toBe(false)
  })

  it('resolveWithdrawSegments:注入方式/记录/全部提现才显示对应段', () => {
    expect(
      resolveWithdrawSegments({
        methods: [{ id: 'wechat' }],
        recordsLabel: '提现记录',
        onRecords: () => {},
        onFillAll: () => {},
      }),
    ).toEqual({
      showMethods: true,
      showAccount: false,
      showFillAll: true,
      showRecords: true,
    })
  })
})

describe('充值壳页', () => {
  const html = renderToStaticMarkup(createElement(RechargePage))

  it('共享屏真被渲染且主题根在外层', () => {
    expect(RECHARGE_SOURCE).toContain("from '@ihui/rn-app/features/app-topup/AppTopupScreen'")
    const theme = html.indexOf('data-theme-root')
    const shell = html.indexOf('data-shell="app-topup"')
    expect(theme).toBeGreaterThanOrEqual(0)
    expect(shell).toBeGreaterThan(theme)
  })

  it('props 逐个到达(rateTiers / texts / submitting / user)', () => {
    const p = state.recharge
    expect(p).not.toBeNull()
    expect(RECHARGE_SOURCE).toContain('rateTiers={buildRateTiers(TOKEN_RATE)}')
    expect(p?.rateTiers).toEqual([{ key: 'normal', label: '', tokens: 10 }])
    expect((p?.texts as Record<string, string>).submit).toBe('充值 ¥100.00')
    expect(p?.submitting).toBe(false)
    expect(p?.user).toBeUndefined()
    expect(p?.selectedId).toBe('100')
  })
})

describe('提现壳页', () => {
  const html = renderToStaticMarkup(createElement(WithdrawalPage))

  it('共享屏真被渲染且主题根在外层', () => {
    expect(WITHDRAW_SOURCE).toContain("from '@ihui/rn-app/features/withdraw/WithdrawScreen'")
    const theme = html.indexOf('data-theme-root')
    const shell = html.indexOf('data-shell="withdraw"')
    expect(theme).toBeGreaterThanOrEqual(0)
    expect(shell).toBeGreaterThan(theme)
  })

  it('props 逐个到达(methods / recordsLabel / texts / onFillAll)', () => {
    const p = state.withdraw
    expect(p).not.toBeNull()
    expect(WITHDRAW_SOURCE).toContain('recordsLabel={texts.records}')
    expect(p?.recordsLabel).toBe('提现记录')
    expect(p?.method).toBe('wechat')
    expect(p?.methods).toEqual(buildWithdrawMethods(((_key: string, fb: string) => fb) as never))
    expect((p?.texts as Record<string, string>).records).toBe('提现记录')
    expect(typeof p?.onFillAll).toBe('function')
    expect(typeof p?.onRecords).toBe('function')
    expect(p?.submitting).toBe(false)
    expect(p?.balance).toBe(0)
  })

  it('全部提现金额格式化两位小数', () => {
    expect(formatWithdrawAmount(1234.5)).toBe('1,234.50')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
