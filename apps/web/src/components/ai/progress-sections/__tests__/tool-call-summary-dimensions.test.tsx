// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * 工具摘要维度补齐 · chip 渲染位证据(2026-10-29 立)。
 *
 * 立因:对标 Qoder `buildToolsSummary` 七项(files / directories / searches / edits /
 * terminalCommands / webCalls / toolCalls)后,我方只剩 directories / edits /
 * terminalCommands 三档真缺。判据已接到既有映射(共享层 `FILE_WRITE_TOOLS`、类目表
 * `resolveToolCategory`、路径键 `pickFilePath`),本件咬"接上了且展示出来"。
 *
 * 三条纪律逐条锁:
 *  ① 三档读数来自既有映射,不是新造的工具名清单(包含关系 + 类目表口径);
 *  ② 后端 summary 未携带这三键(undefined)时**不渲染**该 chip —— 不用 0 冒充"没碰过";
 *  ③ 既有 5 档 chip 一件不少(布局不塌)。
 */
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}))

import { ToolCallSummaryCard } from '../tool-call-summary-card'
import { resolveToolCategory } from '../tool-category'
import { FILE_WRITE_TOOLS } from '@ihui/shared/chat'

afterEach(() => cleanup())

function chipIds(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-testid^="tool-call-summary-chip-"]'),
  )
    .map((el) => (el.getAttribute('data-testid') ?? '').replace('tool-call-summary-chip-', ''))
    .sort()
}

const EDITOR_ARGS = { file_path: 'apps/web/src/a.ts', new_string: 'x\ny' }

describe('工具摘要 · 补齐三档(directories / edits / terminalCommands)', () => {
  it('读文件 + 编辑 + 命令 ⇒ 三档 chip 都出现且读数正确', () => {
    const { container } = render(
      <ToolCallSummaryCard
        toolCalls={[
          { toolName: 'read_file', args: { file_path: 'apps/web/src/a.ts' } },
          { toolName: 'read_file', args: { file_path: 'apps/web/src/b.ts' } },
          { toolName: 'edit_file', args: EDITOR_ARGS },
          { toolName: 'run_command', args: { command: 'pnpm test' } },
        ]}
      />,
    )
    // 两个文件同目录 ⇒ 目录数 1(唯一集合,不是调用次数)
    expect(
      container.querySelector('[data-testid="tool-call-summary-chip-directories"]'),
    ).not.toBeNull()
    expect(
      container.querySelector('[data-testid="tool-call-summary-chip-directories"]')!.textContent,
    ).toContain('1')
    expect(container.querySelector('[data-testid="tool-call-summary-chip-edits"]')).not.toBeNull()
    expect(
      container.querySelector('[data-testid="tool-call-summary-chip-terminalCommands"]'),
    ).not.toBeNull()
  })

  it('不同目录 ⇒ 目录数按唯一集合计(read_file 两次不同目录 = 2)', () => {
    const { container } = render(
      <ToolCallSummaryCard
        toolCalls={[
          { toolName: 'read_file', args: { file_path: 'apps/web/src/a.ts' } },
          { toolName: 'read_file', args: { file_path: 'apps/api/src/b.ts' } },
        ]}
      />,
    )
    expect(
      container.querySelector('[data-testid="tool-call-summary-chip-directories"]')!.textContent,
    ).toContain('2')
  })

  it('无目录段的裸文件名不计目录(不造 "/" 假目录)', () => {
    const { container } = render(
      <ToolCallSummaryCard toolCalls={[{ toolName: 'read_file', args: { path: 'a.ts' } }]} />,
    )
    expect(container.querySelector('[data-testid="tool-call-summary-chip-directories"]')).toBeNull()
  })

  it('后端 summary 未带三键 + 有 toolCalls ⇒ 从本地聚合补齐(生产面才看得见)', () => {
    const { container } = render(
      <ToolCallSummaryCard
        summary={{
          filesSearched: 2,
          webSearched: 0,
          filesModified: 1,
          linesAdded: 3,
          linesDeleted: 0,
          toolsByCategory: { read_file: 1, edit_file: 1, run_command: 1 },
          totalCalls: 3,
        }}
        toolCalls={[
          { toolName: 'read_file', args: { file_path: 'apps/web/src/a.ts' } },
          { toolName: 'edit_file', args: EDITOR_ARGS },
          { toolName: 'run_command', args: { command: 'pnpm test' } },
        ]}
      />,
    )
    const ids = chipIds(container)
    // 既有档照旧取 summary(权威),三档取本地补齐
    expect(ids).toEqual([
      'directories',
      'edits',
      'filesModified',
      'filesSearched',
      'linesAdded',
      'terminalCommands',
    ])
  })

  it('summary 已带三键 ⇒ 以 summary 为准,本地读数不得覆盖(后端是权威)', () => {
    const { container } = render(
      <ToolCallSummaryCard
        summary={{
          filesSearched: 0,
          webSearched: 0,
          filesModified: 1,
          linesAdded: 3,
          linesDeleted: 0,
          toolsByCategory: { edit_file: 1 },
          totalCalls: 1,
          directories: 7,
          edits: 9,
          terminalCommands: 4,
        }}
        toolCalls={[{ toolName: 'edit_file', args: EDITOR_ARGS }]}
      />,
    )
    const chip = (key: string) =>
      container.querySelector(`[data-testid="tool-call-summary-chip-${key}"]`)?.textContent ?? ''
    expect(chip('directories')).toContain('7')
    expect(chip('edits')).toContain('9')
    expect(chip('terminalCommands')).toContain('4')
  })

  it('后端 summary 未带三键 ⇒ 三档不渲染(单有 summary、无 toolCalls 时不得猜)', () => {
    const { container } = render(
      <ToolCallSummaryCard
        summary={{
          filesSearched: 2,
          webSearched: 0,
          filesModified: 1,
          linesAdded: 3,
          linesDeleted: 0,
          toolsByCategory: { read_file: 2, edit_file: 1 },
          totalCalls: 3,
        }}
      />,
    )
    const ids = chipIds(container)
    expect(ids).toEqual(['filesModified', 'filesSearched', 'linesAdded'])
  })

  it('既有 5 档 chip 一件不少(布局不塌)', () => {
    const { container } = render(
      <ToolCallSummaryCard
        toolCalls={[
          { toolName: 'read_file', args: { file_path: 'apps/web/src/a.ts' } },
          { toolName: 'web_search', args: { query: 'q' } },
          { toolName: 'edit_file', args: EDITOR_ARGS },
        ]}
      />,
    )
    const ids = chipIds(container)
    for (const key of [
      'filesSearched',
      'webSearched',
      'filesModified',
      'linesAdded',
      'directories',
      'edits',
    ]) {
      expect(ids).toContain(key)
    }
    // 容器只有一行(flex-wrap),不因新增 chip 变成第二行容器
    expect(container.querySelectorAll('[data-testid="tool-call-summary-chips"]')).toHaveLength(1)
  })
})

describe('工具摘要 · 三档判据同源(不新造工具名清单)', () => {
  it('编辑次数用的写类白名单包含后端 filesModified 口径的全部工具(包含关系,不是两把尺子)', () => {
    // 后端 llm.py _FILE_MODIFY_TOOLS = {file_edit, write_file};前端历史并集额外含
    // edit_file / create_file / delete_file。共享层白名单必须覆盖它们。
    for (const name of ['file_edit', 'write_file', 'edit_file', 'create_file', 'delete_file']) {
      expect(FILE_WRITE_TOOLS.has(name)).toBe(true)
    }
  })

  it('命令数取类目表 command 档,不另立名单', () => {
    for (const name of ['run_command', 'execute_command', 'shell', 'bash', 'terminal', 'exec']) {
      expect(resolveToolCategory(name)).toBe('command')
    }
    // 只读探查类不进命令档(类目表口径,本层不判参数)
    expect(resolveToolCategory('read_file')).toBe('file_read')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
