// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

import {
  AccountPoolScreen,
  type AccountPoolRow,
} from '../src/features/account-pool/AccountPoolScreen'

vi.mock('lucide-react-native', () => {
  const icon = (name: string) => () => createElement('i', { 'data-icon': name })
  // 白名单要跟实现同步:EmptyState 未传 icon 时渲染默认中性图标 Circle(见
  // src/components/ScreenStates.tsx 的 `icon ?? <Circle/>`)—— 少了它,空态那两格里
  // 整屏在 render 阶段就抛「No "Circle" export is defined on the mock」,
  // 而失败信息会落在本例的断言之外(报错栈在 ScreenStates,与"入口渲染条件"无关)。
  return {
    Plus: icon('Plus'),
    Wallet: icon('Wallet'),
    CalendarCheck: icon('CalendarCheck'),
    Trash2: icon('Trash2'),
    Circle: icon('Circle'),
  }
})

vi.mock('../src/components/BackChevron', () => ({
  BackChevron: ({ label }: { label: string }) => createElement('button', null, label),
}))

vi.mock('../src/components/TextField', () => ({
  TextField: ({ placeholder }: { placeholder: string }) => createElement('input', { placeholder }),
}))

vi.mock('react-native', () => {
  const el =
    (tag: string) =>
    ({ children }: { children?: ReactNode }) =>
      createElement(tag, null, children)
  const StyleSheet = {
    create: <T,>(s: T) => s,
    hairlineWidth: 1,
  }
  return {
    View: el('div'),
    Text: el('span'),
    ScrollView: el('div'),
    // design-tokens 的 rnRadius 经 PixelRatio/Dimensions 换算 ⇒ 缺这两个导出整屏直接抛
    PixelRatio: {
      get: () => 2,
      getFontScale: () => 2,
      getPixelSizeForLayoutSize: (n: number) => n,
      roundToNearestPixel: (n: number) => n,
    },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    TouchableOpacity: ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) =>
      createElement('button', { disabled: disabled === true }, children),
    ActivityIndicator: () => createElement('i', { 'data-test': 'spinner' }),
    RefreshControl: () => null,
    Pressable: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
    StyleSheet,
  }
})

/** 极简 t:把变量拼进返回值,断言面就是哪个键、带什么值、在什么条件下出现 */
const t = (key: string, vars?: Record<string, string | number>) => {
  const parts = Object.entries(vars ?? {}).map(([k, v]) => `${k}=${v}`)
  return parts.length > 0 ? `${key}[${parts.join(',')}]` : key
}

const mkRow = (over: Partial<AccountPoolRow> = {}): AccountPoolRow => ({
  id: 'r1',
  providerCode: 'qoder',
  uid: 'uid-aaa',
  name: '我的 Qoder',
  isEnabled: true,
  healthStatus: 'healthy',
  totalCalls: 7,
  checkinPending: false,
  ...over,
})

const noop = () => undefined

const baseProps = {
  t,
  loading: false,
  refreshing: false,
  busyId: null as string | null,
  submitting: false,
  draft: { providerCode: 'trae', name: '', token: '', refreshToken: '' },
  onDraftChange: noop,
  onSave: noop,
  onCheckin: noop,
  onToggle: noop,
  onDelete: noop,
  onRefresh: noop,
  onBack: noop,
}

afterEach(cleanup)

describe('AccountPoolScreen 共享屏渲染条件', () => {
  it('有行 ⇒ 概览按 enabled 计数,每行各出 uid 与调用次数', () => {
    const { getByText, getAllByText } = render(
      createElement(AccountPoolScreen, {
        ...baseProps,
        rows: [
          mkRow(),
          mkRow({ id: 'r2', uid: 'uid-bbb', name: '第二枚', isEnabled: false, totalCalls: 0 }),
        ],
      }),
    )
    expect(getByText('accountPool.summary[total=2,enabled=1]')).toBeTruthy()
    expect(getByText('我的 Qoder')).toBeTruthy()
    expect(getByText('第二枚')).toBeTruthy()
    expect(getAllByText(/^accountPool\.calls: \d+$/).length).toBe(2)
    expect(getByText(/uid-aaa/)).toBeTruthy()
    expect(getByText(/uid-bbb/)).toBeTruthy()
  })

  it('待同步徽章只在 checkinPending 为真时出现', () => {
    const on = render(
      createElement(AccountPoolScreen, { ...baseProps, rows: [mkRow({ checkinPending: true })] }),
    )
    expect(on.getByText('accountPool.syncPending')).toBeTruthy()
    on.unmount()
    const off = render(createElement(AccountPoolScreen, { ...baseProps, rows: [mkRow()] }))
    expect(off.queryByText('accountPool.syncPending')).toBeNull()
  })

  it('启停徽章文案跟随 isEnabled(停用行不得显示成已启用)', () => {
    const { getByText, queryByText } = render(
      createElement(AccountPoolScreen, { ...baseProps, rows: [mkRow({ isEnabled: false })] }),
    )
    expect(getByText('accountPool.disabled')).toBeTruthy()
    expect(queryByText('accountPool.enabled')).toBeNull()
  })

  it('回签到助手入口只在平台给了回调时渲染;空态本体不受影响', () => {
    const withLink = render(
      createElement(AccountPoolScreen, {
        ...baseProps,
        rows: [],
        onBackToCheckin: () => undefined,
      }),
    )
    expect(withLink.getByText('accountPool.backToCheckin')).toBeTruthy()
    expect(withLink.getByText('accountPool.empty')).toBeTruthy()
    withLink.unmount()

    const without = render(createElement(AccountPoolScreen, { ...baseProps, rows: [] }))
    expect(without.queryByText('accountPool.backToCheckin')).toBeNull()
    expect(without.getByText('accountPool.empty')).toBeTruthy()
  })

  it('名称或 token 为空 ⇒ 保存按钮禁用(不把空凭证发给号池)', () => {
    const { getAllByRole } = render(
      createElement(AccountPoolScreen, { ...baseProps, rows: [mkRow()] }),
    )
    const buttons = getAllByRole('button')
    expect((buttons.at(-1) as HTMLButtonElement).disabled).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
