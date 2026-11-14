// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

import {
  HrAttendanceScreen,
  type HrAttendanceRecord,
  type HrAttendanceScreenProps,
} from '../src/features/hr-attendance/HrAttendanceScreen'

vi.mock('../src/components/BackChevron', () => ({
  BackChevron: ({ label }: { label: string }) => createElement('button', null, label),
}))

vi.mock('react-native', () => {
  const el =
    (tag: string) =>
    ({ children }: { children?: ReactNode }) =>
      createElement(tag, null, children)
  return {
    View: el('div'),
    Text: el('span'),
    ScrollView: el('div'),
    PixelRatio: {
      get: () => 2,
      getFontScale: () => 2,
      getPixelSizeForLayoutSize: (n: number) => n,
      roundToNearestPixel: (n: number) => n,
    },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
    TextInput: ({
      placeholder,
      value,
      onChangeText,
      onFocus,
    }: {
      placeholder?: string
      value?: string
      onChangeText?: (v: string) => void
      onFocus?: () => void
    }) =>
      createElement('input', {
        placeholder,
        value,
        onChange: (e: { target: { value: string } }) => onChangeText?.(e.target.value),
        onFocus,
      }),
    TouchableOpacity: ({
      children,
      disabled,
      onPress,
    }: {
      children?: ReactNode
      disabled?: boolean
      onPress?: () => void
    }) => createElement('button', { disabled: disabled === true, onClick: onPress }, children),
    ActivityIndicator: () => createElement('i', { 'data-test': 'spinner' }),
    RefreshControl: () => null,
    StyleSheet: { create: <T,>(s: T) => s, hairlineWidth: 1 },
  }
})

/**
 * 极简 t:默认**不转译**(未命中即原样返回键),门体与屏里"词表未命中就原样回显"的
 * 分支因此可被直接验到;需要验"命中"的那一格另外喂一份字典(realtime)。
 */
const t = (key: string) => key

const mkRecord = (over: Partial<HrAttendanceRecord> = {}): HrAttendanceRecord => ({
  id: 'r1',
  date: '2026-11-13',
  status: 'present',
  checkInTime: '2026-11-13T09:05:00+08:00',
  checkOutTime: '2026-11-13T18:30:00+08:00',
  ...over,
})

const mkProps = (over: Partial<HrAttendanceScreenProps> = {}): HrAttendanceScreenProps => ({
  t,
  records: [],
  loading: false,
  refreshing: false,
  busy: false,
  employeeId: '',
  departmentId: '',
  onEmployeeIdChange: () => {},
  onDepartmentIdChange: () => {},
  onFocusField: () => {},
  onCheckIn: () => {},
  onRefresh: () => {},
  onBack: () => {},
  ...over,
})

afterEach(cleanup)

describe('HrAttendanceScreen 共享屏(RN 端薄壳的 UI 承载面)', () => {
  it('空态:无记录且不在加载时给空态文案,不显示 spinner', () => {
    const { container, getByText } = render(createElement(HrAttendanceScreen, mkProps()))
    expect(container.querySelector('[data-test="spinner"]')).toBeNull()
    getByText('hrAttendance.noData')
  })

  it('加载态:loading 时给 spinner,不抢先出空态', () => {
    const { container, queryByText } = render(
      createElement(HrAttendanceScreen, mkProps({ loading: true })),
    )
    expect(container.querySelector('[data-test="spinner"]')).not.toBeNull()
    expect(queryByText('hrAttendance.noData')).toBeNull()
  })

  it('记录行:日期、状态取词、上下班时刻按 HH:mm 截断', () => {
    // 词表命中那一格:statusPresent 在字典里 ⇒ 显示译文而不是协议码
    const dict: Record<string, string> = { 'hrAttendance.statusPresent': '出勤' }
    const { getByText } = render(
      createElement(
        HrAttendanceScreen,
        mkProps({ records: [mkRecord()], t: (k: string) => dict[k] ?? k }),
      ),
    )
    getByText('2026-11-13')
    getByText('出勤')
    // DOM 文本会把连续空格规范化成一枚,所以按"内容相等"而非字面空格数断言
    getByText(
      (_, el) =>
        el?.textContent === 'hrAttendance.colCheckIn: 09:05  ·  hrAttendance.colCheckOut: 18:30' &&
        el?.tagName === 'SPAN',
    )
  })

  it('时间缺失写破折号,不拿当前时刻冒充', () => {
    const { getByText } = render(
      createElement(
        HrAttendanceScreen,
        mkProps({ records: [mkRecord({ checkInTime: null, checkOutTime: null })] }),
      ),
    )
    getByText(
      (_, el) => el?.textContent === 'hrAttendance.colCheckIn: —  ·  hrAttendance.colCheckOut: —',
    )
  })

  it('词表未命中的协议码原样回显(不吞数据)', () => {
    const { getByText } = render(
      createElement(
        HrAttendanceScreen,
        mkProps({ records: [mkRecord({ status: 'businessTrip' })] }),
      ),
    )
    getByText('businessTrip')
  })

  it('签到按钮:工号或部门为空时禁用,填齐后启用', () => {
    const empty = render(createElement(HrAttendanceScreen, mkProps()))
    const btns = empty.container.querySelectorAll('button')
    const submit = btns[btns.length - 1] as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    cleanup()

    const filled = render(
      createElement(HrAttendanceScreen, mkProps({ employeeId: 'E001', departmentId: 'D01' })),
    )
    const b2 = filled.container.querySelectorAll('button')
    expect((b2[b2.length - 1] as HTMLButtonElement).disabled).toBe(false)
  })

  it('请求在途(busy)时按钮禁用且文案切到 loading —— 防重复提交的可见半边', () => {
    const { container, getByText } = render(
      createElement(
        HrAttendanceScreen,
        mkProps({ employeeId: 'E001', departmentId: 'D01', busy: true }),
      ),
    )
    const btns = container.querySelectorAll('button')
    expect((btns[btns.length - 1] as HTMLButtonElement).disabled).toBe(true)
    getByText('hrAttendance.loading')
  })

  it('点击签到触发 onCheckIn;输入与聚焦各自回调', () => {
    const onCheckIn = vi.fn()
    const onEmployeeIdChange = vi.fn()
    const onFocusField = vi.fn()
    const { container } = render(
      createElement(
        HrAttendanceScreen,
        mkProps({
          employeeId: 'E001',
          departmentId: 'D01',
          onCheckIn,
          onEmployeeIdChange,
          onFocusField,
        }),
      ),
    )
    const btns = container.querySelectorAll('button')
    fireEvent.click(btns[btns.length - 1] as HTMLButtonElement)
    expect(onCheckIn).toHaveBeenCalledTimes(1)

    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'E9' } })
    expect(onEmployeeIdChange).toHaveBeenCalledWith('E9')
    fireEvent.focus(input)
    expect(onFocusField).toHaveBeenCalledWith('employeeId')
  })

  it('禁用态点击不触发 onCheckIn(disabled 真的拦住了事件)', () => {
    const onCheckIn = vi.fn()
    const { container } = render(createElement(HrAttendanceScreen, mkProps({ onCheckIn })))
    const btns = container.querySelectorAll('button')
    fireEvent.click(btns[btns.length - 1] as HTMLButtonElement)
    expect(onCheckIn).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
