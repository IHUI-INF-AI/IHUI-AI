// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup, waitFor } from '@testing-library/react'

// useIDEWorkspace 返回的可变状态容器(每个用例 beforeEach 重置)
const mockStore = vi.hoisted(() => ({
  state: {
    activeView: 'search',
    workspacePath: '/ws',
  },
}))

// next-intl:返回 key 字面值,使 getByText / getByRole 能按 key 定位
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

vi.mock('@/stores/ide-workspace', () => ({
  useIDEWorkspace: () => mockStore.state,
}))

// grepFiles mock
const grepMock = vi.hoisted(() => ({ grepFiles: vi.fn() }))
vi.mock('@ihui/api-client', () => ({ grepFiles: grepMock.grepFiles }))

import { SearchPanel } from '../search-panel'

describe('SearchPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    mockStore.state = { activeView: 'search', workspacePath: '/ws' }
    grepMock.grepFiles.mockReset()
  })
  afterEach(() => cleanup())

  it('正常渲染:搜索框 + 替换切换 + 文件类型筛选 + 初始提示', () => {
    const { getByPlaceholderText, getByRole, getByText } = render(<SearchPanel />)
    // 搜索框
    expect(getByPlaceholderText('searchPanel.searchPlaceholder')).not.toBeNull()
    // 替换切换按钮 + 三个选项开关
    expect(getByRole('button', { name: 'searchPanel.toggleReplace' })).not.toBeNull()
    expect(getByRole('button', { name: 'searchPanel.caseSensitive' })).not.toBeNull()
    expect(getByRole('button', { name: 'searchPanel.wholeWord' })).not.toBeNull()
    expect(getByRole('button', { name: 'searchPanel.useRegex' })).not.toBeNull()
    // 文件类型筛选(filterAll 走 i18n,其余走字面 label)
    expect(getByText('searchPanel.filterAll')).not.toBeNull()
    expect(getByText('TSX')).not.toBeNull()
    expect(getByText('CSS')).not.toBeNull()
    // 初始无输入 → inputHint
    expect(getByText('searchPanel.inputHint')).not.toBeNull()
  })

  it('activeView 非 search 时不渲染', () => {
    mockStore.state.activeView = 'files'
    const { container } = render(<SearchPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('无工作区时显示「请先打开工作区」', () => {
    mockStore.state.workspacePath = ''
    const { getByText } = render(<SearchPanel />)
    expect(getByText('请先打开工作区')).not.toBeNull()
  })

  it('输入并回车触发 grepFiles', async () => {
    grepMock.grepFiles.mockResolvedValue({ success: true, data: { results: [] } })
    const { getByPlaceholderText } = render(<SearchPanel />)
    const input = getByPlaceholderText('searchPanel.searchPlaceholder')
    fireEvent.change(input, { target: { value: 'foo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(grepMock.grepFiles).toHaveBeenCalled())
    expect(grepMock.grepFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        workspacePath: '/ws',
        pattern: 'foo',
        outputMode: 'content',
      }),
    )
  })

  it('搜索结果显示:文件名 + 行号 + 预览 + 摘要', async () => {
    grepMock.grepFiles.mockResolvedValue({
      success: true,
      data: {
        results: [
          { file: '/ws/src/app.ts', line: 10, content: 'const foo = 1' },
          { file: '/ws/src/app.ts', line: 20, content: 'foo()' },
        ],
      },
    })
    const { getByPlaceholderText, getByText } = render(<SearchPanel />)
    const input = getByPlaceholderText('searchPanel.searchPlaceholder')
    fireEvent.change(input, { target: { value: 'foo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(getByText('app.ts')).not.toBeNull())
    // 行号 + 预览内容
    expect(getByText('10')).not.toBeNull()
    expect(getByText('const foo = 1')).not.toBeNull()
    // 结果摘要(t mock 忽略插值参数,返回 key 字面值)
    expect(getByText('searchPanel.resultSummary')).not.toBeNull()
  })

  it('搜索无结果时显示 noResults', async () => {
    grepMock.grepFiles.mockResolvedValue({ success: true, data: { results: [] } })
    const { getByPlaceholderText, getByText } = render(<SearchPanel />)
    const input = getByPlaceholderText('searchPanel.searchPlaceholder')
    fireEvent.change(input, { target: { value: 'foo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(getByText('searchPanel.noResults')).not.toBeNull())
  })

  it('清空搜索框后不再显示结果', async () => {
    grepMock.grepFiles.mockResolvedValue({
      success: true,
      data: { results: [{ file: '/ws/app.ts', line: 1, content: 'foo' }] },
    })
    const { getByPlaceholderText, queryByText } = render(<SearchPanel />)
    const input = getByPlaceholderText('searchPanel.searchPlaceholder') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'foo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(queryByText('app.ts')).not.toBeNull())
    // 清空输入
    fireEvent.change(input, { target: { value: '' } })
    // 结果不再渲染(query 为空 → 走 history 分支,文件名消失)
    expect(queryByText('app.ts')).toBeNull()
  })

  it('grepFiles 失败时不抛错且结果为空', async () => {
    grepMock.grepFiles.mockResolvedValue({ success: false, error: 'boom' })
    const { getByPlaceholderText, getByText } = render(<SearchPanel />)
    const input = getByPlaceholderText('searchPanel.searchPlaceholder')
    fireEvent.change(input, { target: { value: 'foo' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // success=false → results=[] → query && searched → noResults
    await waitFor(() => expect(getByText('searchPanel.noResults')).not.toBeNull())
  })

  it('替换面板可切换显示', () => {
    const { getByRole, getByPlaceholderText, queryByPlaceholderText } = render(<SearchPanel />)
    // 初始:替换框不显示
    expect(queryByPlaceholderText('searchPanel.replacePlaceholder')).toBeNull()
    fireEvent.click(getByRole('button', { name: 'searchPanel.toggleReplace' }))
    // 切换后:替换框出现
    expect(getByPlaceholderText('searchPanel.replacePlaceholder')).not.toBeNull()
  })
})
