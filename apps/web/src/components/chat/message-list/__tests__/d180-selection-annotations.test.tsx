// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D180(2026-09-30 立,对标竞品 chatSession.selectionAnnotations.*)划词批注装车证明。
// 判据全部挂渲染结果,不读源码:
//   ① 批注条:无批注零渲染;有批注出触发钮(aria=悬停查看批注 + 计数徽章)与「移除全部」;
//   ② 悬停/聚焦展开清单:「{index}. 选中文字」+ 选段原文 + 评论或「未添加评论」+
//      评论输入(placeholder/aria)+「添加评论」+「移除批注 {index}」单条出口;
//   ③ MessageItem 选区动作组第三出口「添加批注」→ 写 store(conversationId+messageId 归属)
//      + 清原生选区,批注条随即浮现(D22 引用/D184 附件两出口不串线由既有 d184 测试把守)。
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// i18n mock 只回键名:断言挂在 aria-label/文案的键位与结构位上,不依赖具体语言文案。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string): string => `[${key}]`,
  useLocale: () => 'zh-CN',
}))

import { SelectionAnnotationBar } from '@/components/chat/message-list/d180-selection-annotations'
import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import {
  selectionAnnotationKey,
  useSelectionAnnotationsStore,
  type SelectionAnnotation,
} from '@/stores/d180-selection-annotations'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 8, 30, 1, 2, 3)
const BODY = 'D180-ANCHOR-7K 正文段'
const SELECTED = '被划词的正文选段'

function seed(annotationsByMessage: Record<string, SelectionAnnotation[]>) {
  useSelectionAnnotationsStore.setState({ annotationsByMessage })
}

function annotation(id: string, text: string, comment = ''): SelectionAnnotation {
  return { id, text, comment, createdAt: NOW }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useSelectionAnnotationsStore.setState({ annotationsByMessage: {} })
  useChatStore.setState({ messages: [], conversationId: null })
})

beforeEach(() => {
  useSelectionAnnotationsStore.setState({ annotationsByMessage: {} })
})

describe('D180 批注条(独立渲染)', () => {
  it('无批注 → 整体不渲染;有批注 → 触发钮(aria=hoverHint,含计数)+ 移除全部在位,清单默认收起', () => {
    const empty = render(<SelectionAnnotationBar conversationId="c1" messageId="m1" />)
    expect(empty.container.firstChild).toBeNull()
    empty.unmount()

    seed({ [selectionAnnotationKey('c1', 'm1')]: [annotation('a', '甲段'), annotation('b', '乙段', '既有评论')] })
    const { container } = render(<SelectionAnnotationBar conversationId="c1" messageId="m1" />)
    const trigger = container.querySelector(
      '[data-testid="selection-annotation-trigger-m1"]',
    ) as HTMLButtonElement
    expect(trigger).not.toBeNull()
    expect(trigger.getAttribute('aria-label')).toBe('[selectionAnnotations.hoverHint]')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.textContent).toContain('2')
    expect(container.querySelector('[data-testid="selection-annotation-remove-all-m1"]')).not.toBeNull()
    // 未悬停:清单不出现在 DOM(悬停查看判据)
    expect(container.querySelector('[data-testid="selection-annotation-panel-m1"]')).toBeNull()
  })

  it('悬停展开 → 「{index}. 选中文字」清单:选段原文/评论或「未添加评论」/输入框/添加评论/单条移除诸键位齐备', () => {
    seed({
      [selectionAnnotationKey('c1', 'm1')]: [annotation('a', '甲段'), annotation('b', '乙段', '既有评论')],
    })
    const { container } = render(<SelectionAnnotationBar conversationId="c1" messageId="m1" />)
    const bar = container.querySelector('[data-testid="selection-annotation-bar-m1"]') as HTMLElement
    act(() => {
      fireEvent.mouseEnter(bar)
    })
    const panel = container.querySelector('[data-testid="selection-annotation-panel-m1"]')
    expect(panel).not.toBeNull()
    const row1 = container.querySelector('[data-testid="selection-annotation-item-m1-1"]')
    const row2 = container.querySelector('[data-testid="selection-annotation-item-m1-2"]')
    expect(row1).not.toBeNull()
    expect(row2).not.toBeNull()
    expect(row1?.textContent).toContain('[selectionAnnotations.selectedText]')
    expect(row1?.textContent).toContain('甲段')
    expect(row1?.textContent).toContain('[selectionAnnotations.noComment]')
    expect(row2?.textContent).toContain('乙段')
    expect(row2?.textContent).toContain('既有评论')
    expect(row2?.textContent).not.toContain('[selectionAnnotations.noComment]')
    const input = container.querySelector(
      '[data-testid="selection-annotation-comment-input-m1-1"]',
    ) as HTMLInputElement
    expect(input.getAttribute('placeholder')).toBe('[selectionAnnotations.commentPlaceholder]')
    expect(input.getAttribute('aria-label')).toBe('[selectionAnnotations.commentAriaLabel]')
    const addBtn = container.querySelector(
      '[data-testid="selection-annotation-comment-add-m1-1"]',
    ) as HTMLButtonElement
    expect(addBtn.textContent).toContain('[selectionAnnotations.addComment]')
    expect(addBtn.disabled).toBe(true)
    const removeBtn = container.querySelector(
      '[data-testid="selection-annotation-remove-m1-1"]',
    ) as HTMLButtonElement
    expect(removeBtn.getAttribute('aria-label')).toBe('[selectionAnnotations.removeOne]')
  })

  it('添加评论写入归属批注并回显;「移除批注 {index}」删单条;「移除全部」撤整条消息', () => {
    seed({
      [selectionAnnotationKey('c1', 'm1')]: [annotation('a', '甲段'), annotation('b', '乙段')],
    })
    const { container } = render(<SelectionAnnotationBar conversationId="c1" messageId="m1" />)
    act(() => {
      fireEvent.mouseEnter(container.querySelector('[data-testid="selection-annotation-bar-m1"]') as Element)
    })
    const input = container.querySelector(
      '[data-testid="selection-annotation-comment-input-m1-1"]',
    ) as HTMLInputElement
    act(() => {
      fireEvent.change(input, { target: { value: '新加的评论' } })
    })
    act(() => {
      fireEvent.click(
        container.querySelector(
          '[data-testid="selection-annotation-comment-add-m1-1"]',
        ) as HTMLButtonElement,
      )
    })
    const list = () =>
      useSelectionAnnotationsStore.getState().annotationsByMessage[
        selectionAnnotationKey('c1', 'm1')
      ]
    expect(list()[0].comment).toBe('新加的评论')
    // 评论入 store 后立刻回显在行内(store→渲染单向)
    expect(
      container.querySelector('[data-testid="selection-annotation-item-m1-1"]')?.textContent,
    ).toContain('新加的评论')

    act(() => {
      fireEvent.click(
        container.querySelector('[data-testid="selection-annotation-remove-m1-2"]') as HTMLButtonElement,
      )
    })
    expect(list()).toHaveLength(1)
    expect(list()[0].id).toBe('a')

    act(() => {
      fireEvent.click(
        container.querySelector('[data-testid="selection-annotation-remove-all-m1"]') as HTMLButtonElement,
      )
    })
    expect(selectionAnnotationKey('c1', 'm1') in useSelectionAnnotationsStore.getState().annotationsByMessage).toBe(false)
    expect(container.querySelector('[data-testid="selection-annotation-bar-m1"]')).toBeNull()
  })
})

describe('D180 MessageItem 接线(选区动作组第三出口)', () => {
  function assistantMessage(over: Partial<ChatMessage> = {}): ChatMessage {
    return { id: 's1', role: 'assistant', content: BODY, createdAt: NOW, ...over }
  }

  function renderMessage(m: ChatMessage) {
    return render(
      <TooltipProvider>
        <MessageItem message={m} isLast={false} isStreaming={false} assistantLabel="AI" />
      </TooltipProvider>,
    )
  }

  function stubSelection(anchor: Node | null, text: string) {
    const removeAllRanges = vi.fn()
    vi.spyOn(window, 'getSelection').mockImplementation(
      () =>
        ({
          isCollapsed: !anchor,
          anchorNode: anchor,
          toString: () => text,
          removeAllRanges,
        }) as unknown as Selection,
    )
    return { removeAllRanges }
  }

  function bodyLeaf(container: HTMLElement): Node {
    const matches = [...container.querySelectorAll<HTMLElement>('*')].filter((el) =>
      (el.textContent ?? '').includes(BODY),
    )
    const leaf = matches[matches.length - 1]
    if (!leaf) throw new Error(`正文(${BODY})应渲染在消息内容区内`)
    return leaf
  }

  it('选中文本 → 组内第三出口「添加批注」;点击写入 c1::s1 归属并清选区,批注条浮现', () => {
    useChatStore.setState({ conversationId: 'c1' })
    const { container } = renderMessage(assistantMessage())
    const sel = stubSelection(bodyLeaf(container), SELECTED)
    act(() => {
      document.dispatchEvent(new Event('selectionchange'))
    })
    const group = container.querySelector('[data-testid="message-selection-actions-s1"]')
    expect(group).not.toBeNull()
    const annotate = group?.querySelector(
      '[data-testid="message-selection-annotate-s1"]',
    ) as HTMLButtonElement
    expect(annotate).not.toBeNull()
    expect(annotate.textContent).toContain('[selectionAnnotations.add]')
    // D22/D184 两出口不被顶替(三出口并存)
    expect(group?.querySelector('[data-testid="message-quote-selection-s1"]')).not.toBeNull()
    expect(group?.querySelector('[data-testid="message-selection-attachment-s1"]')).not.toBeNull()

    act(() => {
      fireEvent.click(annotate)
    })
    const stored = useSelectionAnnotationsStore.getState().annotationsByMessage[
      selectionAnnotationKey('c1', 's1')
    ]
    expect(stored).toHaveLength(1)
    expect(stored[0].text).toBe(SELECTED)
    expect(sel.removeAllRanges).toHaveBeenCalledTimes(1)
    // 批注条常驻浮现(不依赖当前选区)
    expect(container.querySelector('[data-testid="selection-annotation-bar-s1"]')).not.toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
