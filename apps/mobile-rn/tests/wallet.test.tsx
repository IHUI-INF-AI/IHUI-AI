// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 钱包余额 + 提现流程测试
 *
 * 覆盖:
 * - WalletScreen: 余额查询(正常/加载中/错误/空)
 * - WithdrawScreen: 提现金额校验(无效/低于最小值/正常)
 * - 提现到账(成功 toast)
 * - 余额不足拦截(后端错误)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import type * as BottomPopsModule from '../src/components/BottomPops'

const { apiMocks, alertCallbacks } = vi.hoisted(() => ({
  apiMocks: {
    getBalance: vi.fn(),
    fetchApi: vi.fn(),
  },
  alertCallbacks: [] as Array<() => void>,
}))

vi.mock('@ihui/api-client', () => ({
  getBalance: apiMocks.getBalance,
  fetchApi: apiMocks.fetchApi,
}))

// t 必须跨渲染同引用:生产 useI18n 取自 Provider 的 context value(t 只在 Provider 自身重渲时换),
// 而原替身每次调用都新建 t ⇒ WalletScreen 的 useCallback 链(t→uniappT→load)每次 render 都换引用,
// [load] effect 反复重跑 ⇒ getBalance 被真调 2+ 次(2026-10-25 收口串行 waitFor 时,终点同步断言
// toHaveBeenCalledTimes(1) 把它量了出来)。同 payment.test.tsx 替身的稳定写法对齐。
vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t }) }
})

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), goBack: vi.fn() }),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

vi.mock('../src/lib/config', () => ({
  API_BASE_URL: 'http://localhost:8801',
}))

// 提现二次确认弹窗改走共享 appAlert(见 components/BottomPops);用 importOriginal 保底其余导出,
// 只把 appAlert 替成捕获函数:捕获「确认」(common.confirm)按钮的 onPress 存入 alertCallbacks,
// 测试中手动触发以走完提现链路。
vi.mock('../src/components/BottomPops', async (importOriginal) => {
  const mod = await importOriginal<typeof BottomPopsModule>()
  return {
    ...mod,
    appAlert: vi.fn(
      (_title: string, _msg: string, buttons?: { text: string; onPress?: () => void }[]) => {
        const confirm = buttons?.find((b) => b.text === 'common.confirm')
        if (confirm?.onPress) alertCallbacks.push(confirm.onPress)
      },
    ),
  }
})

vi.mock('@ihui/ui-native', () => ({
  Button: (props: {
    children?: ReactNode
    onPress?: () => void
    loading?: boolean
    disabled?: boolean
  }) =>
    createElement(
      'button',
      { onClick: props.onPress, disabled: props.disabled || props.loading },
      props.children,
    ),
  Card: (props: { children?: ReactNode; style?: unknown }) =>
    createElement('div', null, props.children),
  Input: (props: {
    value?: string
    onChangeText?: (v: string) => void
    placeholder?: string
    [k: string]: unknown
  }) =>
    createElement('input', {
      value: props.value ?? '',
      onChange: (e: { target: { value: string } }) => props.onChangeText?.(e.target.value),
      placeholder: props.placeholder,
    }),
}))

import { WalletScreen } from '../src/screens/WalletScreen'
import { WithdrawScreen } from '../src/screens/WithdrawScreen'

const mockBalance = {
  balance: 1000.5,
  frozenBalance: 50.0,
  totalRecharge: 5000.0,
  totalWithdraw: 2000.0,
}

describe('WalletScreen 余额查询', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    alertCallbacks.length = 0
  })

  it('正常加载:显示余额、冻结、充值、提现', async () => {
    apiMocks.getBalance.mockResolvedValue({ success: true, data: mockBalance })
    const { getByText } = render(<WalletScreen />)

    // 链:mount → await getBalance → setBalance → 四张卡片渲染。共享屏的 cards 派生自 balance
    // (packages/app/src/features/wallet/WalletScreen.tsx),「可用余额」只在数据落位后才出现,
    // 它是终点 ⇒ 只等终点一次(形态同先例 e4989cbb9e;预算 8s < testTimeout 10s)。
    // WalletScreen UNIAPP_TEXT 映射:wallet.balance→可用余额 / wallet.frozen→冻结金额
    // / wallet.totalRecharge→累计充值 / wallet.totalWithdraw→累计提现
    await waitFor(() => expect(getByText('可用余额')).toBeTruthy(), { timeout: 8_000 })
    // 接口一次都没调时上面那句根本不会绿(卡片不渲染);这里再钉「只调一次」——重复请求由它管
    expect(
      apiMocks.getBalance,
      '余额卡渲染了却一次都没查过接口 = 数据来源是假的',
    ).toHaveBeenCalledTimes(1)
    expect(getByText('冻结金额')).toBeTruthy()
    expect(getByText('累计充值')).toBeTruthy()
    expect(getByText('累计提现')).toBeTruthy()
  })

  it('余额数值格式化:显示 ¥ 前缀 + 两位小数', async () => {
    apiMocks.getBalance.mockResolvedValue({ success: true, data: mockBalance })
    const { getByText } = render(<WalletScreen />)

    await waitFor(() => expect(getByText('可用余额')).toBeTruthy())
    expect(getByText(/1000\.50/)).toBeTruthy()
    expect(getByText(/2000\.00/)).toBeTruthy()
  })

  it('加载失败:显示错误信息', async () => {
    apiMocks.getBalance.mockResolvedValue({ success: false, error: '余额查询失败' })
    const { getAllByText } = render(<WalletScreen />)

    // UNIAPP_TEXT 映射:wallet.loadFailed→加载失败
    await waitFor(() => {
      expect(getAllByText('加载失败').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('加载失败无 error 字段:使用默认消息', async () => {
    apiMocks.getBalance.mockResolvedValue({ success: false })
    const { getAllByText } = render(<WalletScreen />)

    await waitFor(() => {
      expect(getAllByText('加载失败').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('余额为 null 时显示 — 占位符', async () => {
    apiMocks.getBalance.mockResolvedValue({
      success: true,
      data: { balance: null, frozenBalance: null, totalRecharge: 0, totalWithdraw: 0 },
    })
    const { getByText, getAllByText } = render(<WalletScreen />)

    await waitFor(() => expect(getByText('可用余额')).toBeTruthy())
    expect(getAllByText((content: string) => content.includes('—')).length).toBeGreaterThanOrEqual(
      1,
    )
  })
})

describe('WithdrawScreen 提现流程', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('金额无效(非数字):显示 amountInvalid', async () => {
    const { getByPlaceholderText, getByText } = render(<WithdrawScreen />)

    const input = getByPlaceholderText('withdraw.amountPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.click(getByText('withdraw.submit'))

    await waitFor(() => expect(getByText('withdraw.amountInvalid')).toBeTruthy())
  })

  it('金额为 0:显示 amountInvalid', async () => {
    const { getByPlaceholderText, getByText } = render(<WithdrawScreen />)

    const input = getByPlaceholderText('withdraw.amountPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(getByText('withdraw.submit'))

    await waitFor(() => expect(getByText('withdraw.amountInvalid')).toBeTruthy())
  })

  it('金额低于最低值:显示 minAmount', async () => {
    const { getByPlaceholderText, getByText } = render(<WithdrawScreen />)

    const input = getByPlaceholderText('withdraw.amountPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.click(getByText('withdraw.submit'))

    await waitFor(() => expect(getByText('withdraw.minAmount')).toBeTruthy())
  })

  it('提现成功:显示成功 toast', async () => {
    apiMocks.fetchApi.mockResolvedValue({ success: true })

    const { getByPlaceholderText, getByText } = render(<WithdrawScreen />)

    const input = getByPlaceholderText('withdraw.amountPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: '100' } })
    fireEvent.click(getByText('withdraw.submit'))
    // handleSubmit 在第一个 await 之前就同步调 appAlert(见 src/screens/WithdrawScreen.tsx),
    // fireEvent 的 act() 同步刷完 ⇒ 二次确认回调落位不需要等,降级为同步断言。
    expect(
      alertCallbacks.length,
      '没弹二次确认就能提交提现 = 确认环节是假的',
    ).toBeGreaterThanOrEqual(1)
    alertCallbacks[alertCallbacks.length - 1]!()

    // 链:确认 → await fetchApi → setSuccess。成功 toast 是终点,只等一次(8s < testTimeout 10s)。
    await waitFor(() => expect(getByText('withdraw.success')).toBeTruthy(), { timeout: 8_000 })
    expect(apiMocks.fetchApi).toHaveBeenCalledTimes(1)
    const [url, init] = apiMocks.fetchApi.mock.calls[0]!
    expect(url).toContain('/wallet/withdraw')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body.amount).toBe(100)
  })

  it('提现失败(HTTP 非 200):显示 failed', async () => {
    apiMocks.fetchApi.mockResolvedValue({ success: false })

    const { getByPlaceholderText, getByText } = render(<WithdrawScreen />)

    const input = getByPlaceholderText('withdraw.amountPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: '100' } })
    fireEvent.click(getByText('withdraw.submit'))
    // 二次确认回调同步落位(同「提现成功」条的注释),降级为同步断言;失败 toast 是链终点,只等一次。
    expect(
      alertCallbacks.length,
      '没弹二次确认就能提交提现 = 确认环节是假的',
    ).toBeGreaterThanOrEqual(1)
    alertCallbacks[alertCallbacks.length - 1]!()

    await waitFor(() => expect(getByText('withdraw.failed')).toBeTruthy(), { timeout: 8_000 })
  })

  it('提现失败(网络异常):显示 failed', async () => {
    apiMocks.fetchApi.mockRejectedValue(new Error('network'))

    const { getByPlaceholderText, getByText } = render(<WithdrawScreen />)

    const input = getByPlaceholderText('withdraw.amountPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: '100' } })
    fireEvent.click(getByText('withdraw.submit'))
    // 同「提现成功」条:确认回调同步落位;failed toast 只等一次。
    expect(
      alertCallbacks.length,
      '没弹二次确认就能提交提现 = 确认环节是假的',
    ).toBeGreaterThanOrEqual(1)
    alertCallbacks[alertCallbacks.length - 1]!()

    await waitFor(() => expect(getByText('withdraw.failed')).toBeTruthy(), { timeout: 8_000 })
  })

  it('银行卡片号可选:不填也能提交', async () => {
    apiMocks.fetchApi.mockResolvedValue({ success: true })

    const { getByPlaceholderText, getByText } = render(<WithdrawScreen />)

    const amountInput = getByPlaceholderText('withdraw.amountPlaceholder') as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: '50' } })
    fireEvent.click(getByText('withdraw.submit'))
    // 同「提现成功」条:确认回调同步落位;success toast 只等一次。
    expect(
      alertCallbacks.length,
      '没弹二次确认就能提交提现 = 确认环节是假的',
    ).toBeGreaterThanOrEqual(1)
    alertCallbacks[alertCallbacks.length - 1]!()

    await waitFor(() => expect(getByText('withdraw.success')).toBeTruthy(), { timeout: 8_000 })
    const body = JSON.parse(apiMocks.fetchApi.mock.calls[0]![1].body)
    expect(body.bankCardId).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
