// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 侧真消费锁:model-income 共享屏新增可选字段/开关必须由 RN 传真值。
 *
 * 背景:小程序页只拿得到 id/title/time/amount 与结算过滤,没有 orderAmount / rate / userNickname,
 * 这些字段在共享屏做成**可选**(缺省不渲染、不补 0)。若 RN 也不传,可选分支就成了「只有小程序
 * 消费」的单端 prop。本套件钉死 RN 四条真实数据:
 *  ① items 带 orderId / status / userNickname / orderAmount / rate / commissionAmount(接口原值);
 *  ② withdrawDisabled = (availableCommission ?? 0) <= 0,可提现为 0 时真为 true(缺省 false);
 *  ③ summary 五值来自 overview / dayMonth 真数据;
 *  ④ createdAt 由 formatDateByTemplate 真格式化。
 * 阴性对照:摘掉 RN 的 withdrawDisabled ⇒ ② 必红(现场验证,命令与结果见提交说明)。
 *
 * mock 说明:RN 源文件按 barrel `@ihui/rn-app` 取共享屏,故直接替换 barrel。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import { render, waitFor } from '@testing-library/react'

const captured = vi.hoisted(() => ({
  income: null as Record<string, unknown> | null,
}))

const apiMocks = vi.hoisted(() => ({
  getOverview: vi.fn(),
  getCommissionList: vi.fn(),
  getDayMonthSummary: vi.fn(),
}))

vi.mock('@ihui/rn-app', () => ({
  ModelIncomeScreen: (props: Record<string, unknown>) => {
    captured.income = props
    return createElement('div', { 'data-testid': 'shared-model-income-screen' })
  },
}))

vi.mock('@ihui/api-client', () => ({
  getOverview: apiMocks.getOverview,
  getCommissionList: apiMocks.getCommissionList,
  getDayMonthSummary: apiMocks.getDayMonthSummary,
}))

vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: vi.fn() }) }))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ locale: 'zh-CN', t }) }
})

import { default as ModelIncomeScreen } from '../src/screens/ModelIncomeScreen'

const rawRecords = [
  {
    id: 'c1',
    orderId: 'ord-1',
    status: 'settled',
    createdAt: '2026-11-01T10:00:00+08:00',
    userNickname: '张三',
    orderAmount: 20.5,
    rate: 5,
    commissionAmount: 1.25,
  },
]

const renderScreen = () => render(createElement(ModelIncomeScreen))
const props = () => captured.income as Record<string, unknown>

describe('RN ModelIncomeScreen 真消费共享屏新增可选字段/开关', () => {
  beforeEach(() => {
    captured.income = null
    apiMocks.getOverview.mockResolvedValue({
      success: true,
      data: {
        totalCommission: 12.5,
        availableCommission: 0,
        withdrawnCommission: 3,
        pendingCommission: 1,
      },
    })
    apiMocks.getCommissionList.mockResolvedValue({
      success: true,
      data: { list: rawRecords, total: 1 },
    })
    apiMocks.getDayMonthSummary.mockResolvedValue({ success: true, data: { day: 2 } })
  })

  it('① items 带真实 orderId/status/userNickname/orderAmount/rate/commissionAmount', async () => {
    renderScreen()
    await waitFor(() => expect(captured.income).not.toBeNull())
    const items = props().items as Array<Record<string, unknown>>
    expect(items.length).toBe(1)
    expect(items[0]).toMatchObject({
      id: 'c1',
      orderId: 'ord-1',
      status: 'settled',
      userNickname: '张三',
      orderAmount: 20.5,
      rate: 5,
      commissionAmount: 1.25,
    })
    expect(typeof items[0]?.createdAt).toBe('string')
    expect((items[0]?.createdAt as string).length).toBeGreaterThan(0)
    // 可选字段的缺省态是 undefined;RN 传真值才让共享屏的 meta/头像/费率行出现
    for (const key of ['orderAmount', 'rate', 'userNickname', 'commissionAmount']) {
      expect(items[0]?.[key]).not.toBeUndefined()
    }
  })

  it('② withdrawDisabled 用可提现额真值:0 ⇒ true(缺省 false)', async () => {
    renderScreen()
    await waitFor(() => expect(captured.income).not.toBeNull())
    expect(props().withdrawDisabled).toBe(true)
  })

  it('③ summary 五值来自 overview / dayMonth 真数据', async () => {
    renderScreen()
    await waitFor(() => expect(captured.income).not.toBeNull())
    expect(props().summary).toEqual({
      totalCommission: 12.5,
      availableCommission: 0,
      withdrawnCommission: 3,
      pendingCommission: 1,
      day: 2,
    })
  })

  it('④ 既有 UI 契约不变:tab/refresh/withdraw/back 仍全量传入', async () => {
    renderScreen()
    await waitFor(() => expect(captured.income).not.toBeNull())
    expect(props().activeTab).toBe('all')
    expect(typeof props().onSelectTab).toBe('function')
    expect(typeof props().onRefresh).toBe('function')
    expect(props().showWithdrawModal).toBe(false)
    expect(typeof props().onOpenWithdraw).toBe('function')
    expect(typeof props().onCloseWithdraw).toBe('function')
    expect(typeof props().onConfirmWithdraw).toBe('function')
    expect(typeof props().onBack).toBe('function')
    expect(props().colorScheme).toBe('light')
  })
})
