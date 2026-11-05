// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CoursePlanetScreenProps } from '@ihui/types'
import type { TFunction } from '@ihui/types'
import { CoursePlanetScreen, type CoursePlanetMenuEntry } from '../CoursePlanetScreen'

const t = ((key: string) => key) as unknown as TFunction

// 守门 theme-prop-wiring：主题驱动组件的每个渲染点都必须显式接线（字面量与漏传同红）。
// 测试固定 light 档取语义一致，用变量传，不写 JSX 字面量。
const testColorScheme: 'light' | 'dark' = 'light'

const baseProps: CoursePlanetScreenProps = {
  t,
  data: { hot: [], beginner: [], selected: [] },
  loading: false,
  refreshing: false,
  error: '',
  selectedType: 'all',
  onTypeChange: vi.fn(),
  onCoursePress: vi.fn(),
  onRefresh: vi.fn(),
  onBack: vi.fn(),
}

const menuItems: CoursePlanetMenuEntry[] = [
  { id: '1', label: 'AI 图片' },
  { id: '2', label: 'AI 视频' },
]

afterEach(cleanup)

describe('CoursePlanetScreen 可选能力', () => {
  it('缺省不渲染轮播与菜单', () => {
    render(<CoursePlanetScreen {...baseProps} colorScheme={testColorScheme} />)
    expect(screen.queryByLabelText('轮播图')).toBeNull()
    expect(screen.queryByText('AI 图片')).toBeNull()
  })

  it('注入轮播与菜单后各自渲染', () => {
    render(
      <CoursePlanetScreen
        {...baseProps}
        colorScheme={testColorScheme}
        bannerImages={[{ uri: 'a.jpg' }, { uri: 'b.jpg' }, { uri: 'c.jpg' }]}
        menuItems={menuItems}
        onMenuPress={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('轮播图')).toBeTruthy()
    expect(screen.getAllByLabelText(/轮播图 \d/)).toHaveLength(3)
    expect(screen.getByLabelText('AI 图片')).toBeTruthy()
    expect(screen.getByLabelText('AI 视频')).toBeTruthy()
  })

  it('点击菜单项回调携带该项', () => {
    const onMenuPress = vi.fn()
    render(
      <CoursePlanetScreen
        {...baseProps}
        colorScheme={testColorScheme}
        menuItems={menuItems}
        onMenuPress={onMenuPress}
      />,
    )
    fireEvent.click(screen.getByLabelText('AI 视频'))
    expect(onMenuPress).toHaveBeenCalledWith(menuItems[1])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
