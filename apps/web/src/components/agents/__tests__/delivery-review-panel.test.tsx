// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D27(2026-09-20 立):DeliveryReviewPanel 渲染测试。
 *
 * 覆盖:加载态/空态分支、三段式主体(总结区+溯源引用+文件变更)、
 * kind 徽章三色(add=emerald/delete=rose/update=amber)、
 * CitationBar 四新 source 色(wiki=cyan/memory=fuchsia/skill=lime/mcp=orange)、
 * filesChanged 为空时的 filesEmpty 兜底。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      loading: '交付清单生成中…',
      empty: '暂无交付数据',
      summary: '输出摘要',
      toolsSummary: '工具调用:',
      filesChanged: '文件变更',
      filesEmpty: '无文件变更记录',
      kindAdd: '新增',
      kindDelete: '删除',
      kindUpdate: '修改',
      stepsTooltip: '涉及步骤',
      generatedAt: '生成于 {time}',
      // CitationBar 使用 ai.pane 命名空间的引用条标题
      'citationBar.title': '溯源引用',
    }
    let out = map[key] ?? key
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        out = out.split(`{${k}}`).join(String(v))
      }
    }
    return out
  },
  useLocale: () => 'zh-CN',
}))

// Tooltip 依赖 TooltipProvider(radix),单测中直接透传 children
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

// CitationBar 内部读取 WorkPanel store(非外链点击跳转用),测试环境注入空实现
vi.mock('@/stores/work-panel', () => ({
  useWorkPanelStore: (selector: (s: { openPanel: () => void }) => unknown) =>
    selector({ openPanel: () => {} }),
}))

import { DeliveryReviewPanel, FILE_KIND_BADGE_CLS } from '../DeliveryReviewPanel'
import type { TaskDeliverables } from '@/types/agent-delivery'

/** 合法基线样本:四新 source 引用 + 三种 kind 文件变更 + 工具统计齐全 */
const baseDeliverables: TaskDeliverables = {
  citations: [
    { source: 'wiki', label: '架构页', url: 'https://aizhs.top/wiki/1' },
    { source: 'memory', label: '用户偏好', url: '' },
    { source: 'skill', label: '部署技能', url: '' },
    { source: 'mcp', label: '外部工具', url: '' },
  ],
  filesChanged: [
    { path: 'src/a.ts', kind: 'add', stepIds: ['s1'], additions: 10, deletions: 0 },
    { path: 'src/b.ts', kind: 'delete', stepIds: [], additions: 0, deletions: 4 },
    { path: 'src/c.ts', kind: 'update', stepIds: ['s2', 's3'], additions: 6, deletions: 2 },
  ],
  toolsSummary: { total: 5, byTool: { read_file: 3, grep: 2 } },
  outputSummary: '完成功能 X 并通过测试',
  generatedAt: '2026-09-20T08:00:00.000Z',
}

/**
 * 取指定 testid 元素的徽章 className。
 * 兼容两种 DOM 结构:CitationBar 的 testid 挂在容器上(徽章 class 在首个子 span),
 * DeliveryReviewPanel 的 kind 徽章 testid 与 class 同在一个 span 上(无子 span 可查)。
 */
function firstSpanClass(testid: string): string {
  const el = screen.getByTestId(testid)
  return el.querySelector('span')?.className || el.className
}

describe('DeliveryReviewPanel 渲染(D27 交付审查视图)', () => {
  afterEach(() => cleanup())

  it('null + loading → 加载态;null → 空态(不渲染主体,不出空 DOM)', () => {
    const { rerender } = render(<DeliveryReviewPanel deliverables={null} loading />)
    expect(screen.getByTestId('delivery-review-loading').textContent).toBe('交付清单生成中…')
    rerender(<DeliveryReviewPanel deliverables={null} />)
    expect(screen.getByTestId('delivery-review-empty').textContent).toBe('暂无交付数据')
    expect(screen.queryByTestId('delivery-review-panel')).toBeNull()
  })

  it('完整数据:总结区/工具徽章/生成时间渲染', () => {
    render(<DeliveryReviewPanel deliverables={baseDeliverables} />)
    expect(screen.getByTestId('delivery-review-panel')).toBeTruthy()
    expect(screen.getByTestId('delivery-review-summary').textContent).toContain('完成功能 X')
    expect(screen.getByTestId('delivery-review-tool-read_file').textContent).toContain('×3')
    expect(screen.getByTestId('delivery-review-tool-grep').textContent).toContain('×2')
    expect(screen.getByTestId('delivery-review-generated-at').textContent).toContain('生成于')
  })

  it('kind 徽章三色(emerald/rose/amber)+ 增删统计 + 步骤提示', () => {
    render(<DeliveryReviewPanel deliverables={baseDeliverables} />)
    expect(firstSpanClass('delivery-review-kind-0')).toContain('bg-emerald-500/15')
    expect(firstSpanClass('delivery-review-kind-1')).toContain('bg-rose-500/15')
    expect(firstSpanClass('delivery-review-kind-2')).toContain('bg-amber-500/15')
    // 配色常量契约(供源码级复用处对齐)
    expect(FILE_KIND_BADGE_CLS.add).toContain('text-emerald-600')
    expect(FILE_KIND_BADGE_CLS.delete).toContain('text-rose-600')
    expect(FILE_KIND_BADGE_CLS.update).toContain('text-amber-600')
    // 增删统计与步骤徽章
    expect(screen.getByTestId('delivery-review-file-0').textContent).toContain('+10')
    expect(screen.getByTestId('delivery-review-file-1').textContent).toContain('-4')
    expect(screen.getByTestId('delivery-review-steps-2').textContent).toBe('S2')
    // 无步骤的文件行不渲染步骤徽章
    expect(screen.queryByTestId('delivery-review-steps-1')).toBeNull()
  })

  it('CitationBar 四新 source 色:wiki=cyan / memory=fuchsia / skill=lime / mcp=orange', () => {
    render(<DeliveryReviewPanel deliverables={baseDeliverables} />)
    expect(firstSpanClass('citation-item-0')).toContain('text-cyan-600')
    expect(firstSpanClass('citation-item-1')).toContain('text-fuchsia-600')
    expect(firstSpanClass('citation-item-2')).toContain('text-lime-600')
    expect(firstSpanClass('citation-item-3')).toContain('text-orange-600')
  })

  it('空文件/空引用兜底:filesEmpty 提示 + CitationBar 不渲染', () => {
    render(
      <DeliveryReviewPanel
        deliverables={{ ...baseDeliverables, citations: [], filesChanged: [] }}
      />,
    )
    expect(screen.getByTestId('delivery-review-files').textContent).toContain('无文件变更记录')
    // citations 为空时 CitationBar 返回 null,不产生引用条 DOM
    expect(screen.queryByTestId('citation-item-0')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
