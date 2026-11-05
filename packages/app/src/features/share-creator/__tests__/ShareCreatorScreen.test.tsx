// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareCreatorScreen } from '../ShareCreatorScreen'
import type { ShareCreatorScreenProps } from '../types'
import type { TFunction } from '../../../types'

const t = ((key: string) => key) as unknown as TFunction

const baseProps: ShareCreatorScreenProps = {
  t,
  colorScheme: 'light',
  items: [],
  loading: false,
  refreshing: false,
  error: '',
  onRefresh: vi.fn(),
  onPressItem: vi.fn(),
  categories: [],
  activeCategory: '',
}

const items = [
  {
    id: 'a1',
    title: '分享创作一',
    summary: '摘要',
    authorName: '作者甲',
    createdAt: '2026-11-01T00:00:00Z',
  },
  {
    id: 'a2',
    title: '分享创作二',
    summary: '摘要二',
    authorName: '作者乙',
    createdAt: '2026-11-02T00:00:00Z',
  },
]

afterEach(cleanup)

describe('ShareCreatorScreen 段级单测', () => {
  // B2 分类横条:渲染 + 切换回调(与 SquareScreen 同一份 CategoryInlineBar)
  it('B2 渲染分类横条并回调 onSelectCategory', () => {
    const onSelectCategory = vi.fn()
    render(
      <ShareCreatorScreen
        {...baseProps}
        categories={[
          { id: 'all', label: '全部' },
          { id: 'tech', label: '科技' },
        ]}
        activeCategory="all"
        onSelectCategory={onSelectCategory}
      />,
    )
    fireEvent.click(screen.getByText('科技'))
    expect(onSelectCategory).toHaveBeenCalledWith('tech')
  })

  // B4 信息流:条目渲染 + 点击回调
  it('B4 渲染信息流条目并回调 onPressItem', () => {
    const onPressItem = vi.fn()
    render(<ShareCreatorScreen {...baseProps} items={items} onPressItem={onPressItem} />)
    expect(screen.getByText('分享创作一')).toBeTruthy()
    fireEvent.click(screen.getByText('分享创作一'))
    expect(onPressItem).toHaveBeenCalledWith('a1')
  })

  // B4 空态:无条目时走共享屏 EmptyState,不出现条目
  it('B4 无条目时渲染空态', () => {
    render(<ShareCreatorScreen {...baseProps} items={[]} />)
    expect(screen.queryByText('分享创作一')).toBeNull()
  })

  // B8 返回:传 onBack 才渲染自带 header,点击回调
  it('B8 传 onBack 渲染 header 并回调', () => {
    const onBack = vi.fn()
    render(<ShareCreatorScreen {...baseProps} onBack={onBack} />)
    fireEvent.click(screen.getByLabelText('common.back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  // 阴性对照配套:不传 onBack 时不渲染自带 header(避免与 NavBar 双标题)
  it('B8 不传 onBack 时不渲染自带 header', () => {
    render(<ShareCreatorScreen {...baseProps} />)
    expect(screen.queryByLabelText('common.back')).toBeNull()
  })
})
