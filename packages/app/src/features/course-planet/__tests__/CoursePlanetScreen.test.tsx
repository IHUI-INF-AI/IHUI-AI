// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CoursePlanetScreenProps } from '@ihui/types'
import type { TFunction } from '@ihui/types'
import { CoursePlanetScreen, type CoursePlanetMenuEntry } from '../CoursePlanetScreen'

const t = ((key: string) => key) as unknown as TFunction

/**
 * 测试桩:共享屏只消费调用方解析好的明暗档案(真机值来自 ThemeContext.resolvedTheme);
 * 单测固定浅色,避免组件静默落回形参默认值。
 */
const TEST_COLOR_SCHEME: 'light' | 'dark' = 'light'

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
  colorScheme: TEST_COLOR_SCHEME,
}

const menuItems: CoursePlanetMenuEntry[] = [
  { id: '1', label: 'AI 图片' },
  { id: '2', label: 'AI 视频' },
]

afterEach(cleanup)

describe('CoursePlanetScreen 可选能力', () => {
  it('缺省不渲染轮播与菜单', () => {
    render(<CoursePlanetScreen {...baseProps} />)
    expect(screen.queryByLabelText('轮播图')).toBeNull()
    expect(screen.queryByText('AI 图片')).toBeNull()
  })

  it('注入轮播与菜单后各自渲染', () => {
    render(
      <CoursePlanetScreen
        {...baseProps}
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
    render(<CoursePlanetScreen {...baseProps} menuItems={menuItems} onMenuPress={onMenuPress} />)
    fireEvent.click(screen.getByLabelText('AI 视频'))
    expect(onMenuPress).toHaveBeenCalledWith(menuItems[1])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
