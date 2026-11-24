// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => {
  // 与 packages/i18n/messages/web/zh-CN.json 的 ai.toolCall 同名键保持一致;
  // rollbackAdded/rollbackModified/rollbackDeleted 为本次提议新键(主 agent 入词表,见交付物清单)
  const ZH: Record<string, string> = {
    toolUnknownFile: '(未知文件)',
    rollbackAdded: '将被添加',
    rollbackModified: '将修改',
    rollbackDeleted: '将删除',
  }
  const translate = (key: string, params?: Record<string, number>) => {
    const template = ZH[key] ?? key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (_m, name) => String(params[name] ?? ''))
  }
  return { useTranslations: () => translate }
})

// 基线红修复:ToolCallCard 详情区(line 293 `<Tooltip content={url}>`)在无 Provider 时
// 抛 "Tooltip must be used within TooltipProvider"。按本仓既有惯例(同组件的
// tool-call-card-activity.test.tsx:43、context-usage-attribution.test.tsx:67)在测试侧
// mock 掉 feedback 的 Tooltip 为透传 children,不改生产代码、不放宽任何断言。
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import {
  RollbackPreviewBadge,
  ToolCallCard,
  resolveRollbackPreviewState,
} from '../tool-call-card'

/** 展开工具卡详情(徽章在详情区顶部,折叠态不可见) */
function expand(toolName: string, toolCallId: string): void {
  fireEvent.click(screen.getByTestId(`tool-call-row-${toolCallId ?? toolName}`))
}

/**
 * G-68 回退预判三态徽章(D53 一并实施)守门测试。
 *
 * 三态各一用例:added(将被添加)/modified(将修改)/deleted(将删除),
 * 另覆盖:无 diff 不渲染 + 新建文件自动推导 added。
 */
describe('resolveRollbackPreviewState 归一', () => {
  it('显式传入优先(diff 推导被覆盖)', () => {
    expect(
      resolveRollbackPreviewState({
        rollbackState: 'deleted',
        isNewFile: true,
        hasDiff: true,
      }),
    ).toBe('deleted')
  })

  it('新建文件 diff → added', () => {
    expect(
      resolveRollbackPreviewState({ isNewFile: true, hasDiff: true }),
    ).toBe('added')
  })

  it('有旧内容 diff → modified', () => {
    expect(
      resolveRollbackPreviewState({ isNewFile: false, hasDiff: true }),
    ).toBe('modified')
  })

  it('无 diff → null(不渲染,删除只能显式传入)', () => {
    expect(resolveRollbackPreviewState({ hasDiff: false })).toBeNull()
  })
})

describe('RollbackPreviewBadge 三态渲染', () => {
  afterEach(() => cleanup())

  it('added:将被添加', () => {
    render(<RollbackPreviewBadge state="added" />)
    const badge = screen.getByTestId('rollback-badge-added')
    expect(badge.textContent).toContain('将被添加')
  })

  it('modified:将修改', () => {
    render(<RollbackPreviewBadge state="modified" />)
    const badge = screen.getByTestId('rollback-badge-modified')
    expect(badge.textContent).toContain('将修改')
  })

  it('deleted:将删除', () => {
    render(<RollbackPreviewBadge state="deleted" />)
    const badge = screen.getByTestId('rollback-badge-deleted')
    expect(badge.textContent).toContain('将删除')
  })
})

describe('ToolCallCard 回退徽章接线', () => {
  afterEach(() => cleanup())

  it('write_file 新建文件 → 自动推导 added(无需显式传)', () => {
    render(
      <ToolCallCard
        toolCallId="rb-add"
        toolName="write_file"
        args={{ path: 'notes/new.md', content: 'hello' }}
        status="success"
      />,
    )
    expand('write_file', 'rb-add')
    expect(screen.getByTestId('rollback-badge-added').textContent).toContain('将被添加')
  })

  it('edit_file 有旧内容 → 自动推导 modified', () => {
    render(
      <ToolCallCard
        toolCallId="rb-mod"
        toolName="edit_file"
        args={{ path: 'a.ts', old_text: 'x', new_text: 'y' }}
        status="success"
      />,
    )
    expand('edit_file', 'rb-mod')
    expect(screen.getByTestId('rollback-badge-modified').textContent).toContain('将修改')
  })

  it('显式 deleted 覆盖推导', () => {
    render(
      <ToolCallCard
        toolCallId="rb-del"
        toolName="edit_file"
        args={{ path: 'a.ts', old_text: 'x', new_text: 'y' }}
        status="success"
        rollbackState="deleted"
      />,
    )
    expand('edit_file', 'rb-del')
    expect(screen.getByTestId('rollback-badge-deleted').textContent).toContain('将删除')
    expect(screen.queryByTestId('rollback-badge-modified')).toBeNull()
  })

  it('无 diff 工具默认不渲染回退徽章', () => {
    render(
      <ToolCallCard
        toolCallId="rb-none"
        toolName="search_codebase"
        args={{ query: 'config' }}
        status="success"
      />,
    )
    expand('search_codebase', 'rb-none')
    expect(screen.queryByTestId('rollback-badge-added')).toBeNull()
    expect(screen.queryByTestId('rollback-badge-modified')).toBeNull()
    expect(screen.queryByTestId('rollback-badge-deleted')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
