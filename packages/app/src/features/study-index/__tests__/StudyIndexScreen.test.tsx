// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudyIndexScreen, type StudyIndexScreenProps } from '../StudyIndexScreen'

const baseProps: StudyIndexScreenProps = {
  items: [],
  refreshing: false,
  loadingMore: false,
  error: '',
  total: 0,
  searchInput: '',
  showSearch: false,
  pageType: 'study',
  activeCategory: 'all',
  previewModels: [],
  previewItems: [],
  initialLoading: false,
  trackCategories: [],
  onRefresh: vi.fn(),
  onEndReached: vi.fn(),
  onSubmitSearch: vi.fn(),
  onSearchInputChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onViewMoreModels: vi.fn(),
  onViewMoreCourses: vi.fn(),
  retryText: '重试',
  emptyText: '暂无内容',
  noMoreText: '没有更多',
  loadingText: '加载中',
  loadingMoreText: '加载更多',
}

afterEach(cleanup)

describe('StudyIndexScreen 发布 FAB', () => {
  it('缺省不渲染 FAB', () => {
    render(<StudyIndexScreen {...baseProps} />)
    expect(screen.queryByLabelText('发布视频')).toBeNull()
  })

  it('注入 onPublish 后渲染 FAB 并触发', () => {
    const onPublish = vi.fn()
    render(<StudyIndexScreen {...baseProps} onPublish={onPublish} />)
    fireEvent.click(screen.getByLabelText('发布视频'))
    expect(onPublish).toHaveBeenCalledTimes(1)
  })
})
