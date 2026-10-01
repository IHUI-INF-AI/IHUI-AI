// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// b76-13 票7(2026-09-30 立):web 三处 progress-sections 的消费侧裁尾接线配对测试。
//
// 票面纪律「消费者绝不施加界 —— 淘汰必须说出来 + 继续可数」:
//   - changes/terminal/tool-calls 三组件一律走 @ihui/api-client/client 的
//     tailWithOmittedCount 唯一出口,不得自设 slice(-N);
//   - 裁掉的条数(omittedCount)必须渲染成「…还有 N 项」露出;
//   - 0 条淘汰时不渲染占位(不许有无中生有的 "还有 0 项")。
// 守门:scripts/check-list-cap-honesty.mjs(缺省档 0 命中)。

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

import { ChangesSection } from '../src/components/ai/progress-sections/changes-section'
import { TerminalSection } from '../src/components/ai/progress-sections/terminal-section'
import { ToolCallsSection } from '../src/components/ai/progress-sections/tool-calls-section'

// ─── next-intl mock:查表 + {n} 插值;未登记的 key 原样返回(不会误中「还有」断言) ──
const { I18N_MAP } = vi.hoisted(() => ({
  I18N_MAP: {
    'changes.title': '文件变更',
    'changes.added': '新增 {n}',
    'changes.modified': '修改 {n}',
    'changes.moreItems': '…还有 {n} 项',
    'terminal.title': '终端任务',
    'terminal.isolation': '独立终端实例',
    'terminal.moreItems': '…还有 {n} 项',
    'tools.title': '工具调用',
    'tools.moreItems': '…还有 {n} 项',
  } as Record<string, string>,
}))
vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, params?: Record<string, string | number>): string => {
      const tmpl = I18N_MAP[key] ?? key
      if (!params) return tmpl
      return tmpl.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''))
    },
}))

// ─── @ihui/api-client 主入口:TerminalInputRow 的上行函数(本票不触达,给空实现) ──
vi.mock('@ihui/api-client', () => ({
  postTerminalInput: vi.fn(async () => ({ ok: true })),
}))
// tailWithOmittedCount 走 '@ihui/api-client/client' 真实出口(纯函数,不 mock)

// ─── @/stores/chat:TerminalItem 只订阅这几个切片 ──
vi.mock('@/stores/chat', () => {
  const state = {
    setTerminalInteraction: vi.fn(),
    clearTerminalInteraction: vi.fn(),
    terminalOutputs: {} as Record<string, string>,
    terminalInteractions: {} as Record<string, unknown>,
    clearTerminalOutput: vi.fn(),
  }
  return {
    useChatStore: (selector: (s: typeof state) => unknown): unknown => selector(state),
  }
})

// ─── stream-ui 基元:透传 children 的轻量替身(避免拖入整条消息流渲染面) ──
type StubProps = { children?: React.ReactNode; subject?: string } & Record<string, unknown>
vi.mock('@/components/chat/stream/stream-ui', () => ({
  StreamCode: ({ children }: StubProps) => <pre>{children}</pre>,
  StreamDetail: ({ children }: StubProps) => <div>{children}</div>,
  StreamLabel: ({ children }: StubProps) => <span>{children}</span>,
  StreamRow: ({ subject, children }: StubProps) => (
    <div data-stream-row>
      {subject}
      {children}
    </div>
  ),
  StreamTag: ({ children }: StubProps) => <span>{children}</span>,
  useLiveElapsed: () => 0,
  useStreamStatusLabel: () => (status: string) => status,
}))

// ─── Tooltip / ui-react:无需 Provider 的替身 ──
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: StubProps) => <>{children}</>,
}))
vi.mock('@ihui/ui-react', () => ({
  Button: ({ children, ...rest }: StubProps) => <button {...rest}>{children}</button>,
  Input: (props: StubProps) => <input {...props} />,
  SearchInput: (props: StubProps) => <input placeholder={String(props['placeholder'] ?? '')} />,
}))

// ─── 数据构造 ──
function makeChange(i: number) {
  return {
    id: `c-${i}`,
    filePath: `src/module/file-${i}.ts`,
    toolName: 'edit_file',
    diffInfo: { file_path: `src/module/file-${i}.ts`, old_content: '', new_content: 'x' },
    timestamp: '2026-09-30T00:00:00Z',
  }
}
function makeTerminal(i: number) {
  return {
    id: `t-${i}`,
    command: `cmd-${i}`,
    status: 'completed' as const,
    startedAt: '2026-09-30T00:00:00Z',
    exitCode: 0,
  }
}
function makeTool(i: number) {
  return {
    id: `tool-${i}`,
    toolName: `tool_${i}`,
    args: {},
    status: 'success' as const,
    startedAt: '2026-09-30T00:00:00Z',
  }
}

afterEach(cleanup)

describe('b76-13 票7:消费侧裁尾唯一出口(tailWithOmittedCount)', () => {
  it('ChangesSection:13 条裁尾保留 10 条,淘汰 3 条必须说出「…还有 3 项」', () => {
    const changes = Array.from({ length: 13 }, (_, i) => makeChange(i))
    render(<ChangesSection changes={changes} />)
    expect(screen.getByText('…还有 3 项')).toBeTruthy()
  })

  it('ChangesSection:5 条未超预算,0 条淘汰不渲染占位', () => {
    const changes = Array.from({ length: 5 }, (_, i) => makeChange(i))
    render(<ChangesSection changes={changes} />)
    expect(screen.queryByText(/还有/)).toBeNull()
  })

  it('TerminalSection:12 条裁尾淘汰 2 条,必须说出「…还有 2 项」', () => {
    const terminals = Array.from({ length: 12 }, (_, i) => makeTerminal(i))
    render(<TerminalSection terminals={terminals} />)
    expect(screen.getByText('…还有 2 项')).toBeTruthy()
  })

  it('TerminalSection:3 条未超预算,0 条淘汰不渲染占位', () => {
    const terminals = Array.from({ length: 3 }, (_, i) => makeTerminal(i))
    render(<TerminalSection terminals={terminals} />)
    expect(screen.queryByText(/还有/)).toBeNull()
  })

  it('ToolCallsSection:14 条裁尾淘汰 4 条,必须说出「…还有 4 项」', () => {
    const tools = Array.from({ length: 14 }, (_, i) => makeTool(i))
    render(<ToolCallsSection tools={tools} />)
    expect(screen.getByText('…还有 4 项')).toBeTruthy()
  })

  it('ToolCallsSection:4 条未超预算,0 条淘汰不渲染占位', () => {
    const tools = Array.from({ length: 4 }, (_, i) => makeTool(i))
    render(<ToolCallsSection tools={tools} />)
    expect(screen.queryByText(/还有/)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
