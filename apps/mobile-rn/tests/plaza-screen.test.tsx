/**
 * PlazaScreen 需求广场测试
 *
 * 覆盖(对齐 Uniapp pagesA/plaza/index.vue):
 * - 需求列表加载(getPlazaList)
 * - 需求赛道筛选弹层(getAgentCategories → categorySaidao):
 *   打开/选项渲染/选中后按 categories 重新加载/API 失败 fallback
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    getPlazaList: vi.fn(),
    getAgentCategories: vi.fn(),
    listConversations: vi.fn(),
    deleteConversation: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  getPlazaList: apiMocks.getPlazaList,
  getAgentCategories: apiMocks.getAgentCategories,
  listConversations: apiMocks.listConversations,
  deleteConversation: apiMocks.deleteConversation,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: apiMocks.navigate,
    goBack: apiMocks.goBack,
    getParent: () => ({ navigate: apiMocks.navigate }),
  }),
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', nickname: '测试' } }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

// features 共享层 PlazaScreen 骨架(渲染列表+搜索+状态筛选)
vi.mock('@ihui/rn-app', async () => {
  const { createElement: h } = await import('react')
  return {
    PlazaScreen: (props: { items?: { id: string; title: string }[]; [k: string]: unknown }) =>
      h(
        'div',
        null,
        (props.items ?? []).map((i: { id: string; title: string }) =>
          h('span', { key: i.id, 'data-testid': 'plaza-item' }, i.title),
        ),
      ),
  }
})

vi.mock('../src/components/Drawer', () => ({
  default: () => null,
  Drawer: () => null,
}))

vi.mock('../src/components/FloatBox', () => ({
  FloatBox: () => null,
}))

vi.mock('../src/components/NavBar', async () => {
  const { createElement: h } = await import('react')
  return {
    NavBar: (props: {
      title?: string
      rightActions?: { icon?: string; label?: string; onPress?: () => void }[]
    }) =>
      h(
        'div',
        { 'data-testid': 'navbar' },
        (props.rightActions ?? []).map((a, i) =>
          h('button', { key: i, onClick: a.onPress }, a.label || a.icon),
        ),
      ),
  }
})

import { PlazaScreen } from '../src/screens/PlazaScreen'

const mockItem = { id: 'p1', title: '需要一个AI客服', status: '2', price: 100 }

describe('PlazaScreen 需求广场', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getPlazaList.mockResolvedValue({ success: true, data: { list: [mockItem], total: 1 } })
    apiMocks.getAgentCategories.mockResolvedValue({
      success: true,
      data: {
        agentCategory: [
          { id: 'tech', name: '技术' },
          { id: 'edu', name: '教育' },
        ],
      },
    })
    apiMocks.listConversations.mockResolvedValue({ success: true, data: { conversations: [] } })
  })

  it('加载需求列表', async () => {
    const { getAllByTestId } = render(<PlazaScreen />)

    await waitFor(() => {
      expect(apiMocks.getPlazaList).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(getAllByTestId('plaza-item').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('点击分类按钮打开赛道弹层', async () => {
    const { getByText } = render(<PlazaScreen />)

    await waitFor(() => {
      expect(apiMocks.getAgentCategories).toHaveBeenCalled()
    })
    // 找到 NavBar 右按钮(分类按钮 label)
    const catBtn = getByText('分类')
    fireEvent.click(catBtn)

    await waitFor(() => expect(getByText('全公司')).toBeTruthy())
    expect(getByText('技术')).toBeTruthy()
    expect(getByText('教育')).toBeTruthy()
  })

  it('选中赛道后 getPlazaList 带 categories 参数', async () => {
    const { getByText } = render(<PlazaScreen />)

    await waitFor(() => {
      expect(apiMocks.getAgentCategories).toHaveBeenCalled()
    })
    const catBtn = getByText('分类')
    fireEvent.click(catBtn)
    await waitFor(() => expect(getByText('技术')).toBeTruthy())
    fireEvent.click(getByText('技术'))

    await waitFor(() => {
      const lastCall = apiMocks.getPlazaList.mock.calls[
        apiMocks.getPlazaList.mock.calls.length - 1
      ] as [unknown]
      const params = lastCall[0] as { categories?: string[] }
      expect(params.categories).toEqual(['tech'])
    })
  })

  it('分类 API 失败时 fallback 赛道仍可用', async () => {
    apiMocks.getAgentCategories.mockRejectedValue(new Error('network'))
    const { getByText } = render(<PlazaScreen />)

    await waitFor(() => {
      expect(apiMocks.getAgentCategories).toHaveBeenCalled()
    })
    const catBtn = getByText('分类')
    fireEvent.click(catBtn)

    await waitFor(() => expect(getByText('全公司')).toBeTruthy())
    expect(getByText('技术')).toBeTruthy()
  })
})
