// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MoreCourseScreen 薄壳契约测试。
 *
 * 判的是壳侧职责:分页取数(reload / refresh / loadMore)、映射收窄、端口真实透传。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { moreCourseScreenPropsCaptured } from './__mocks__/ihui-rn-app'

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: { getCourses: vi.fn(), navigate: vi.fn(), goBack: vi.fn() },
}))

vi.mock('@ihui/api-client', () => ({ getCourses: apiMocks.getCourses }))
vi.mock('@ihui/shared/utils', () => ({
  toUserFriendlyMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  apiFailureToError: (res: { error?: string }) => new Error(res.error ?? 'api failed'),
}))
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: apiMocks.navigate, goBack: apiMocks.goBack }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t }) }
})
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

import { MoreCourseScreen } from '../src/screens/MoreCourseScreen'

function course(id: string, title: string) {
  return {
    id,
    title,
    cover: null,
    description: '',
    categoryId: null,
    categoryName: null,
    instructor: '讲师',
    price: 0,
    originalPrice: null,
    lessonCount: 1,
    studentCount: 0,
    isFree: true,
    difficulty: null,
    level: '',
    isEnrolled: false,
    createdAt: '',
    updatedAt: '',
  }
}

const PAGE_1 = [course('c1', '第一课'), course('c2', '第二课')]
const PAGE_2 = [course('c3', '第三课')]

function lastProps(): Record<string, unknown> {
  return moreCourseScreenPropsCaptured[moreCourseScreenPropsCaptured.length - 1]!
}

async function renderLoaded() {
  render(<MoreCourseScreen />)
  await waitFor(() => {
    expect(lastProps().loading).toBe(false)
  })
}

describe('MoreCourseScreen 薄壳', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    moreCourseScreenPropsCaptured.length = 0
    apiMocks.getCourses.mockImplementation(({ page }: { page: number }) =>
      Promise.resolve({
        success: true,
        data: page === 1 ? { list: PAGE_1, total: 3 } : { list: PAGE_2, total: 3 },
      }),
    )
  })

  afterEach(() => {
    moreCourseScreenPropsCaptured.length = 0
  })

  it('挂载即取第 1 页(pageSize=10)', async () => {
    render(<MoreCourseScreen />)
    await waitFor(() => {
      expect(apiMocks.getCourses).toHaveBeenCalledWith({ page: 1, pageSize: 10 })
    })
  })

  it('共享屏收到映射后的 items/total/loading/colorScheme', async () => {
    await renderLoaded()
    const props = lastProps()
    expect((props.items as Array<Record<string, unknown>>).map((i) => i.id)).toEqual(['c1', 'c2'])
    expect(props.total).toBe(3)
    expect(props.error).toBe('')
    expect(props.colorScheme).toBe('light')
  })

  it('onEndReached 取下一页并追加去重', async () => {
    await renderLoaded()
    ;(lastProps().onEndReached as () => void)()
    await waitFor(() => {
      expect(apiMocks.getCourses).toHaveBeenCalledWith({ page: 2, pageSize: 10 })
    })
    await waitFor(() => {
      expect((lastProps().items as Array<Record<string, unknown>>).map((i) => i.id)).toEqual([
        'c1',
        'c2',
        'c3',
      ])
    })
  })

  it('onRetry 独立绑定真实重取(不是 onRefresh 别名)', async () => {
    await renderLoaded()
    expect(apiMocks.getCourses).toHaveBeenCalledTimes(1)
    const retry = lastProps().onRetry as () => void
    retry()
    await waitFor(() => {
      expect(apiMocks.getCourses).toHaveBeenCalledTimes(2)
      expect(apiMocks.getCourses).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 })
    })
  })

  it('onPressItem/onBack 透传到导航', async () => {
    await renderLoaded()
    const props = lastProps()
    ;(props.onPressItem as (item: { id: string }) => void)({ id: 'c1' })
    expect(apiMocks.navigate).toHaveBeenCalledWith('CourseDetail', { id: 'c1' })
    ;(props.onBack as () => void)()
    expect(apiMocks.goBack).toHaveBeenCalledTimes(1)
  })

  it('接口 success:false 时透出服务端原因', async () => {
    apiMocks.getCourses.mockResolvedValue({ success: false, error: '课程服务不可用' })
    render(<MoreCourseScreen />)
    await waitFor(() => {
      expect(lastProps().error).toBe('课程服务不可用')
    })
  })
})
