// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * StudyIndexScreen 薄壳契约测试。
 *
 * 判的是壳侧职责:视频/模型取数、25 项 props 映射、pageType 三态与返回逻辑、
 * 搜索/分类端口真实生效;共享屏渲染本身由 packages/app 套件负责。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { studyIndexScreenPropsCaptured } from './__mocks__/ihui-rn-app'

const { apiMocks, navBarMock } = vi.hoisted(() => ({
  apiMocks: { fetchApi: vi.fn(), fetchModels: vi.fn(), navigate: vi.fn(), goBack: vi.fn() },
  navBarMock: { props: [] as Array<Record<string, unknown>> },
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: apiMocks.fetchApi,
  fetchModels: apiMocks.fetchModels,
}))
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
vi.mock('../src/components/NavBar', () => ({
  NavBar: (props: Record<string, unknown>) => {
    navBarMock.props.push(props)
    return null
  },
}))
vi.mock('lucide-react-native', () => ({ Search: () => null, X: () => null }))
vi.mock('@ihui/ui-native', () => ({ Tappable: () => null }))

import { StudyIndexScreen } from '../src/screens/StudyIndexScreen'

const VIDEO_ROWS = [
  { id: 'v1', title: '视频一', cover: '', playUrl: '', duration: 10 },
  { id: 'v2', title: '视频二', cover: '', playUrl: '', duration: 20 },
  { id: 'v3', title: '视频三', cover: '', playUrl: '', duration: 30 },
  { id: 'v4', title: '视频四', cover: '', playUrl: '', duration: 40 },
]

const MODEL_ROWS = [
  { id: 'm1', name: '模型一', provider: 'provider-a', context_length: 4096, input_price: 0 },
  { id: 'm2', name: '模型二', provider: 'provider-b', context_length: 8192, input_price: 0.5 },
]

function lastProps(): Record<string, unknown> {
  return studyIndexScreenPropsCaptured[studyIndexScreenPropsCaptured.length - 1]!
}

function lastNavBar(): Record<string, unknown> {
  return navBarMock.props[navBarMock.props.length - 1]!
}

async function renderLoaded() {
  render(<StudyIndexScreen />)
  await waitFor(() => {
    expect(lastProps().initialLoading).toBe(false)
  })
}

describe('StudyIndexScreen 薄壳', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    studyIndexScreenPropsCaptured.length = 0
    navBarMock.props.length = 0
    apiMocks.fetchApi.mockResolvedValue({ success: true, data: { list: VIDEO_ROWS, total: 12 } })
    apiMocks.fetchModels.mockResolvedValue({ models: MODEL_ROWS, default: 'm1', stub_mode: false })
  })

  afterEach(() => {
    studyIndexScreenPropsCaptured.length = 0
    navBarMock.props.length = 0
  })

  it('挂载即取视频第 1 页并拉模型列表', async () => {
    render(<StudyIndexScreen />)
    await waitFor(() => {
      expect(apiMocks.fetchApi).toHaveBeenCalledWith('/api/study/videos', {
        params: { page: 1, pageSize: 10, search: undefined, category: undefined },
      })
      expect(apiMocks.fetchModels).toHaveBeenCalled()
    })
  })

  it('共享屏收到 25 项 props 的关键映射(含预览与文案)', async () => {
    await renderLoaded()
    const props = lastProps()
    expect((props.items as Array<Record<string, unknown>>).map((v) => v.id)).toEqual([
      'v1',
      'v2',
      'v3',
      'v4',
    ])
    expect(props.total).toBe(12)
    expect(props.pageType).toBe('index')
    expect(props.activeCategory).toBe('all')
    expect(props.showSearch).toBe(false)
    await waitFor(() => {
      expect((lastProps().previewModels as unknown[]).length).toBe(2)
    })
    expect((props.previewItems as Array<Record<string, unknown>>).map((v) => v.id)).toEqual([
      'v1',
      'v2',
      'v3',
    ])
    expect(props.previewModels).toEqual([
      { id: 'm1', name: '模型一', description: 'provider-a', isFree: true },
      { id: 'm2', name: '模型二', description: 'provider-b', isFree: false },
    ])
    expect(props.retryText).toBe('重试')
    expect(props.emptyText).toBe('暂无学习视频')
    expect(props.noMoreText).toBe('没有更多了')
    expect(props.loadingMoreText).toBe('加载更多...')
    expect(props.colorScheme).toBe('light')
  })

  it('onViewMoreModels/onViewMoreCourses 切换 pageType', async () => {
    await renderLoaded()
    ;(lastProps().onViewMoreModels as () => void)()
    await waitFor(() => {
      expect(lastProps().pageType).toBe('model')
    })
    ;(lastProps().onViewMoreCourses as () => void)()
    await waitFor(() => {
      expect(lastProps().pageType).toBe('study')
    })
  })

  it('NavBar 返回:非 index 先回 index,index 才退屏', async () => {
    await renderLoaded()
    ;(lastProps().onViewMoreCourses as () => void)()
    await waitFor(() => {
      expect(lastProps().pageType).toBe('study')
    })
    ;(lastNavBar().onBack as () => void)()
    await waitFor(() => {
      expect(lastProps().pageType).toBe('index')
    })
    expect(apiMocks.goBack).not.toHaveBeenCalled()
    ;(lastNavBar().onBack as () => void)()
    expect(apiMocks.goBack).toHaveBeenCalledTimes(1)
  })

  it('搜索提交让 search 参数真实生效', async () => {
    await renderLoaded()
    expect(apiMocks.fetchApi).toHaveBeenCalledTimes(1)
    ;(lastProps().onSearchInputChange as (v: string) => void)('AI')
    await waitFor(() => {
      expect(lastProps().searchInput).toBe('AI')
    })
    ;(lastProps().onSubmitSearch as () => void)()
    await waitFor(() => {
      expect(apiMocks.fetchApi).toHaveBeenLastCalledWith('/api/study/videos', {
        params: { page: 1, pageSize: 10, search: 'AI', category: undefined },
      })
    })
    expect(lastProps().showSearch).toBe(false)
  })

  it('分类切换让 category 参数真实生效', async () => {
    await renderLoaded()
    ;(lastProps().onCategoryChange as (v: string) => void)('douyin')
    await waitFor(() => {
      expect(lastProps().activeCategory).toBe('douyin')
      expect(apiMocks.fetchApi).toHaveBeenLastCalledWith('/api/study/videos', {
        params: { page: 1, pageSize: 10, search: undefined, category: 'douyin' },
      })
    })
  })

  it('onRefresh 触发重取且不影响 pageType', async () => {
    await renderLoaded()
    expect(apiMocks.fetchApi).toHaveBeenCalledTimes(1)
    ;(lastProps().onRefresh as () => void)()
    await waitFor(() => {
      expect(apiMocks.fetchApi).toHaveBeenCalledTimes(2)
      expect(lastProps().pageType).toBe('index')
    })
  })
})
