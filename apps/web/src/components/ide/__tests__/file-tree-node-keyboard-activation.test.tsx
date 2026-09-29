// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 票 G-815940(原占 G-815930,2026-09-29 让号):「行级 Enter/Space 激活必须判事件是不是就落在
// 这个可聚焦元素本身」。被审实现 FileTreeNode.tsx 的行容器无条件 preventDefault + handleClick,
// 而行内改名 input 只截断了 onClick、没截断 onKeyDown ⇒ 冒泡上来的空格被行消费,字符被吞。
//
// 三条判据各自的用途(缺一即哑):
//   ① 病灶:改名框里打空格 ⇒ 该键没被 preventDefault(= 浏览器会把字符插进框),value 里真的出现空格;
//   ② 票面要求的成对断言:行的点击/选中回调未被调用(如实登记:修复前后同形,不具判别力,
//      因为 handleClick 首行就有 `if (renaming || deleting) return` 挡「动作」——
//      真正有牙的是 ① 的 preventDefault 那一半,已用变异对照验证);
//   ③ 正向对照:没有 input 聚焦时对折叠行按 Enter / Space ⇒ 仍然切换。少了这一条,
//      判据可以被写成「行永不响应键盘」的哑实现而照样通过。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'
import type { FileNode } from '@ihui/types'

// useIDEWorkspace 返回的可变状态容器(每个用例 beforeEach 重置)
const mockStore = vi.hoisted(() => ({
  state: {
    workspacePath: '/ws',
    openFile: vi.fn(),
    selectFile: vi.fn(),
    fetchFileTree: vi.fn(),
    toggleFolder: vi.fn(),
    expandedFolders: new Set<string>(),
    selectedFileId: null as string | null,
  },
}))

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

// 重命名/删除会走 runCommand;本测试不触发成功路径,mock 掉避免测试环境真发请求
vi.mock('@ihui/api-client', () => ({
  runCommand: vi.fn().mockResolvedValue({ success: false, error: 'not-used-in-this-spec' }),
}))

vi.mock('@/components/common', () => ({ toast: mockToast }))

vi.mock('@/stores/ide-workspace', () => {
  const useIDEWorkspace = () => mockStore.state
  // refreshFileTree 用的是 store 静态口(重命名成功才会走到);补上以免 undefined 冒泡成噪音
  Object.assign(useIDEWorkspace, {
    setState: vi.fn(),
    getState: () => mockStore.state,
  })
  return { useIDEWorkspace }
})

import { FileTreeNode } from '../file-explorer/FileTreeNode'

const FOLDER_NODE: FileNode = {
  id: 'f1',
  name: 'src',
  path: '/ws/src',
  type: 'folder',
  children: [],
}

const FILE_NODE: FileNode = {
  id: 'file-1',
  name: 'app.ts',
  path: '/ws/app.ts',
  type: 'file',
  language: 'typescript',
}

/** 行容器:role=button + tabIndex=0 是本组件里唯一「可聚焦行」的形状 */
function getRow(container: HTMLElement): HTMLElement {
  const row = container.querySelector('div[role="button"][tabindex="0"]')
  if (!row) throw new Error('未找到可聚焦行容器(判据前提失效,不得让它退化成空断言)')
  return row as HTMLElement
}

/** 走真实入口进改名态:右键 → 菜单「重命名」 */
function enterRenaming(container: HTMLElement): HTMLInputElement {
  const row = getRow(container)
  fireEvent.contextMenu(row)
  const renameLabel = Array.from(container.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes('fileTreeNode.rename'),
  )
  if (!renameLabel) throw new Error('右键菜单里找不到「重命名」项')
  fireEvent.click(renameLabel)
  const input = container.querySelector('input')
  if (!input) throw new Error('点击重命名后未出现改名 input')
  return input as HTMLInputElement
}

/**
 * 按浏览器真实时序建模「打一个字符」:默认动作(把字符插进 input)是在冒泡链跑完
 * —— 也就是所有祖先 handler 都能 preventDefault —— 之后才执行的。
 * fireEvent.keyDown 的返回值就是「未被取消」(true = 没被 preventDefault),
 * 因此只有它返回 true 时才等价于浏览器真的把字符追加进 value。
 * 这样「空格被吞掉」在测试里是一个可断言的事实,而不是靠人眼看出来的观感。
 */
function typeChar(el: HTMLInputElement, char: string): boolean {
  const notPrevented = fireEvent.keyDown(el, { key: char })
  if (notPrevented) {
    fireEvent.change(el, { target: { value: `${el.value}${char}` } })
  }
  return notPrevented
}

describe('FileTreeNode 行级键盘激活的「目标判等」(G-815940)', () => {
  beforeEach(() => {
    mockStore.state = {
      workspacePath: '/ws',
      openFile: vi.fn(),
      selectFile: vi.fn(),
      fetchFileTree: vi.fn(),
      toggleFolder: vi.fn(),
      expandedFolders: new Set<string>(),
      selectedFileId: null,
    }
    mockToast.success.mockClear()
    mockToast.error.mockClear()
  })
  afterEach(() => cleanup())

  it('病灶(折叠文件夹):改名框里打空格 ⇒ 未被 preventDefault,空格真的进了改名值', () => {
    const { container } = render(<FileTreeNode node={FOLDER_NODE} depth={0} />)
    const input = enterRenaming(container)
    expect(input.value).toBe('src')

    const notPrevented = typeChar(input, ' ')

    // 修复前:行的 onKeyDown 无条件 preventDefault ⇒ 这里拿到 false,字符被吞
    expect(notPrevented).toBe(true)
    expect(input.value).toBe('src ')
    expect(input.value).toContain(' ')
  })

  it('病灶(文件节点):改名框里打空格 ⇒ 行的 selectFile/openFile 未被调用', () => {
    const { container } = render(<FileTreeNode node={FILE_NODE} depth={0} />)
    const input = enterRenaming(container)

    typeChar(input, ' ')
    typeChar(input, 'n')

    expect(mockStore.state.selectFile).not.toHaveBeenCalled()
    expect(mockStore.state.openFile).not.toHaveBeenCalled()
    // 连续输入仍然正常累积(判等没把 input 的其它按键路径改坏)
    expect(input.value).toBe('app.ts n')
  })

  it('正向对照:没有 input 聚焦时对折叠行按 Enter ⇒ 仍切换展开(不得把行做成不响应键盘的哑实现)', () => {
    const { container } = render(<FileTreeNode node={FOLDER_NODE} depth={0} />)
    const row = getRow(container)

    // fireEvent 返回 false = 该键被 preventDefault(行的默认行为该被吃掉)
    expect(fireEvent.keyDown(row, { key: 'Enter' })).toBe(false)
    expect(mockStore.state.toggleFolder).toHaveBeenCalledWith('f1')
  })

  it('正向对照:没有 input 聚焦时对折叠行按 Space ⇒ 仍切换展开', () => {
    const { container } = render(<FileTreeNode node={FOLDER_NODE} depth={0} />)
    const row = getRow(container)

    expect(fireEvent.keyDown(row, { key: ' ' })).toBe(false)
    expect(mockStore.state.toggleFolder).toHaveBeenCalledWith('f1')
  })

  it('正向对照:文件行(非改名态)按 Enter ⇒ 仍走选中 + 打开', () => {
    const { container } = render(<FileTreeNode node={FILE_NODE} depth={0} />)
    const row = getRow(container)

    fireEvent.keyDown(row, { key: 'Enter' })
    expect(mockStore.state.selectFile).toHaveBeenCalledWith('file-1')
    expect(mockStore.state.openFile).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-1' }))
  })

  it('改名框里的其它按键不受影响:Escape 取消改名,行不接管', () => {
    const { container } = render(<FileTreeNode node={FOLDER_NODE} depth={0} />)
    const input = enterRenaming(container)

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(container.querySelector('input')).toBeNull()
    expect(mockStore.state.toggleFolder).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
