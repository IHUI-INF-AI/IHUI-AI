// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { FileNode } from '@ihui/types'

// useIDEWorkspace 返回的可变状态容器(每个用例 beforeEach 重置)
const mockStore = vi.hoisted(() => ({
  state: {
    activeView: 'files',
    fileTree: [] as FileNode[],
    loading: false,
    error: null as string | null,
    workspacePath: '/ws',
    openFile: vi.fn(),
    selectFile: vi.fn(),
    fetchFileTree: vi.fn(),
    toggleFolder: vi.fn(),
    expandedFolders: new Set<string>(),
    selectedFileId: null as string | null,
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

import { FileExplorer } from '../file-explorer'

describe('FileExplorer', () => {
  beforeEach(() => {
    mockStore.state = {
      activeView: 'files',
      fileTree: [],
      loading: false,
      error: null,
      workspacePath: '/ws',
      openFile: vi.fn(),
      selectFile: vi.fn(),
      fetchFileTree: vi.fn().mockResolvedValue(undefined),
      toggleFolder: vi.fn(),
      expandedFolders: new Set<string>(),
      selectedFileId: null,
    }
  })
  afterEach(() => cleanup())

  it('正常渲染:Tab 按钮 + 搜索框 + 空文件树提示', () => {
    const { getByText, getByPlaceholderText } = render(<FileExplorer />)
    // 三个子标签
    expect(getByText('fileExplorer.tabFiles')).not.toBeNull()
    expect(getByText('fileExplorer.tabOutline')).not.toBeNull()
    expect(getByText('fileExplorer.tabTimeline')).not.toBeNull()
    // 搜索框(files 子标签下)
    expect(getByPlaceholderText('fileExplorer.searchPlaceholder')).not.toBeNull()
    // 空文件树(fileTree.length === 0)→ 显示 noMatch
    expect(getByText('fileExplorer.noMatch')).not.toBeNull()
  })

  it('activeView 非 files 时不渲染', () => {
    mockStore.state.activeView = 'debug'
    const { container } = render(<FileExplorer />)
    expect(container.firstChild).toBeNull()
  })

  it('无工作区时显示空状态提示', () => {
    mockStore.state.workspacePath = ''
    const { getByText } = render(<FileExplorer />)
    expect(getByText('editorEmpty.subtitle')).not.toBeNull()
  })

  it('加载中显示 ... 占位', () => {
    mockStore.state.workspacePath = '/ws'
    mockStore.state.loading = true
    const { getByText } = render(<FileExplorer />)
    expect(getByText('...')).not.toBeNull()
  })

  it('错误状态显示 error 文本', () => {
    mockStore.state.workspacePath = '/ws'
    mockStore.state.error = '加载失败'
    const { getByText } = render(<FileExplorer />)
    expect(getByText('加载失败')).not.toBeNull()
  })

  it('文件夹点击触发 toggleFolder 回调', () => {
    mockStore.state.workspacePath = '/ws'
    mockStore.state.fileTree = [
      { id: 'f1', name: 'src', path: '/ws/src', type: 'folder', children: [] },
    ]
    const { getByText } = render(<FileExplorer />)
    fireEvent.click(getByText('src'))
    expect(mockStore.state.toggleFolder).toHaveBeenCalledWith('f1')
  })

  it('文件点击触发 selectFile + openFile 回调', () => {
    mockStore.state.workspacePath = '/ws'
    const fileNode: FileNode = {
      id: 'file-1',
      name: 'app.ts',
      path: '/ws/app.ts',
      type: 'file',
      language: 'typescript',
    }
    mockStore.state.fileTree = [fileNode]
    const { getByText } = render(<FileExplorer />)
    fireEvent.click(getByText('app.ts'))
    expect(mockStore.state.selectFile).toHaveBeenCalledWith('file-1')
    expect(mockStore.state.openFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'file-1', name: 'app.ts', type: 'file' }),
    )
  })

  it('搜索框输入关键词过滤出匹配文件', () => {
    mockStore.state.workspacePath = '/ws'
    mockStore.state.fileTree = [
      { id: 'f1', name: 'app.ts', path: '/ws/app.ts', type: 'file' },
      { id: 'f2', name: 'readme.md', path: '/ws/readme.md', type: 'file' },
    ]
    const { getByPlaceholderText, getByText, queryByText } = render(<FileExplorer />)
    const input = getByPlaceholderText('fileExplorer.searchPlaceholder')
    fireEvent.change(input, { target: { value: 'app' } })
    // 命中 app.ts:highlightMatch 把 'app' 拆为高亮 span,后缀 '.ts' 为独立文本节点
    expect(getByText('app')).not.toBeNull()
    expect(getByText('.ts')).not.toBeNull()
    // 不命中 readme.md:readme 文本不存在
    expect(queryByText('readme')).toBeNull()
  })

  it('搜索无匹配显示 noMatch', () => {
    mockStore.state.workspacePath = '/ws'
    mockStore.state.fileTree = [
      { id: 'f1', name: 'app.ts', path: '/ws/app.ts', type: 'file' },
    ]
    const { getByPlaceholderText, getByText } = render(<FileExplorer />)
    fireEvent.change(getByPlaceholderText('fileExplorer.searchPlaceholder'), {
      target: { value: 'zzz' },
    })
    expect(getByText('fileExplorer.noMatch')).not.toBeNull()
  })

  it('刷新按钮点击触发 fetchFileTree', () => {
    mockStore.state.workspacePath = '/ws'
    const { getByTitle } = render(<FileExplorer />)
    fireEvent.click(getByTitle('fileExplorer.refresh'))
    expect(mockStore.state.fetchFileTree).toHaveBeenCalled()
  })
})
