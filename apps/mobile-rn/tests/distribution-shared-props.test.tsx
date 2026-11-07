// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * RN DistributionScreen → 共享屏三段 props 真消费锁(批 5)。
 *
 * ① 三段 props 由 RN 容器真传给共享屏,且值来自 /distribution/overview 真数据
 *   (与缺省 undefined 有可见差异);
 * ② 本地 PersonalInformationCard / EarningsStatisticsCard / CommissionFloatingIcon
 *   不得回潮(源码锁);
 * ③ 收益卡 Tab 切换只回传 key,切到「今日」后金额归零(不伪造日/月拆分);
 * ④ 阴性对照:摘掉 RN 传参 serviceFloat 那一行 ⇒ 本册必红(现场实测见提交说明)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const OVERVIEW = {
  level: 'V2',
  totalCommission: 12345,
  pendingCommission: 500,
  withdrawnCommission: 734,
  availableCommission: 880,
  orderCount: 9,
  invitedCount: 6,
  withdrawMin: 100,
  products: [],
}

const captured = vi.hoisted(() => ({
  dist: null as Record<string, unknown> | null,
}))

const apiMocks = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  getCommissionRates: vi.fn(),
}))

vi.mock('@ihui/rn-app', () => ({
  DistributionScreen: (props: Record<string, unknown>) => {
    captured.dist = props
    return createElement('div', { 'data-testid': 'shared-distribution-screen' })
  },
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: apiMocks.fetchApi,
  getCommissionRates: apiMocks.getCommissionRates,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), goBack: vi.fn() }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { nickname: '张三', username: 'zhangsan', avatar: 'a.png' } }),
}))
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ locale: 'zh-CN', t: (key: string) => key }),
}))
vi.mock('react-native-qrcode-svg', () => ({ default: () => null }))
vi.mock('react-native-view-shot', () => ({ captureRef: vi.fn(async () => 'file://qr.png') }))
vi.mock('expo-media-library', () => ({
  Asset: { create: vi.fn() },
  requestPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
}))
vi.mock('@react-native-clipboard/clipboard', () => ({ default: { setString: vi.fn() } }))
vi.mock('../src/components/HandPlatePops', () => ({ HandPlatePops: () => null }))
vi.mock('../src/components/BottomPops', () => ({ BottomPops: () => null, appAlert: vi.fn() }))
vi.mock('../src/components/FloatBox', () => ({ default: () => null }))
vi.mock('../src/components/FunctionBlockColumn', () => ({ FunctionBlockColumn: () => null }))

import { DistributionScreen } from '../src/screens/DistributionScreen'

const RN_SOURCE = readFileSync(resolve('src/screens/DistributionScreen.tsx'), 'utf8')
const props = () => captured.dist as Record<string, unknown>

describe('RN DistributionScreen 三段 props 真消费', () => {
  beforeEach(() => {
    captured.dist = null
    apiMocks.fetchApi.mockResolvedValue({ success: true, data: OVERVIEW })
    apiMocks.getCommissionRates.mockResolvedValue({ success: true, data: { rates: {} } })
  })

  it('① 分销总览真传(用户资料 + 分销身份)', async () => {
    render(createElement(DistributionScreen))
    await waitFor(() => expect(captured.dist).not.toBeNull())
    expect(props().overviewCard).toMatchObject({
      avatar: 'a.png',
      nickname: '张三',
      identity: 'dist.dealer',
    })
    expect(RN_SOURCE).toContain('overviewCard={overviewCard}')
    expect(RN_SOURCE).toContain('avatar: user?.avatar || null')
  })

  it('② 收益卡真传(累计 Tab 真金额,今日/本月不伪造)', async () => {
    render(createElement(DistributionScreen))
    await waitFor(() => expect(captured.dist).not.toBeNull())
    const earnings = props().earningsCard as Record<string, unknown>
    expect(earnings.activeTab).toBe('total')
    expect((earnings.tabs as Array<{ key: string }>).map((x) => x.key)).toEqual([
      'today',
      'month',
      'total',
    ])
    const items = earnings.items as Array<{ label: string; value: string }>
    expect(items[0]).toEqual({ label: '收益', value: '¥123.45', tone: 'primary' })
    expect(items[1]!.value).toBe('¥5.00')
    expect(items[2]!.value).toBe('¥7.34')
    const footer = earnings.footerItems as Array<{ value: string }>
    expect(footer[0]!.value).toBe('9')
    expect(footer[1]!.value).toBe('6')
    expect(RN_SOURCE).toContain('earningsCard={earningsCard}')
  })

  it('③ Tab 切换只回传 key:切到今日 ⇒ 金额归零', async () => {
    render(createElement(DistributionScreen))
    await waitFor(() => expect(captured.dist).not.toBeNull())
    const earnings = props().earningsCard as Record<string, unknown>
    const onSelectTab = earnings.onSelectTab as (key: string) => void
    act(() => onSelectTab('today'))
    await waitFor(() => {
      const next = props().earningsCard as Record<string, unknown>
      expect(next.activeTab).toBe('today')
      const items = next.items as Array<{ value: string }>
      expect(items[0]!.value).toBe('¥0.00')
    })
  })

  it('④ 分佣浮标真传(可用佣金分→元,点击回调可达)', async () => {
    render(createElement(DistributionScreen))
    await waitFor(() => expect(captured.dist).not.toBeNull())
    expect(props().serviceFloat).toMatchObject({ amount: 8.8, label: 'commission.myLabel' })
    expect(typeof (props().serviceFloat as Record<string, unknown>).onPress).toBe('function')
    expect(RN_SOURCE).toContain('serviceFloat={info ? serviceFloat : undefined}')
    expect(RN_SOURCE).toContain('amount: info ? fenToYuan(info.availableCommission) : 0')
  })

  it('⑤ 本地三组件 + 本地二维码弹层/宫格不得回潮(源码锁)', () => {
    expect(RN_SOURCE).not.toContain('PersonalInformationCard')
    expect(RN_SOURCE).not.toContain('EarningsStatisticsCard')
    expect(RN_SOURCE).not.toContain('CommissionFloatingIcon')
    expect(RN_SOURCE).not.toContain('<BottomPops')
    expect(RN_SOURCE).not.toContain('<FunctionBlockColumn')
    expect(RN_SOURCE).not.toContain('qrContent')
  })

  it('⑥ 功能宫格真传(5 项 + lucide 图标节点 + 点击)', async () => {
    render(createElement(DistributionScreen))
    await waitFor(() => expect(captured.dist).not.toBeNull())
    const blocks = props().functionBlocks as Array<Record<string, unknown>>
    expect(blocks.length).toBe(5)
    expect(blocks.map((b) => b.key)).toEqual([
      'company_team',
      'ai_team',
      'business_card',
      'my_qrcode',
      'distribution_orders',
    ])
    expect(blocks[0]!.label).toBe('dist.teamCompany')
    expect(blocks[0]!.iconNode).toBeTruthy()
    expect(typeof blocks[0]!.onPress).toBe('function')
    expect(RN_SOURCE).toContain('functionBlocks={functionBlocks}')
    expect(RN_SOURCE).toContain('iconNode: <Users size={22}')
  })

  it('⑦ 二维码弹层真传(QR 节点带 ref + 分享/保存/复制回调)', async () => {
    render(createElement(DistributionScreen))
    await waitFor(() => expect(captured.dist).not.toBeNull())
    const qr = props().qrSheet as Record<string, unknown>
    expect(qr.title).toBe('dist.shareQrA11y')
    expect(qr.visible).toBe(false)
    expect(qr.qrNode).toBeNull()
    expect(qr.emptyText).toBe('暂无邀请码')
    expect((qr.tips as unknown[]).length).toBe(2)
    expect(qr.saveLabel).toBe('dist.saveQrA11y')
    expect(qr.shareLabel).toBe('分享给好友')
    expect(qr.copyLabel).toBe('复制邀请链接')
    expect(typeof qr.onSave).toBe('function')
    expect(typeof qr.onShare).toBe('function')
    expect(typeof qr.onCopy).toBe('function')
    expect(typeof qr.onClose).toBe('function')
    expect(RN_SOURCE).toContain('qrSheet={qrSheet}')
    expect(RN_SOURCE).toContain('ref={qrRef}')
  })

  it('⑧ 共享屏承接分支存在', () => {
    const shared = readFileSync(
      resolve('../../packages/app/src/features/distribution/DistributionScreen.tsx'),
      'utf8',
    )
    expect(shared).toContain('{overviewCard ? (')
    expect(shared).toContain('{earningsCard ? (')
    expect(shared).toContain('{serviceFloat ? (')
    expect(shared).toContain('{functionBlocks?.length ? (')
    expect(shared).toContain('{qrSheet?.visible ? (')
  })
})
