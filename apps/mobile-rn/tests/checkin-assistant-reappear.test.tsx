// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 D — RN 签到助手无「回屏刷新」。
 *
 * 缺陷:CheckinAssistantScreen 只有挂载时 `void load()`,离开再回来(导航焦点回到本屏)
 * 不会重取;账号池在别处被改动后,回屏看到的是陈旧列表。
 *
 * 判据:
 *  F1 屏里必须订阅导航焦点(走 `useRefreshOnFocus` → screen-reappear-adapter),而不仅是首次挂载;
 *  F2 首次挂载跳过、数据落地后的重渲也不重拉(否则就是「每次 render 都拉」);
 *  F3 失焦再回屏只触发 +1 次刷新,且刷新回调引用稳定(focus effect 只订阅一次);
 *  F4 离开屏不触发刷新。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import type * as ApiClient from '@ihui/api-client'

const nav = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }))
const focus = vi.hoisted(() => ({
  cb: null as null | (() => void | (() => void)),
  cleanup: null as null | (() => void),
  effectRuns: 0,
}))
const api = vi.hoisted(() => ({ fetchApi: vi.fn() }))

vi.mock('@react-navigation/native', async () => {
  const React = await import('react')
  return {
    useNavigation: () => ({ navigate: nav.navigate, goBack: nav.goBack }),
    // 真 useFocusEffect 语义:callback 引用变一次就退订再订阅一次(cleanup(false) + effect(true))。
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => {
        focus.effectRuns += 1
        focus.cb = cb
        const cleanup = cb()
        focus.cleanup = typeof cleanup === 'function' ? cleanup : null
        return typeof cleanup === 'function' ? cleanup : undefined
      }, [cb])
    },
  }
})

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))
vi.mock('../src/components/WorkbuddyTaskSection', () => ({ WorkbuddyTaskSection: () => null }))
vi.mock('../src/components/NavBar', () => ({ NavBar: () => null }))
vi.mock('../src/components/NavChrome', () => ({ NavChrome: () => null }))
vi.mock('@ihui/api-client', async (importOriginal) => {
  const real = await importOriginal<typeof ApiClient>()
  return { ...real, fetchApi: api.fetchApi }
})

import CheckinAssistantScreen from '../src/screens/CheckinAssistantScreen'
import { I18nProvider } from '../src/i18n'

const account = (id: number) => ({ id, name: `号 ${id}`, platform: 'trae', enabled: true })

const listCalls = () =>
  api.fetchApi.mock.calls.filter(([url]) => String(url) === '/api/checkin/accounts').length

const leave = () => {
  act(() => {
    focus.cleanup?.()
  })
}
const enter = () => {
  act(() => {
    const cleanup = focus.cb?.()
    focus.cleanup = typeof cleanup === 'function' ? cleanup : null
  })
}
const settle = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  focus.cb = null
  focus.cleanup = null
  focus.effectRuns = 0
  api.fetchApi.mockResolvedValue({ success: true, data: { accounts: [account(1)] } })
})

afterEach(() => {
  cleanup()
})

describe('票 D — 签到助手回屏刷新', () => {
  it('F1 屏订阅了导航焦点(不只是首次挂载)', async () => {
    render(createElement(I18nProvider, null, createElement(CheckinAssistantScreen)))
    await waitFor(() => expect(screen.queryByText('号 1')).toBeTruthy())

    expect(typeof focus.cb).toBe('function')
  })

  it('F2 首次挂载跳过,数据落地后的重渲也不重拉', async () => {
    render(createElement(I18nProvider, null, createElement(CheckinAssistantScreen)))
    await waitFor(() => expect(screen.queryByText('号 1')).toBeTruthy())
    await settle()

    expect(listCalls()).toBe(1)
    // refresh 引用不稳定时,setState 引发的重渲会让 focus effect 重跑 → 连环重拉。
    expect(focus.effectRuns).toBe(1)
  })

  it('F3 失焦再回屏只触发 +1 次刷新,不连环', async () => {
    render(createElement(I18nProvider, null, createElement(CheckinAssistantScreen)))
    await waitFor(() => expect(screen.queryByText('号 1')).toBeTruthy())

    leave()
    expect(listCalls()).toBe(1)

    enter()
    await waitFor(() => expect(listCalls()).toBe(2))
    await settle()
    expect(listCalls()).toBe(2)
    expect(focus.effectRuns).toBe(1)
  })

  it('F4 离开屏不触发刷新', async () => {
    render(createElement(I18nProvider, null, createElement(CheckinAssistantScreen)))
    await waitFor(() => expect(screen.queryByText('号 1')).toBeTruthy())

    leave()
    await settle()
    expect(listCalls()).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
