// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D83 装车证明:MCP server×tool 定制措辞在 web 任务状态条被真正取用(不是回落到通用名/码名)。
// 夹具与 ../__tests__/task-status-bar-activity.test.tsx 同一套:next-intl 由真实 zh-CN shared
// 语言包 + formatIcu 驱动,断言用同一渲染器算期望值,不抄第二份文案。
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatIcu, hasIcuSyntax } from '@ihui/i18n'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

type HarnessTask = { kind: 'tool'; toolName: string; mcpName?: string; label: string }

const harness = vi.hoisted(() => ({
  chat: { conversationId: 1, isStreaming: true, messages: [] as unknown[] },
  agent: {
    isStreaming: true,
    planSteps: [] as unknown[],
    changes: [] as unknown[],
    overview: { status: 'running' },
    currentTask: {
      kind: 'tool',
      toolName: 'mcp__github__create_issue',
      mcpName: 'github',
      label: '',
    } as HarnessTask,
  },
}))

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (s: typeof harness.chat) => unknown) => selector(harness.chat),
}))

vi.mock('@/hooks/use-agent-progress', () => ({
  useAgentProgress: () => harness.agent,
}))

vi.mock('next-intl', async () => {
  // 工厂内自取依赖:vi.mock 会被提到 import 之前执行,引用模块作用域绑定会踩 TDZ
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu, hasIcuSyntax: hasIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../packages/i18n/messages/shared/zh-CN.json',
  )
  const taskStatus = (JSON.parse(readFile(pack, 'utf8')) as { taskStatus: Record<string, string> })
    .taskStatus
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        if (ns !== 'taskStatus') return key
        const raw = taskStatus[key] ?? key
        return hasIcu(raw) ? renderIcu(raw, values ?? {}, { locale: 'zh-CN' }) : raw
      },
  }
})

import { TaskStatusBar } from '../task-status-bar'

const here = dirname(fileURLToPath(import.meta.url))
const taskStatusPack = (
  JSON.parse(
    readFileSync(join(here, '../../../../../../packages/i18n/messages/shared/zh-CN.json'), 'utf8'),
  ) as { taskStatus: Record<string, string> }
).taskStatus

/** 语言包缺键必须让用例炸掉,而不是拿 undefined 去和界面文本比 */
function msg(key: string): string {
  const value = taskStatusPack[key]
  if (typeof value !== 'string' || value === '') throw new Error(`zh-CN 语言包缺键 ${key}`)
  return value
}

function renderKey(key: string, values: Record<string, string | number>): string {
  const raw = msg(key)
  return hasIcuSyntax(raw) ? formatIcu(raw, values, { locale: 'zh-CN' }) : raw
}

function setTool(task: { toolName: string; mcpName?: string }): void {
  harness.agent.currentTask = { kind: 'tool', label: '', ...task }
}

function barText(): string {
  return render(<TaskStatusBar />).container.textContent ?? ''
}

describe('任务状态条 MCP 定制措辞接线(D83 装车证明)', () => {
  afterEach(() => cleanup())

  it('github×create_issue → server×tool 定制措辞,不回落到通用名/码名', () => {
    setTool({ toolName: 'mcp__github__create_issue', mcpName: 'github' })
    const text = barText()
    expect(text).toContain(renderKey('toolMcpGithubCreateIssueActivity', { state: 'running' }))
    expect(text).not.toContain('create_issue')
    // 定制命中时不再走旧的"调用 {mcp} MCP"泛化句式
    expect(text).not.toContain(renderKey('activityMcp', { mcp: 'github' }))
  })

  it('只登记 server 档的动态工具 → 回落 server 通用条目(仍非码名回显)', () => {
    setTool({ toolName: 'mcp__github__whatever_new', mcpName: 'github' })
    const text = barText()
    expect(text).toContain(renderKey('toolMcpServerGithubActivity', { state: 'running' }))
    expect(text).not.toContain('whatever_new')
  })

  it('未登记 server 且未登记工具 → 链尾走 activityMcp,码名裸名不得上界面', () => {
    setTool({ toolName: 'mcp__demo__nope', mcpName: 'demo' })
    const text = barText()
    expect(text).toContain(renderKey('activityMcp', { mcp: 'demo' }))
    expect(text).not.toContain('mcp__demo__nope')
    expect(text.trim()).not.toBe('')
  })

  it('内置工具不受接线影响(回归:仍是双时态惯用档)', () => {
    setTool({ toolName: 'read_file' })
    const text = barText()
    expect(text).toContain(renderKey('toolReadFileActivity', { state: 'running' }))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
