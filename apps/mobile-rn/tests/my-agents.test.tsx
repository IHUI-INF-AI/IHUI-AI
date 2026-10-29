// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { type ReactNode } from 'react'
import { I18nProvider } from '../src/i18n'

// 不再自带 vi.mock('react-native') 工厂:它遮蔽 vitest.config.ts 的 alias 替身
// tests/__mocks__/react-native.ts,替身补了 PixelRatio 而内联副本没有 ⇒ MoreLink 一渲染即抛。
// 共享替身是本工厂的严格超集(同款 mk 组件/onPress→onClick/样式合并/Appearance/DevSettings/
// StyleSheet,另含 PixelRatio/Platform/FlatList/Pressable 等),断言语义不变。

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
