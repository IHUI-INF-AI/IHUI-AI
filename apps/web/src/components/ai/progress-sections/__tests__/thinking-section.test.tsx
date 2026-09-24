// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number }) => {
    const map: Record<string, string> = {
      thinkingTitle: '思考过程',
      thinkingStreaming: '思考中',
      thinkingChars: '字符',
    }
    if (key === 'thinkingRefsTitle') return `使用了 ${String(values?.count ?? 0)} 个引用`
    return map[key] ?? key
  },
}))

// Tooltip 依赖 TooltipProvider(radix),单测中直接透传 children
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { ThinkingSection } from '../thinking-section'

/**
 * ThinkingSection 分节渲染测试(P3 #33 思考分节标题化,2026-09-16 立)
 *
 * 覆盖:多段 content 渲染小标题 / 单段短内容退化无标题 /
 * 显式 markdown 标题 / 正文完整性 / 流式光标。
 */
describe('ThinkingSection 分节渲染(P3 #33)', () => {
  afterEach(() => cleanup())

  const longPara =
    '需要先分析用户的意图,判断是查询类还是操作类问题,然后再决定调用哪个工具来完成任务,同时考虑上下文里是否已有足够信息可以直接回答,避免不必要的工具往返开销,最后组织成结构化的回答输出给用户。'

  it('多段长内容:各节渲染标题行,节间正文完整', () => {
    render(
      <ThinkingSection
        content={`${longPara}\n\n第二段 reasoning 正文,同样超过阈值长度所以也会有标题行出现于其上。`}
        currentNode={null}
        isStreaming={false}
        expanded={true}
      />,
    )
    expect(screen.getByTestId('thinking-section-0')).toBeTruthy()
    expect(screen.getByTestId('thinking-section-1')).toBeTruthy()
    // 第 0 节有标题
    expect(screen.getByTestId('thinking-section-title-0').textContent?.length).toBeGreaterThan(0)
    // 正文完整保留
    expect(screen.getByTestId('thinking-content').textContent).toContain(longPara)
  })

  it('单段短内容:退化为无标题单节(不渲染标题行)', () => {
    render(
      <ThinkingSection
        content="用户想让我查天气,先调工具。"
        currentNode={null}
        isStreaming={false}
        expanded={true}
      />,
    )
    expect(screen.getByTestId('thinking-section-0')).toBeTruthy()
    expect(screen.queryByTestId('thinking-section-title-0')).toBeNull()
    expect(screen.getByTestId('thinking-content').textContent).toContain('先调工具')
  })

  it('显式 markdown 标题:标题行渲染为小节标题', () => {
    render(
      <ThinkingSection
        content={`## 分析问题\n\n${longPara}`}
        currentNode={null}
        isStreaming={false}
        expanded={true}
      />,
    )
    expect(screen.getByTestId('thinking-section-title-0').textContent).toBe('分析问题')
  })

  it('流式时光标渲染在最后节内(仅一次)', () => {
    render(
      <ThinkingSection
        content={`${longPara}\n\n第二段内容。`}
        currentNode={null}
        isStreaming={true}
        expanded={true}
      />,
    )
    const content = screen.getByTestId('thinking-content')
    const cursors = content.querySelectorAll('span.animate-pulse')
    expect(cursors).toHaveLength(1)
  })

  it('折叠态不渲染内容区(分节不影响折叠形态)', () => {
    render(
      <ThinkingSection
        content={longPara}
        currentNode={null}
        isStreaming={false}
        expanded={false}
      />,
    )
    expect(screen.queryByTestId('thinking-content')).toBeNull()
    // 预览文本并入活动行的 subject 槽位(基元用 data-stream-subject 标识,不再有独立 testid)
    const subject = document.querySelector('[data-stream-subject]')?.textContent ?? ''
    expect(subject).toBe(`…${longPara.slice(-60)}`)
  })
})

/**
 * D64 ③(2026-09-24):思考卡**双态标题**装车。判定在 `element-pack#thinkingTitleView`,
 * 本组用例只验渲染位真的用上了它(端内不得再写第二套判据)。
 */
describe('D64 ③ 思考卡双态标题 + H22 手动展开不被自动收起', () => {
  afterEach(() => cleanup())

  it('态一:有思考内容 → 「思考过程」(现状单态不回退)', () => {
    render(
      <ThinkingSection
        content="先拆解需求。"
        currentNode={null}
        isStreaming={false}
        expanded={false}
        refsCount={7}
      />,
    )
    const root = screen.getByTestId('thinking-section')
    expect(root.getAttribute('data-thinking-title-variant')).toBe('thinking')
    expect(root.textContent).toContain('思考过程')
    // 有思考时引用数不得抢标题(两态互斥,思考优先)
    expect(root.textContent).not.toContain('个引用')
  })

  it('态二:无思考但引用数 > 0 → 「使用了 N 个引用」;引用数非法/为 0 → 整段不渲染', () => {
    const { unmount } = render(
      <ThinkingSection
        content=""
        currentNode={null}
        isStreaming={false}
        expanded={false}
        refsCount={3}
      />,
    )
    const root = screen.getByTestId('thinking-section')
    expect(root.getAttribute('data-thinking-title-variant')).toBe('refs')
    expect(root.textContent).toContain('使用了 3 个引用')
    unmount()

    // 反例:0 / 负数 / 非有限 + 无思考 ⇒ 与改造前一致,不渲染空壳
    for (const bad of [0, -2, Number.NaN]) {
      render(
        <ThinkingSection
          content=""
          currentNode={null}
          isStreaming={false}
          expanded={false}
          refsCount={bad}
        />,
      )
      expect(screen.queryByTestId('thinking-section')).toBeNull()
      cleanup()
    }
  })

  it('H22 反超判据:非受控下用户手动展开,流式开始→结束后仍保持展开', () => {
    const view = render(
      <ThinkingSection content="先拆解需求。" currentNode={null} isStreaming={false} />,
    )
    // 初始折叠(无 localStorage 偏好)
    expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-expanded')).toBe(
      'false',
    )
    // 用户手动展开
    fireEvent.click(screen.getByTestId('thinking-toggle'))
    expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-expanded')).toBe(
      'true',
    )
    // 走一轮流式:自动展开逻辑不得把"用户已展开"认作自己接管的结果
    view.rerender(
      <ThinkingSection content="先拆解需求,再定工具。" currentNode={null} isStreaming={true} />,
    )
    view.rerender(
      <ThinkingSection content="先拆解需求,再定工具。" currentNode={null} isStreaming={false} />,
    )
    expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-expanded')).toBe(
      'true',
    )
    expect(screen.getByTestId('thinking-content').textContent).toContain('再定工具')
  })

  it('对照:H22 只在"自动展开"时成立 —— 未手动干预的流式结束照旧自动收起', () => {
    const view = render(
      <ThinkingSection content="先拆解需求。" currentNode={null} isStreaming={true} />,
    )
    expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-expanded')).toBe(
      'true',
    )
    view.rerender(<ThinkingSection content="先拆解需求。" currentNode={null} isStreaming={false} />)
    expect(screen.getByTestId('thinking-section').getAttribute('data-thinking-expanded')).toBe(
      'false',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
