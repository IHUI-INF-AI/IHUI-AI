// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 F — RN 签到按钮无双击互斥且无 try/finally。
 *
 * 缺陷:CheckInScreen.handleSign 只用 signing state 做门,而 setSigning(true) 要等下一轮
 * render 才生效 ⇒ 同 tick 连点两次会发出两个 POST /checkin(重复签到 + 重复到账提示);
 * 另外 fetchApi 抛错时 setSigning(false) 永不执行,按钮卡在 signing 态。
 *
 * 判据:
 *  F1 同一 tick 并发两次调用 onSign,只发出一次 POST /checkin;
 *  F2 请求抛错后 signing 必须复位(try/finally)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, cleanup, waitFor, act } from '@testing-library/react'
import type * as ApiClient from '@ihui/api-client'

const api = vi.hoisted(() => ({ fetchApi: vi.fn() }))
const capture = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: vi.fn(), navigate: vi.fn() }),
}))
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))
vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))
vi.mock('../src/components/BottomPops', () => ({
  appAlert: vi.fn(),
}))
vi.mock('@ihui/rn-app', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown>>()
  return {
    ...real,
    CheckInScreen: (props: Record<string, unknown>) => {
      capture.props.push(props)
      return null
    },
  }
})
vi.mock('@ihui/api-client', async (importOriginal) => {
  const real = await importOriginal<typeof ApiClient>()
  return { ...real, fetchApi: api.fetchApi }
})

import { CheckInScreen } from '../src/screens/CheckInScreen'

const latest = () =>
  capture.props[capture.props.length - 1] as {
    info?: { todaySigned?: boolean }
    signing?: boolean
    onSign?: () => unknown
  }

const today = { todaySigned: false, todayReward: 5 }
const signCalls = () => api.fetchApi.mock.calls.filter(([url]) => String(url) === '/checkin').length

const settle = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  capture.props.length = 0
  api.fetchApi.mockImplementation(async (url: unknown) =>
    String(url) === '/checkin/today'
      ? { success: true, data: today }
      : { success: true, data: { points: 5 } },
  )
})

afterEach(() => {
  cleanup()
})

describe('票 F — 签到按钮并发互斥与失败复位', () => {
  it('F1 同一 tick 并发两次调用 onSign,只发出一次 POST /checkin', async () => {
    render(createElement(CheckInScreen))
    await waitFor(() => expect(latest()?.info).toBeTruthy())

    await act(async () => {
      latest().onSign?.()
      latest().onSign?.()
    })
    await settle()

    expect(signCalls()).toBe(1)
    expect(latest().signing).toBe(false)
  })

  it('F2 签到请求抛错后 signing 必须复位(try/finally)', async () => {
    render(createElement(CheckInScreen))
    await waitFor(() => expect(latest()?.info).toBeTruthy())

    api.fetchApi.mockImplementation(async (url: unknown) => {
      if (String(url) === '/checkin/today') return { success: true, data: today }
      throw new Error('network down')
    })

    // 抛错路径不进 async act:React 19 的 act 会等待被拒 promise 链而死等
    await Promise.resolve(latest().onSign?.()).catch(() => {})
    await new Promise((r) => setTimeout(r, 20))

    expect(latest().signing).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
