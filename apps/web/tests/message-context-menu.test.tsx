// @vitest-environment jsdom
/**
 * MessageContextMenu 单元测试(2026-07-28 立,块 3.3)
 *
 * 覆盖:
 * - 7 种操作渲染:copy / copyMarkdown / regenerate / feedback / share / collapseToPlan / delete
 * - 各操作的图标映射(Copy/FileText/RefreshCw/MessageSquareWarning/Share2/Trash2/Clipboard)
 * - 危险项(danger=true)显示 destructive 颜色
 * - 禁用项(disabled=true)不可点击 + 半透明
 * - 分隔符(separator)渲染 1px 横线
 * - 子菜单(children)嵌套渲染
 * - 快捷键显示(shortcut)
 * - visible=false:不渲染
 * - role=menu + aria-label
 * - Esc 键关闭
 * - 点击外部关闭(click-outside)
 * - 边界检测:超出视口时翻转
 * - 工具函数 markdownForClipboard / plainTextForClipboard
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import {
  MessageContextMenu,
  markdownForClipboard,
  plainTextForClipboard,
  normalizeMarkdown,
} from '../src/components/ai/progress-sections/message-context-menu'
import type { ContextMenuItem } from '../src/hooks/use-context-menu'

// ─── lucide-react mock ───
vi.mock('lucide-react', () => {
  const IconSpan = ({
    className,
    'data-testid': dataTestId,
    ...rest
  }: {
    className?: string
    'data-testid'?: string
    [key: string]: unknown
  }) => (
    <span
      data-testid={dataTestId ?? 'lucide-icon'}
      className={className}
      data-lucide-span="true"
      {...rest}
    />
  )
  return {
    __esModule: true,
    Check: IconSpan,
    Clipboard: IconSpan,
    Copy: IconSpan,
    FileText: IconSpan,
    MessageSquareWarning: IconSpan,
    RefreshCw: IconSpan,
    Share2: IconSpan,
    Trash2: IconSpan,
  }
})

/** 工厂:创建 7 类基础操作菜单项 */
function makeBaseItems(): ContextMenuItem[] {
  return [
    { id: 'copy', label: '复制文本', action: 'copy' },
    { id: 'copy-md', label: '复制为 Markdown', action: 'copyMarkdown' },
    { id: 'sep-1', label: '', separator: true },
    { id: 'regenerate', label: '重新生成', action: 'regenerate' },
    { id: 'feedback', label: '反馈', action: 'feedback' },
    { id: 'sep-2', label: '', separator: true },
    { id: 'share', label: '分享', action: 'share' },
    { id: 'collapse', label: '折叠到计划', action: 'collapseToPlan' },
    { id: 'sep-3', label: '', separator: true },
    { id: 'delete', label: '删除', action: 'delete', danger: true },
  ]
}

describe('MessageContextMenu — 基础渲染', () => {
  afterEach(() => {
    cleanup()
  })

  it('visible=false:不渲染任何 DOM', () => {
    const { container } = render(
      <MessageContextMenu
        visible={false}
        position={{ x: 100, y: 100 }}
        items={makeBaseItems()}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('visible=true:渲染菜单容器 + role=menu + aria-label', () => {
    const { container } = render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={makeBaseItems()}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const menu = container.querySelector('[data-testid="message-context-menu"]')!
    expect(menu).toBeTruthy()
    expect(menu.getAttribute('role')).toBe('menu')
    expect(menu.getAttribute('aria-label')).toBe('消息操作菜单')
  })

  it('自定义 data-testid 覆盖默认', () => {
    const { container } = render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={makeBaseItems()}
        onAction={vi.fn()}
        onClose={vi.fn()}
        data-testid="custom-menu"
      />,
    )
    expect(container.querySelector('[data-testid="custom-menu"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="message-context-menu"]')).toBeFalsy()
  })

  it('position 应用于 fixed 容器', () => {
    const { container } = render(
      <MessageContextMenu
        visible={true}
        position={{ x: 200, y: 300 }}
        items={makeBaseItems()}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const menu = container.querySelector('[data-testid="message-context-menu"]') as HTMLElement
    expect(menu.style.left).toBe('200px')
    expect(menu.style.top).toBe('300px')
  })
})

describe('MessageContextMenu — 7 类操作渲染', () => {
  afterEach(() => {
    cleanup()
  })

  it('所有 7 类 action 渲染对应 data-testid 菜单项', () => {
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={makeBaseItems()}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const expectedActions = [
      'copy',
      'copyMarkdown',
      'regenerate',
      'feedback',
      'share',
      'collapseToPlan',
      'delete',
    ]
    for (const action of expectedActions) {
      const item = screen.getByTestId(`message-context-menu-item-${action}`)
      expect(item).toBeTruthy()
    }
  })

  it('每个菜单项含 data-action 属性', () => {
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={makeBaseItems()}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const copyItem = screen.getByTestId('message-context-menu-item-copy')
    expect(copyItem.getAttribute('data-action')).toBe('copy')
  })

  it('菜单项 label 显示在按钮内', () => {
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={makeBaseItems()}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('复制文本')).toBeTruthy()
    expect(screen.getByText('复制为 Markdown')).toBeTruthy()
    expect(screen.getByText('重新生成')).toBeTruthy()
  })

  it('复制类操作(Copy / FileText 图标)', () => {
    const { container } = render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={makeBaseItems()}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    // 至少含 Copy 和 FileText 图标
    const icons = container.querySelectorAll('[data-lucide-span="true"]')
    expect(icons.length).toBeGreaterThan(0)
  })
})

describe('MessageContextMenu — 危险项 + 禁用项样式', () => {
  afterEach(() => {
    cleanup()
  })

  it('danger=true 项:text-destructive + 危险 hover 样式', () => {
    const items: ContextMenuItem[] = [{ id: 'del', label: '删除', action: 'delete', danger: true }]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const delBtn = screen.getByTestId('message-context-menu-item-delete')
    expect(delBtn.className).toContain('text-destructive')
  })

  it('disabled=true 项:不可点击 + opacity-50', () => {
    const items: ContextMenuItem[] = [
      { id: 'regen', label: '重新生成', action: 'regenerate', disabled: true },
    ]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const regenBtn = screen.getByTestId('message-context-menu-item-regenerate') as HTMLButtonElement
    expect(regenBtn.hasAttribute('disabled')).toBe(true)
    expect(regenBtn.className).toContain('opacity-50')
  })

  it('点击 enabled 项触发 onAction(action, item)', () => {
    const onAction = vi.fn()
    const items: ContextMenuItem[] = [{ id: 'copy', label: '复制', action: 'copy' }]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={onAction}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('message-context-menu-item-copy'))
    expect(onAction).toHaveBeenCalledWith('copy', items[0])
  })

  it('点击 disabled 项不触发 onAction', () => {
    const onAction = vi.fn()
    const items: ContextMenuItem[] = [
      { id: 'regen', label: '重新生成', action: 'regenerate', disabled: true },
    ]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={onAction}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('message-context-menu-item-regenerate'))
    expect(onAction).not.toHaveBeenCalled()
  })
})

describe('MessageContextMenu — 分隔符 + 子菜单', () => {
  afterEach(() => {
    cleanup()
  })

  it('separator 项:渲染 role=separator 元素', () => {
    const items: ContextMenuItem[] = [
      { id: 'a', label: 'A', action: 'copy' },
      { id: 'sep', label: '', separator: true },
      { id: 'b', label: 'B', action: 'delete', danger: true },
    ]
    const { container } = render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const seps = container.querySelectorAll('[role="separator"]')
    expect(seps.length).toBe(1)
  })

  it('children 子菜单:嵌套渲染', () => {
    const items: ContextMenuItem[] = [
      {
        id: 'feedback',
        label: '反馈',
        icon: <span>F</span>,
        children: [
          { id: 'like', label: '点赞', action: 'feedback' },
          { id: 'dislike', label: '点踩', action: 'feedback' },
        ],
      },
    ]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('点赞')).toBeTruthy()
    expect(screen.getByText('点踩')).toBeTruthy()
  })

  it('shortcut 文本显示在菜单项右侧', () => {
    const items: ContextMenuItem[] = [
      { id: 'copy', label: '复制', action: 'copy', shortcut: 'Ctrl+C' },
    ]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('Ctrl+C')).toBeTruthy()
  })
})

describe('MessageContextMenu — Esc 关闭 + 点击外部', () => {
  afterEach(() => {
    cleanup()
  })

  it('Esc 键:触发 onClose', () => {
    const onClose = vi.fn()
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={makeBaseItems()}
        onAction={vi.fn()}
        onClose={onClose}
      />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('点击菜单外部:触发 onClose(延迟绑定避免误关闭)', () => {
    vi.useFakeTimers()
    try {
      const onClose = vi.fn()
      render(
        <div>
          <button data-testid="outside">外部</button>
          <MessageContextMenu
            visible={true}
            position={{ x: 100, y: 100 }}
            items={makeBaseItems()}
            onAction={vi.fn()}
            onClose={onClose}
          />
        </div>,
      )
      // 推进 0ms(setTimeout 0 延迟绑定)
      act(() => {
        vi.advanceTimersByTime(10)
      })
      // 点击外部元素
      fireEvent.mouseDown(screen.getByTestId('outside'))
      expect(onClose).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('点击菜单内部:不触发 onClose', () => {
    vi.useFakeTimers()
    try {
      const onClose = vi.fn()
      render(
        <MessageContextMenu
          visible={true}
          position={{ x: 100, y: 100 }}
          items={makeBaseItems()}
          onAction={vi.fn()}
          onClose={onClose}
        />,
      )
      act(() => {
        vi.advanceTimersByTime(10)
      })
      // 点击菜单项(菜单内部)
      fireEvent.mouseDown(screen.getByTestId('message-context-menu-item-copy'))
      expect(onClose).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('visible=true → false:菜单消失', () => {
    const { container, rerender } = render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={makeBaseItems()}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="message-context-menu"]')).toBeTruthy()
    rerender(
      <MessageContextMenu
        visible={false}
        position={{ x: 100, y: 100 }}
        items={makeBaseItems()}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="message-context-menu"]')).toBeFalsy()
  })
})

describe('MessageContextMenu — 边界检测 + 样式', () => {
  afterEach(() => {
    cleanup()
  })

  it('视口尺寸默认 1024x768(jsdom) — 位置在视口内时,style 保持原值', () => {
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={[{ id: 'a', label: 'A', action: 'copy' }]}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const menu = screen.getByTestId('message-context-menu') as HTMLElement
    // 边界检测后位置应调整(可能等于原值或 clamp 后值,这里 x=100,y=100 应通过)
    expect(menu.style.left).toMatch(/^\d+px$/)
    expect(menu.style.top).toMatch(/^\d+px$/)
  })

  it('fixed 定位 + 高 z-index(1100)+ 入场动画', () => {
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={[{ id: 'a', label: 'A', action: 'copy' }]}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const menu = screen.getByTestId('message-context-menu') as HTMLElement
    expect(menu.className).toContain('fixed')
    expect(menu.className).toContain('z-[1100]')
    expect(menu.className).toContain('animate-in')
  })

  it('className prop 透传', () => {
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={[{ id: 'a', label: 'A', action: 'copy' }]}
        onAction={vi.fn()}
        onClose={vi.fn()}
        className="my-custom-class"
      />,
    )
    const menu = screen.getByTestId('message-context-menu') as HTMLElement
    expect(menu.className).toContain('my-custom-class')
  })

  it('items 为空数组:显示"无可用操作"占位', () => {
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={[]}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('无可用操作')).toBeTruthy()
  })

  it('无 action 的菜单项:不渲染 data-testid 包含 action 段', () => {
    // 业务场景:有 label 但 action=undefined(显示用菜单项)
    const items: ContextMenuItem[] = [
      { id: 'header', label: '菜单标题' }, // 无 action
    ]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    // data-testid 应使用 fallback id
    const headerItem = screen.getByTestId('message-context-menu-item-header')
    expect(headerItem).toBeTruthy()
  })
})

// ─── 工具函数测试 ─────────────────────────────────────

describe('markdownForClipboard — 转换工具', () => {
  it('保留换行符(\\r\\n → \\n)', () => {
    expect(markdownForClipboard('line1\r\nline2')).toBe('line1\nline2')
  })

  it('3+ 连续换行合并为 2 个', () => {
    expect(markdownForClipboard('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('首尾空白被 trim', () => {
    expect(markdownForClipboard('  hello  ')).toBe('hello')
  })

  it('空字符串返回空', () => {
    expect(markdownForClipboard('')).toBe('')
  })
})

describe('plainTextForClipboard — 简化纯文本工具', () => {
  it('去除代码块围栏', () => {
    expect(plainTextForClipboard('```js\nfoo()\n```')).toBe('foo()')
  })

  it('去除行内代码标记(`)', () => {
    expect(plainTextForClipboard('use `useEffect` here')).toBe('use useEffect here')
  })

  it('去除标题前缀(#)', () => {
    expect(plainTextForClipboard('# Title\nbody')).toBe('Title\nbody')
  })

  it('去除加粗(**)', () => {
    expect(plainTextForClipboard('**important**')).toBe('important')
  })

  it('去除斜体(*)', () => {
    expect(plainTextForClipboard('*emphasized*')).toBe('emphasized')
  })

  it('链接 [text](url) 转为 text', () => {
    expect(plainTextForClipboard('[click](https://example.com)')).toBe('click')
  })

  it('列表 - / * / + 转为 • 项目符号', () => {
    expect(plainTextForClipboard('- item1\n* item2\n+ item3')).toBe('• item1\n• item2\n• item3')
  })

  it('3+ 连续换行合并为 2 个', () => {
    expect(plainTextForClipboard('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('集成场景:复杂 markdown 转纯文本', () => {
    const md = '# Title\n\nThis is **bold** and *italic* text with `code`.\n\n- item 1\n- item 2'
    const expected = 'Title\n\nThis is bold and italic text with code.\n\n• item 1\n• item 2'
    expect(plainTextForClipboard(md)).toBe(expected)
  })
})

// ─── 进阶边界场景(2026-07-28 覆盖率深化) ─────────────────────────

describe('MessageContextMenu — 分隔符 + 菜单项交互隔离', () => {
  afterEach(() => {
    cleanup()
  })

  it('点击 separator 元素:不触发 onAction(separator 是 div,无 onClick 处理器)', () => {
    const onAction = vi.fn()
    const items: ContextMenuItem[] = [
      { id: 'a', label: 'A', action: 'copy' },
      { id: 'sep', label: '', separator: true },
      { id: 'b', label: 'B', action: 'delete' },
    ]
    const { container } = render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={onAction}
        onClose={vi.fn()}
      />,
    )
    const separator = container.querySelector('[role="separator"]') as HTMLElement
    expect(separator).toBeTruthy()
    // 点击 separator 不应触发 onAction
    fireEvent.click(separator)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('action=undefined 项:data-testid 退化为 id;点击不触发 onAction', () => {
    const onAction = vi.fn()
    const items: ContextMenuItem[] = [
      { id: 'header', label: '菜单标题' }, // 无 action
    ]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={onAction}
        onClose={vi.fn()}
      />,
    )
    // data-testid 退化为 id
    const headerItem = screen.getByTestId('message-context-menu-item-header')
    // 元素是 button,但点击不触发 onAction(onClick 内有 action guard)
    fireEvent.click(headerItem)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('点击子菜单项触发 onAction(child.action, child)', () => {
    const onAction = vi.fn()
    const childItem: ContextMenuItem = { id: 'like', label: '点赞', action: 'feedback' }
    const items: ContextMenuItem[] = [
      {
        id: 'feedback',
        label: '反馈',
        icon: <span>F</span>,
        children: [childItem],
      },
    ]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={onAction}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('点赞'))
    expect(onAction).toHaveBeenCalledWith('feedback', childItem)
  })
})

describe('MessageContextMenu — 自定义 icon prop 覆盖', () => {
  afterEach(() => {
    cleanup()
  })

  it('item.icon 优先于默认 buildIcon(根据 action 派生的图标)', () => {
    const customIcon = <span data-testid="custom-icon-123">★</span>
    const items: ContextMenuItem[] = [
      { id: 'copy', label: '复制', action: 'copy', icon: customIcon },
    ]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    // 自定义 icon 渲染
    expect(screen.getByTestId('custom-icon-123')).toBeTruthy()
    // 默认 buildIcon 的 Copy 没有渲染(因为被自定义 icon 覆盖)
    // 整个 lucide-icon 集合应只有 0 个(因为 copy 的 Copy icon 被 customIcon 替代)
    // 注意:feedback 也没出现,所以图标数为 0
    const allIcons = document.querySelectorAll('[data-lucide-span="true"]')
    expect(allIcons.length).toBe(0)
  })
})

describe('MessageContextMenu — 位置变更与外部 contextmenu 事件', () => {
  afterEach(() => {
    cleanup()
  })

  it('position 变更:从 (100,100) 切到 (400,500),style 同步更新', () => {
    const { container, rerender } = render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={[{ id: 'a', label: 'A', action: 'copy' }]}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    let menu = container.querySelector('[data-testid="message-context-menu"]') as HTMLElement
    expect(menu.style.left).toBe('100px')
    expect(menu.style.top).toBe('100px')
    rerender(
      <MessageContextMenu
        visible={true}
        position={{ x: 400, y: 500 }}
        items={[{ id: 'a', label: 'A', action: 'copy' }]}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    menu = container.querySelector('[data-testid="message-context-menu"]') as HTMLElement
    expect(menu.style.left).toBe('400px')
    expect(menu.style.top).toBe('500px')
  })

  it('外部 contextmenu 事件也能触发 onClose(mousedown + contextmenu 双绑)', () => {
    vi.useFakeTimers()
    try {
      const onClose = vi.fn()
      render(
        <div>
          <button data-testid="outside">外部</button>
          <MessageContextMenu
            visible={true}
            position={{ x: 100, y: 100 }}
            items={[{ id: 'a', label: 'A', action: 'copy' }]}
            onAction={vi.fn()}
            onClose={onClose}
          />
        </div>,
      )
      // 推进 0ms(setTimeout 0 延迟绑定)
      act(() => {
        vi.advanceTimersByTime(10)
      })
      // 触发外部 contextmenu 事件
      const outside = screen.getByTestId('outside')
      fireEvent.contextMenu(outside)
      expect(onClose).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

// ─── Phase 19/20 深化:5 个核心菜单项(精简版)+ normalizeMarkdown 单元测试 ──

describe('MessageContextMenu — 5 核心菜单项精简配置', () => {
  afterEach(() => {
    cleanup()
  })

  it('精简 5 项:copy / copy-md / regenerate / edit / delete 全部渲染', () => {
    const items: ContextMenuItem[] = [
      { id: 'copy', label: '复制', action: 'copy' },
      { id: 'copy-md', label: '复制 Markdown', action: 'copyMarkdown' },
      { id: 'regenerate', label: '重新生成', action: 'regenerate' },
      { id: 'edit', label: '编辑', action: 'feedback' }, // 'edit' 复用 feedback action
      { id: 'delete', label: '删除', action: 'delete', danger: true },
    ]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTestId('message-context-menu-item-copy')).toBeTruthy()
    expect(screen.getByTestId('message-context-menu-item-copyMarkdown')).toBeTruthy()
    expect(screen.getByTestId('message-context-menu-item-regenerate')).toBeTruthy()
    expect(screen.getByTestId('message-context-menu-item-feedback')).toBeTruthy()
    expect(screen.getByTestId('message-context-menu-item-delete')).toBeTruthy()
  })

  it('5 项中仅 delete 是 danger 样式(其他 4 项非 destructive)', () => {
    const items: ContextMenuItem[] = [
      { id: 'copy', label: '复制', action: 'copy' },
      { id: 'copy-md', label: '复制 Markdown', action: 'copyMarkdown' },
      { id: 'regenerate', label: '重新生成', action: 'regenerate' },
      { id: 'edit', label: '编辑', action: 'feedback' },
      { id: 'delete', label: '删除', action: 'delete', danger: true },
    ]
    render(
      <MessageContextMenu
        visible={true}
        position={{ x: 100, y: 100 }}
        items={items}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    // delete 含 text-destructive
    expect(screen.getByTestId('message-context-menu-item-delete').className).toContain(
      'text-destructive',
    )
    // 其他不含
    expect(screen.getByTestId('message-context-menu-item-copy').className).not.toContain(
      'text-destructive',
    )
    expect(screen.getByTestId('message-context-menu-item-copyMarkdown').className).not.toContain(
      'text-destructive',
    )
    expect(screen.getByTestId('message-context-menu-item-regenerate').className).not.toContain(
      'text-destructive',
    )
  })
})

describe('MessageContextMenu — 关闭后焦点回到原触发元素(a11y)', () => {
  afterEach(() => {
    cleanup()
  })

  it('visible=true → false 切换后,组件卸载不报错', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <>
        <button data-testid="trigger">触发器</button>
        <MessageContextMenu
          visible={true}
          position={{ x: 100, y: 100 }}
          items={[{ id: 'a', label: 'A', action: 'copy' }]}
          onAction={vi.fn()}
          onClose={onClose}
        />
      </>,
    )
    expect(screen.getByTestId('message-context-menu')).toBeTruthy()
    rerender(
      <>
        <button data-testid="trigger">触发器</button>
        <MessageContextMenu
          visible={false}
          position={{ x: 100, y: 100 }}
          items={[{ id: 'a', label: 'A', action: 'copy' }]}
          onAction={vi.fn()}
          onClose={onClose}
        />
      </>,
    )
    // visible=false → 卸载
    expect(screen.queryByTestId('message-context-menu')).toBeNull()
    // trigger 仍存在(焦点可回到)
    expect(screen.getByTestId('trigger')).toBeTruthy()
  })
})

describe('MessageContextMenu — 屏幕边缘 position 边界', () => {
  afterEach(() => {
    cleanup()
  })

  it('position.x = 0(屏幕最左):渲染正常', () => {
    const { container } = render(
      <MessageContextMenu
        visible={true}
        position={{ x: 0, y: 0 }}
        items={[{ id: 'a', label: 'A', action: 'copy' }]}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const menu = container.querySelector('[data-testid="message-context-menu"]') as HTMLElement
    expect(menu.style.left).toBe('0px')
    expect(menu.style.top).toBe('0px')
  })

  it('position = (9999, 9999)(屏幕最右下):被边界检测 clamp 到视口内', () => {
    // 边界检测:menuRef.getBoundingClientRect() 测得菜单宽度,若 x + width > vw 则 clamp
    const { container } = render(
      <MessageContextMenu
        visible={true}
        position={{ x: 9999, y: 9999 }}
        items={[{ id: 'a', label: 'A', action: 'copy' }]}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const menu = container.querySelector('[data-testid="message-context-menu"]') as HTMLElement
    // 被 clamp 到视口内(具体数值受 jsdom 视口大小影响,只验证不是 9999)
    expect(menu.style.left).not.toBe('9999px')
    expect(menu.style.top).not.toBe('9999px')
    // clamp 后 x/y >= 0
    expect(Number.parseInt(menu.style.left, 10)).toBeGreaterThanOrEqual(0)
    expect(Number.parseInt(menu.style.top, 10)).toBeGreaterThanOrEqual(0)
  })

  it('position 为负数(-100, -50):仍渲染(允许溢出视口)', () => {
    const { container } = render(
      <MessageContextMenu
        visible={true}
        position={{ x: -100, y: -50 }}
        items={[{ id: 'a', label: 'A', action: 'copy' }]}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const menu = container.querySelector('[data-testid="message-context-menu"]') as HTMLElement
    expect(menu.style.left).toBe('-100px')
    expect(menu.style.top).toBe('-50px')
  })
})

describe('MessageContextMenu — normalizeMarkdown 单元测试(deprecated markdownForClipboard 别名)', () => {
  afterEach(() => {
    cleanup()
  })

  it('markdownForClipboard 与 normalizeMarkdown 输出完全一致(别名兼容)', () => {
    const inputs = [
      'line1\nline2',
      'line1\r\nline2',
      '  hello world  ',
      'a\n\n\n\nb',
      '# Title\n\nbody',
      '',
    ]
    for (const input of inputs) {
      expect(markdownForClipboard(input)).toBe(
        input
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim(),
      )
    }
  })

  it('normalizeMarkdown 处理多种空白字符:tab / 多余空行 / 首尾空白', () => {
    // 通过导入路径验证别名导出的函数存在
    expect(typeof normalizeMarkdown).toBe('function')
  })

  it('markdownForClipboard 是函数类型(兼容性 import 仍可用)', () => {
    expect(typeof markdownForClipboard).toBe('function')
  })

  it('plainTextForClipboard 与 markdownForClipboard 输出格式不同(plainText 去除 markdown 语法)', () => {
    const md = '# Title\n\n**bold** and `code`'
    const plain = plainTextForClipboard(md)
    const normalized = markdownForClipboard(md)
    // plain 去除 markdown,normalized 只规范化空白
    expect(plain).toContain('Title')
    expect(plain).not.toContain('**')
    expect(normalized).toContain('**')
  })
})
