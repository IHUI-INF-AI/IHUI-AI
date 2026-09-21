// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { type ReactNode } from 'react'
import { I18nProvider } from '../src/i18n'

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react')
  const mk = (name: string) =>
    function MockComp(props: {
      children?: ReactNode
      style?: unknown
      onPress?: () => void
      [k: string]: unknown
    }) {
      const { style, onPress, ...rest } = props
      const mergedStyle = Array.isArray(style)
        ? Object.assign({}, ...(style.filter(Boolean) as Record<string, unknown>[]))
        : style
      return h(name, { ...rest, onClick: onPress, style: mergedStyle }, props.children)
    }
  return {
    View: mk('div'),
    Text: mk('span'),
    TouchableOpacity: mk('button'),
    Image: mk('img'),
    ScrollView: mk('div'),
    StyleSheet: { create: (s: Record<string, unknown>) => s },
  }
})

import MyAgents, { type MyAgentItem } from '../src/components/MyAgents'

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

const mockItems: MyAgentItem[] = [
  { agentId: '1', agentName: 'AI客服', avatar: 'https://example.com/1.jpg' },
  { agentId: '2', agentName: 'AI写作', avatar: undefined },
  { id: '3', name: '旧ID兼容', avatar: undefined },
]

describe('MyAgents (mobile-rn)', () => {
  it('renders without crashing', () => {
    const { container } = render(<MyAgents items={[]} onItemClick={() => {}} />, { wrapper })
    expect(container).toBeTruthy()
  })

  it('renders title "我的AI APP"', () => {
    const { getByText } = render(<MyAgents items={[]} onItemClick={() => {}} />, { wrapper })
    expect(getByText('我的AI APP')).toBeTruthy()
  })

  it('shows empty state when items is empty', () => {
    const { getByText } = render(<MyAgents items={[]} onItemClick={() => {}} />, { wrapper })
    expect(getByText('暂无智能体')).toBeTruthy()
  })

  it('renders agent items with names', () => {
    const { getByText } = render(<MyAgents items={mockItems} onItemClick={() => {}} />, { wrapper })
    expect(getByText('AI客服')).toBeTruthy()
    expect(getByText('AI写作')).toBeTruthy()
    expect(getByText('旧ID兼容')).toBeTruthy()
  })

  it('calls onItemClick when item is pressed', () => {
    const handler = vi.fn()
    const { getByText } = render(<MyAgents items={mockItems} onItemClick={handler} />, { wrapper })
    fireEvent.click(getByText('AI客服'))
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: '1', agentName: 'AI客服' }),
    )
  })

  it('hides team button when onTeamPress not provided', () => {
    const { queryByText } = render(<MyAgents items={[]} onItemClick={() => {}} />, { wrapper })
    expect(queryByText('我的AI员工')).toBeNull()
  })

  it('shows team button when onTeamPress is provided', () => {
    const { getByText } = render(
      <MyAgents items={[]} onItemClick={() => {}} onTeamPress={() => {}} />,
      { wrapper },
    )
    expect(getByText('我的AI员工')).toBeTruthy()
  })

  it('calls onTeamPress when team button is pressed', () => {
    const teamHandler = vi.fn()
    const { getByText } = render(
      <MyAgents items={[]} onItemClick={() => {}} onTeamPress={teamHandler} />,
      { wrapper },
    )
    fireEvent.click(getByText('我的AI员工'))
    expect(teamHandler).toHaveBeenCalledTimes(1)
  })

  it('uses first char of name as fallback text for missing avatar', () => {
    const items = [{ agentId: '1', agentName: '小王', avatar: undefined }]
    const { getByText } = render(<MyAgents items={items} onItemClick={() => {}} />, { wrapper })
    expect(getByText('小')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
