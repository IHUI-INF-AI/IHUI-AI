// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D83 装车证明:对话气泡工具行(web ToolCallCard rowTitle)已接上共享层 MCP server×tool
// 定制措辞。夹具与 tool-call-card-activity.test.tsx 同一套(真实 zh-CN shared 包 + formatIcu)。
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatIcu, hasIcuSyntax } from '@ihui/i18n'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ReactNode } from 'react'

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
  const status = (JSON.parse(readFile(pack, 'utf8')) as { taskStatus: Record<string, string> })
    .taskStatus
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        if (ns !== 'taskStatus') return key
        const raw = status[key] ?? key
        return hasIcu(raw) ? renderIcu(raw, values ?? {}, { locale: 'zh-CN' }) : raw
      },
  }
})

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}))

import { ToolCallCard } from '../tool-call-card'

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

function rowText(container: HTMLElement, id: string): string {
  const row = container.querySelector<HTMLElement>(`[data-testid="tool-call-row-${id}"]`)
  if (!row) throw new Error(`未找到工具行 tool-call-row-${id}`)
  return (row.textContent ?? '').trim()
}

function renderMcpCard(
  status: 'running' | 'success' | 'error' | 'cancelled',
  id: string,
  over?: { toolName?: string; serverName?: string | undefined },
) {
  return render(
    <ToolCallCard
      toolCallId={id}
      toolName={over?.toolName ?? 'mcp__github__create_issue'}
      serverSource="mcp"
      serverName={over?.serverName ?? 'github'}
      args={{}}
      status={status}
    />,
  )
}

describe('对话气泡工具行 MCP 定制措辞接线(D83 装车证明)', () => {
  afterEach(() => cleanup())

  it('github×create_issue:running / success 两档都取到 server×tool 定制措辞', () => {
    const { container: runBox } = renderMcpCard('running', 'mcp-run')
    const { container: okBox } = renderMcpCard('success', 'mcp-ok')
    expect(rowText(runBox, 'mcp-run')).toContain(
      renderKey('toolMcpGithubCreateIssueActivity', { state: 'running' }),
    )
    expect(rowText(okBox, 'mcp-ok')).toContain(
      renderKey('toolMcpGithubCreateIssueActivity', { state: 'completed' }),
    )
    // 定制命中 → 原始码名与键名都不得残留在行内
    for (const text of [rowText(runBox, 'mcp-run'), rowText(okBox, 'mcp-ok')]) {
      expect(text).not.toContain('create_issue')
      expect(text).not.toContain('toolMcp')
      expect(text).not.toContain('{state')
    }
  })

  it('server 已登记、工具未登记 → 回落 server 通用条目而非吐码名', () => {
    const { container } = renderMcpCard('running', 'mcp-server', {
      toolName: 'mcp__github__brand_new_tool',
    })
    expect(rowText(container, 'mcp-server')).toContain(
      renderKey('toolMcpServerGithubActivity', { state: 'running' }),
    )
  })

  it('内置工具回归:read_file 仍走既有双时态惯用档', () => {
    const { container } = render(
      <ToolCallCard toolCallId="plain-read" toolName="read_file" args={{}} status="running" />,
    )
    expect(rowText(container, 'plain-read')).toContain(
      renderKey('toolReadFileActivity', { state: 'running' }),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
