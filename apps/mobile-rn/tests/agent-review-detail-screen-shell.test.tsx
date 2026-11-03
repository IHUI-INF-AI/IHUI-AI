// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AgentReview 列表/详情薄壳契约测试。
 *
 * 判两件事：① 列表条目点击真的带 item 跳 AgentReviewDetail（不是假可点）；
 * ② 详情壳把 route item / onBack / 缺参错误态交给共享详情屏。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import {
  agentReviewDetailScreenPropsCaptured,
  agentReviewListScreenPropsCaptured,
} from './__mocks__/ihui-rn-app'

const { navMocks, apiMock } = vi.hoisted(() => ({
  navMocks: {
    navigate: vi.fn(),
    goBack: vi.fn(),
    params: {} as Record<string, unknown>,
  },
  apiMock: { fetchApi: vi.fn() },
}))

vi.mock('@ihui/api-client', () => ({ fetchApi: apiMock.fetchApi }))
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: navMocks.navigate, goBack: navMocks.goBack }),
  useRoute: () => ({ params: navMocks.params }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t, locale: 'zh-CN' }) }
})

import { AgentReviewListScreen } from '../src/screens/AgentReviewListScreen'
import { AgentReviewDetailScreen } from '../src/screens/AgentReviewDetailScreen'

const ITEM = {
  id: 'r1',
  agentName: '写作助手',
  author: '用户A',
  rating: 5,
  content: '很好用',
  createdAt: '2026-10-01T00:00:00.000Z',
}

describe('AgentReview 薄壳', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    agentReviewListScreenPropsCaptured.length = 0
    agentReviewDetailScreenPropsCaptured.length = 0
    navMocks.params = {}
    apiMock.fetchApi.mockResolvedValue({ success: true, data: [ITEM] })
  })

  it('列表条目点击 → AgentReviewDetail（携带 item，不是静默吞点击）', async () => {
    render(<AgentReviewListScreen />)
    await waitFor(() => {
      expect(agentReviewListScreenPropsCaptured.length).toBeGreaterThan(0)
    })
    const props = agentReviewListScreenPropsCaptured[agentReviewListScreenPropsCaptured.length - 1]!
    expect(typeof props.onItemPress).toBe('function')
    ;(props.onItemPress as (item: unknown) => void)(ITEM)
    expect(navMocks.navigate).toHaveBeenCalledWith(
      'AgentReviewDetail',
      expect.objectContaining({ item: expect.objectContaining({ id: 'r1' }) }),
    )
  })

  it('详情壳透传 route item 与 onBack', () => {
    navMocks.params = { item: ITEM }
    render(<AgentReviewDetailScreen />)
    const props = agentReviewDetailScreenPropsCaptured[agentReviewDetailScreenPropsCaptured.length - 1]!
    expect(props.item).toEqual(ITEM)
    expect(props.error).toBe('')
    expect(props.loading).toBe(false)
    ;(props.onBack as () => void)()
    expect(navMocks.goBack).toHaveBeenCalledTimes(1)
  })

  it('缺 item 时降级为错误态（不渲染空详情）', () => {
    navMocks.params = {}
    render(<AgentReviewDetailScreen />)
    const props = agentReviewDetailScreenPropsCaptured[agentReviewDetailScreenPropsCaptured.length - 1]!
    expect(props.item).toBeUndefined()
    expect(props.error).toBe('agentReviewDetail.empty')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
