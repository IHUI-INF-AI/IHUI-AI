// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CoursePlanetScreen 薄壳契约测试。
 *
 * 判的是壳侧职责:取数、状态映射、端口真实透传(含 onRetry 独立重取),
 * 共享屏渲染本身由 packages/app 套件负责(本套件用 props 捕获替身)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { coursePlanetScreenPropsCaptured } from './__mocks__/ihui-rn-app'

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: { fetchApi: vi.fn(), navigate: vi.fn(), goBack: vi.fn() },
}))

vi.mock('@ihui/api-client', () => ({ fetchApi: apiMocks.fetchApi }))
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: apiMocks.navigate, goBack: apiMocks.goBack }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t }) }
})
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('@ihui/shared/utils', () => ({
  toUserFriendlyMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

import { CoursePlanetScreen } from '../src/screens/CoursePlanetScreen'

const DATA = {
  hot: [{ id: 'h1', title: '最新课程', price: 99, isFree: false }],
  beginner: [{ id: 'b1', title: '入门课程', price: 0, isFree: true }],
  selected: [{ id: 's1', title: '精选课程', price: 199, isFree: false }],
}

function lastProps(): Record<string, unknown> {
  return coursePlanetScreenPropsCaptured[coursePlanetScreenPropsCaptured.length - 1]!
}

async function renderLoaded() {
  render(<CoursePlanetScreen />)
  await waitFor(() => {
    expect(lastProps().loading).toBe(false)
  })
}

describe('CoursePlanetScreen 薄壳', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    coursePlanetScreenPropsCaptured.length = 0
    apiMocks.fetchApi.mockResolvedValue({ success: true, data: DATA })
  })

  afterEach(() => {
    coursePlanetScreenPropsCaptured.length = 0
  })

  it('挂载即请求 /api/course-planet', async () => {
    render(<CoursePlanetScreen />)
    await waitFor(() => {
      expect(apiMocks.fetchApi).toHaveBeenCalledWith('/api/course-planet')
    })
  })

  it('共享屏收到 data/loading/refreshing/error/selectedType/colorScheme', async () => {
    await renderLoaded()
    const props = lastProps()
    expect(props.data).toEqual(DATA)
    expect(props.refreshing).toBe(false)
    expect(props.error).toBe('')
    expect(props.selectedType).toBe('all')
    expect(props.colorScheme).toBe('light')
  })

  it('onTypeChange 真实更新 selectedType', async () => {
    await renderLoaded()
    const props = lastProps()
    ;(props.onTypeChange as (v: string) => void)('free')
    await waitFor(() => {
      expect(lastProps().selectedType).toBe('free')
    })
  })

  it('onCoursePress/onBack 透传到导航', async () => {
    await renderLoaded()
    const props = lastProps()
    ;(props.onCoursePress as (id: string) => void)('s1')
    expect(apiMocks.navigate).toHaveBeenCalledWith('CourseDetail', { id: 's1' })
    ;(props.onBack as () => void)()
    expect(apiMocks.goBack).toHaveBeenCalledTimes(1)
  })

  it('onRetry 独立绑定真实重取(不是 onRefresh 别名)', async () => {
    await renderLoaded()
    expect(apiMocks.fetchApi).toHaveBeenCalledTimes(1)
    const retry = lastProps().onRetry as () => Promise<void>
    await retry()
    await waitFor(() => {
      expect(apiMocks.fetchApi).toHaveBeenCalledTimes(2)
    })
  })

  it('接口 success:false 时回退本页通用文案', async () => {
    apiMocks.fetchApi.mockResolvedValue({ success: false })
    render(<CoursePlanetScreen />)
    await waitFor(() => {
      expect(lastProps().error).toBe('common.loadFailPullRetry')
    })
  })
})
