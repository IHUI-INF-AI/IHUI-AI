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

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    getBalance: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  getBalance: apiMocks.getBalance,
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: vi.fn() }),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}))

vi.mock('../src/lib/config', () => ({
  API_BASE_URL: 'http://localhost:3001',
}))

vi.mock('react-native', () => {
  const { createElement } = require('react')
  const mk = (tag: string) =>
    function MockComp(props: { children?: ReactNode; [k: string]: unknown }) {
      return createElement(tag, props, props.children)
    }
  return {
    View: mk('div'),
    Text: mk('span'),
    ScrollView: mk('div'),
    TouchableOpacity: mk('button'),
    TextInput: mk('input'),
    StyleSheet: { create: (s: Record<string, unknown>) => s },
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
  })

  it('正常加载:显示余额、冻结、充值、提现', async () => {
    apiMocks.getBalance.mockResolvedValue({ success: true, data: mockBalance })
    const { getByText } = render(<WalletScreen />)

    await waitFor(() => {
      expect(apiMocks.getBalance).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => expect(getByText('可用余额')).toBeTruthy())
    expect(getByText('冻结金额')).toBeTruthy()
    expect(getByText('累计充值')).toBeTruthy()
    expect(getByText('累计提现')).toBeTruthy()
  })

  it('余额数值格式化:显示 ¥ 前缀 + 两位小数', async () => {
    apiMocks.getBalance.mockResolvedValue({ success: true, data: mockBalance })
    const { getByText } = render(<WalletScreen />)

    await waitFor(() => expect(getByText('可用余额')).toBeTruthy())
    expect(getByText(/1,000\.50/)).toBeTruthy()
    expect(getByText(/2,000\.00/)).toBeTruthy()
  })

  it('加载失败:显示错误信息', async () => {
    apiMocks.getBalance.mockResolvedValue({ success: false, error: '余额查询失败' })
    const { getByText } = render(<WalletScreen />)

    await waitFor(() => expect(getByText('余额查询失败')).toBeTruthy())
  })

  it('加载失败无 error 字段:使用默认消息', async () => {
    apiMocks.getBalance.mockResolvedValue({ success: false })
    const { getByText } = render(<WalletScreen />)

    await waitFor(() => expect(getByText('加载失败')).toBeTruthy())
  })

  it('余额为 null 时显示 — 占位符', async () => {
    apiMocks.getBalance.mockResolvedValue({
      success: true,
      data: { balance: null, frozenBalance: null, totalRecharge: 0, totalWithdraw: 0 },
    })
    const { getByText, getAllByText } = render(<WalletScreen />)

    await waitFor(() => expect(getByText('可用余额')).toBeTruthy())
    expect(getAllByText((content: string) => content.includes('—')).length).toBeGreaterThanOrEqual(1)
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
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const { getByPlaceholderText, getByText } = render(<WithdrawScreen />)

    const input = getByPlaceholderText('withdraw.amountPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: '100' } })
    fireEvent.click(getByText('withdraw.submit'))

    await waitFor(() => expect(getByText('withdraw.success')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('/api/wallet/withdraw')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body.amount).toBe(100)
    expect(init.headers.Authorization).toBe('Bearer test-token')
  })

  it('提现失败(HTTP 非 200):显示 failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const { getByPlaceholderText, getByText } = render(<WithdrawScreen />)

    const input = getByPlaceholderText('withdraw.amountPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: '100' } })
    fireEvent.click(getByText('withdraw.submit'))

    await waitFor(() => expect(getByText('withdraw.failed')).toBeTruthy())
  })

  it('提现失败(网络异常):显示 failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    const { getByPlaceholderText, getByText } = render(<WithdrawScreen />)

    const input = getByPlaceholderText('withdraw.amountPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: '100' } })
    fireEvent.click(getByText('withdraw.submit'))

    await waitFor(() => expect(getByText('withdraw.failed')).toBeTruthy())
  })

  it('银行卡片号可选:不填也能提交', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const { getByPlaceholderText, getByText } = render(<WithdrawScreen />)

    const amountInput = getByPlaceholderText('withdraw.amountPlaceholder') as HTMLInputElement
    fireEvent.change(amountInput, { target: { value: '50' } })
    fireEvent.click(getByText('withdraw.submit'))

    await waitFor(() => expect(getByText('withdraw.success')).toBeTruthy())
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
    expect(body.bankCardId).toBeUndefined()
  })
})
