// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MoreCourseScreenProps, TFunction } from '@ihui/types'
import { MoreCourseScreen } from '../MoreCourseScreen'

const t = ((key: string) => key) as unknown as TFunction

/**
 * 测试桩:共享屏只消费调用方解析好的明暗档案(真机值来自 ThemeContext.resolvedTheme);
 * 单测固定浅色,避免组件静默落回形参默认值。
 */
const TEST_COLOR_SCHEME: 'light' | 'dark' = 'light'

const baseProps: MoreCourseScreenProps = {
  t,
  items: [],
  loading: false,
  refreshing: false,
  loadingMore: false,
  error: '',
  total: 0,
  onRefresh: vi.fn(),
  onEndReached: vi.fn(),
  onPressItem: vi.fn(),
  onBack: vi.fn(),
  colorScheme: TEST_COLOR_SCHEME,
}

afterEach(cleanup)

describe('MoreCourseScreen 可选能力', () => {
  it('缺省不渲染轮播与知识星球区块', () => {
    render(<MoreCourseScreen {...baseProps} />)
    expect(screen.queryByLabelText('轮播图')).toBeNull()
    expect(screen.queryByText('知识星球')).toBeNull()
  })

  it('注入 bannerImages 后渲染轮播', () => {
    render(<MoreCourseScreen {...baseProps} bannerImages={[{ uri: 'a.jpg' }, { uri: 'b.jpg' }]} />)
    expect(screen.getAllByLabelText(/轮播图 \d/)).toHaveLength(2)
  })

  it('注入 planet 后渲染入口与资讯，点击走端口', () => {
    const onEnter = vi.fn()
    const onItemPress = vi.fn()
    render(
      <MoreCourseScreen
        {...baseProps}
        planet={{
          items: [
            { id: 'n1', title: '星球资讯一', summary: '摘要', createdAt: 1 },
            { id: 'n2', title: '星球资讯二', createdAt: 2 },
          ],
          onEnter,
          onItemPress,
        }}
      />,
    )
    expect(screen.getByText('知识星球')).toBeTruthy()
    expect(screen.getByText('星球资讯一')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('进入星球'))
    expect(onEnter).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('星球资讯二'))
    expect(onItemPress).toHaveBeenCalledWith('n2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
