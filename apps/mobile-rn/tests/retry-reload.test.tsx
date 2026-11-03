// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 真 onRetry 壳级回归:点「重试」必须重新发起同一 loader(fetchApi 调用 ≥2)。
 * 2026-11-03:共享屏曾把 onRetry 接到 onBack/onRefresh,点重试不是退出就是下拉刷新。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'

const fetchApiMock = vi.hoisted(() => vi.fn())
const tMock = vi.hoisted(() => (k: string) => k)
const navMock = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }))

vi.mock('@ihui/api-client', () => ({ fetchApi: fetchApiMock }))
vi.mock('@ihui/rn-app', () => {
  const make = (name: string) => {
    function RetryProbe(props: { onRetry?: () => void }) {
      return createElement(
        'button',
        { 'data-testid': `retry-${name}`, onClick: () => props.onRetry?.() },
        name,
      )
    }
    return RetryProbe
  }
  return {
    ActivityScreen: make('activity'),
    NoteScreen: make('note'),
    CheckInScreen: make('checkin'),
  }
})
vi.mock('../src/components/BottomPops', () => ({ appAlert: vi.fn() }))
vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light', colorScheme: 'light' }),
}))
vi.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 } }) }))
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: tMock }) }))
vi.mock('@react-navigation/native', () => ({ useNavigation: () => navMock }))

import { ActivityScreen } from '../src/screens/ActivityScreen'
import { CheckInScreen } from '../src/screens/CheckInScreen'
import { NoteScreen } from '../src/screens/NoteScreen'

type ShellCase = { name: string; render: () => void }

const CASES: ShellCase[] = [
  { name: 'activity', render: () => render(createElement(ActivityScreen)) },
  { name: 'note', render: () => render(createElement(NoteScreen)) },
  { name: 'checkin', render: () => render(createElement(CheckInScreen)) },
]

describe('真 onRetry:壳侧重新发起同一 loader', () => {
  beforeEach(() => {
    fetchApiMock.mockResolvedValue({ success: true, data: { list: [] } })
  })

  for (const c of CASES) {
    it(`${c.name} 屏点重试触发第二次请求`, async () => {
      c.render()
      await waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(1))
      fireEvent.click(screen.getByTestId(`retry-${c.name}`))
      await waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(2))
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
