// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * VIP 特权页/首页薄壳形制锁(第 4 批)。
 *  ① 共享屏纯段各一条(resolveVipBenefitMatrix/Entries/Popup、resolveVipIndexFeatures、buildVipIndexOverlay);
 *  ② 壳页各一条:渲染共享屏 + props 逐个到达;
 *  ③ 阴性对照:删掉 privilege 的 entries={…} / index 的 plans={…} ⇒ ② 必红。
 */
import { describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const state = vi.hoisted(() => ({
  privilege: null as Record<string, unknown> | null,
  index: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app/features/vip-benefit/VipBenefitScreen', () => {
  const Stub = (props: Record<string, unknown>) => {
    state.privilege = props
    return createElement('div', { 'data-shell': 'vip-benefit' })
  }
  Stub.displayName = 'VipBenefitShellStub'
  return { VipBenefitScreen: Stub }
})

vi.mock('@ihui/rn-app/features/vip/VipScreen', () => {
  const Stub = (props: Record<string, unknown>) => {
    state.index = props
    return createElement('div', { 'data-shell': 'vip-index' })
  }
  Stub.displayName = 'VipIndexShellStub'
  return { VipScreen: Stub }
})

vi.mock('@tarojs/taro', () => {
  const Taro = {
    navigateBack: vi.fn(),
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
    showLoading: vi.fn(),
    hideLoading: vi.fn(),
  }
  return {
    default: Taro,
    ...Taro,
    useDidShow: vi.fn(),
    useRouter: () => ({ params: {} }),
  }
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
  getVipPrivilege: vi.fn(() => Promise.resolve({ list: [] })),
  getVipInfo: vi.fn(() => Promise.resolve({ level: 0, name: '' })),
  getVipLevels: vi.fn(() => Promise.resolve({ items: [] })),
  upgradeVip: vi.fn(() => Promise.resolve({ orderNo: '', payInfo: {} })),
  signRecurringContract: vi.fn(() => Promise.resolve({ signUrl: '' })),
}))

vi.mock('@/utils/pay', () => ({
  requestWxPayment: vi.fn(() => Promise.resolve(undefined)),
}))

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))

vi.mock('@/hooks/use-auth-ready-gate', () => ({
  useAuthReadyGate: () => ({ ready: true, allow: true, waitUntilReady: () => {} }),
}))

vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import PrivilegePage from '../src/pkg-shop/vip/privilege'
import VipIndexPage from '../src/pkg-shop/vip/index'
import {
  resolveVipBenefitEntries,
  resolveVipBenefitMatrix,
  resolveVipBenefitPopup,
} from '@ihui/rn-app/features/vip-benefit/view-model'
import { resolveVipIndexFeatures } from '@ihui/rn-app/features/vip/view-model'
import { buildVipIndexOverlay } from '../src/pkg-shop/vip/vip-index-props'

const PRIVILEGE_SOURCE = readFileSync(resolve('src/pkg-shop/vip/privilege.tsx'), 'utf8')
const INDEX_SOURCE = readFileSync(resolve('src/pkg-shop/vip/index.tsx'), 'utf8')

const FALLBACK_TT = (_key: string, fallback: string) => fallback

describe('共享屏纯段', () => {
  it('权益矩阵:4 列 6 行,年度列高亮', () => {
    const matrix = resolveVipBenefitMatrix(FALLBACK_TT)
    expect(matrix.columns).toEqual(['权益', '普通', '月度', '季度', '年度'])
    expect(matrix.rows).toHaveLength(6)
    expect(matrix.rows[0]).toEqual({
      id: 'chats',
      label: '每日对话次数',
      values: ['10', '100', '300', '∞'],
    })
    expect(resolveVipBenefitPopup('level', FALLBACK_TT)).toMatchObject({
      kind: 'matrix',
      highlightColumn: 3,
      primaryLabel: '去开通',
    })
  })

  it('入口 3 条、操盘手/私董会权益各 5 条', () => {
    expect(resolveVipBenefitEntries(FALLBACK_TT).map((e) => e.id)).toEqual([
      'level',
      'trader',
      'privateAdvisory',
    ])
    expect(resolveVipBenefitPopup('trader', FALLBACK_TT)).toMatchObject({
      kind: 'benefits',
      items: [
        '专属市场数据分析工具',
        '一对一专业指导服务',
        '实时行情预警推送',
        '操盘策略专属课程',
        '优先参与平台活动',
      ],
    })
    expect(resolveVipBenefitPopup('privateAdvisory', FALLBACK_TT)).toMatchObject({
      kind: 'benefits',
      items: [
        '一对一专属顾问',
        '闭门沙龙参与权',
        '行业大咖私密交流',
        '高端资源对接',
        '定制化解决方案',
      ],
    })
  })

  it('首页特权目录 6 条', () => {
    const features = resolveVipIndexFeatures(FALLBACK_TT)
    expect(features.map((f) => f.id)).toEqual([
      'ai_copywriting',
      'ai_chat',
      'ai_analysis',
      'ai_design',
      'ai_video',
      'ai_live',
    ])
    expect(features[0]?.title).toBe('AI营销文案')
    expect(features[0]?.tag).toBe('VIP')
  })

  it('overlay 合成:须知勾选态与支付确认/支付方式优先级', () => {
    const handlers = {
      onCloseBenefits: vi.fn(),
      onUpgradeFromBenefits: vi.fn(),
      onClosePayConfirm: vi.fn(),
      onConfirmPay: vi.fn(),
      onSelectPayMethod: vi.fn(),
      onCloseIntroduce: vi.fn(),
      onIntroduceSubscribe: vi.fn(),
      onCloseConfirm: vi.fn(),
      onConfirmNext: vi.fn(),
      onCloseNotice: vi.fn(),
      onToggleNoticeAgree: vi.fn(),
      onNoticeContinue: vi.fn(),
      onClosePayMethod: vi.fn(),
      onPayMethodConfirm: vi.fn(),
      onSuccessViewBenefits: vi.fn(),
    }
    const base = {
      showBenefits: false,
      showPayConfirm: false,
      showIntroduce: false,
      showConfirm: false,
      showNotice: false,
      showPayMethod: false,
      showSuccess: false,
      noticeAgreed: false,
      payMethod: 'wechat' as const,
      plan: { name: '月度会员', price: 30, period: '30天', originalPrice: 40 },
      benefits: [],
    }
    const notice = buildVipIndexOverlay({ ...base, showNotice: true }, handlers, FALLBACK_TT)
    expect(notice?.kind).toBe('notice')
    expect(notice?.agree).toMatchObject({ label: '我已阅读并同意购买须知', checked: false })
    expect(notice?.primaryLabel).toBe('继续支付')

    const payConfirm = buildVipIndexOverlay(
      { ...base, showPayConfirm: true },
      handlers,
      FALLBACK_TT,
    )
    expect(payConfirm?.kind).toBe('payConfirm')
    expect(payConfirm?.plan).toEqual({ name: '月度会员VIP', price: 30, originalPrice: 40 })
    expect(payConfirm?.methods?.map((m) => m.id)).toEqual(['wechat', 'alipay'])
    expect(payConfirm?.primaryLabel).toBe('确认支付 ¥30')

    const success = buildVipIndexOverlay({ ...base, showSuccess: true }, handlers, FALLBACK_TT)
    expect(success?.kind).toBe('success')
  })
})

describe('特权页壳', () => {
  const html = renderToStaticMarkup(createElement(PrivilegePage))

  it('共享屏真被渲染且主题根在外层', () => {
    expect(PRIVILEGE_SOURCE).toContain("from '@ihui/rn-app/features/vip-benefit/VipBenefitScreen'")
    const theme = html.indexOf('data-theme-root')
    const shell = html.indexOf('data-shell="vip-benefit"')
    expect(theme).toBeGreaterThanOrEqual(0)
    expect(shell).toBeGreaterThan(theme)
  })

  it('props 逐个到达(header / entries / upgrade)', () => {
    const p = state.privilege
    expect(p).not.toBeNull()
    expect(PRIVILEGE_SOURCE).toContain('entries={entries}')
    expect(PRIVILEGE_SOURCE).toContain('header={header}')
    expect((p?.header as Record<string, unknown>).levelName).toBe('未开通会员')
    expect((p?.header as Record<string, unknown>).title).toBe('会员权益')
    expect((p?.entries as unknown[]).length).toBe(3)
    expect((p?.entries as { label: string }[])[0]?.label).toBe('会员等级介绍')
    expect((p?.upgrade as Record<string, unknown>).label).toBe('立即升级')
    expect(typeof (p?.upgrade as Record<string, unknown>).onPress).toBe('function')
  })
})

describe('首页壳', () => {
  const html = renderToStaticMarkup(createElement(VipIndexPage))

  it('共享屏真被渲染且主题根在外层', () => {
    expect(INDEX_SOURCE).toContain("from '@ihui/rn-app/features/vip/VipScreen'")
    const theme = html.indexOf('data-theme-root')
    const shell = html.indexOf('data-shell="vip-index"')
    expect(theme).toBeGreaterThanOrEqual(0)
    expect(shell).toBeGreaterThan(theme)
  })

  it('props 逐个到达(features / plans / buyBar / introduce / viewBenefits)', () => {
    const p = state.index
    expect(p).not.toBeNull()
    expect(INDEX_SOURCE).toContain('features={buildVipIndexFeatures(tt)}')
    expect((p?.features as unknown[]).length).toBe(6)
    expect((p?.plans as Record<string, unknown>).title).toBe('vip.plans')
    expect((p?.plans as Record<string, unknown>).options).toEqual([
      { id: 'monthly', name: '月度会员', price: 30, period: '30天' },
      { id: 'quarterly', name: '季度会员', price: 88, period: '90天' },
      { id: 'yearly', name: '年度会员', price: 299, period: '365天' },
    ])
    expect((p?.plans as Record<string, unknown>).memberDescTitle).toBe('vip.memberDesc')
    expect((p?.buyBar as Record<string, unknown>).price).toBe(30)
    expect((p?.introduce as Record<string, unknown>).label).toBe('vip.index.introduce')
    expect((p?.viewBenefits as Record<string, unknown>).label).toBe('vip.viewAllBenefits')
    expect(p?.overlay).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
