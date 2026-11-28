// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  AGENT_TASK_ARCHIVE_STEP_PREVIEW,
  archiveAgentTask,
  listAgentTaskArchive,
} from '../agent-task-archive'

const dirs: string[] = []

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-agent-archive-'))
  dirs.push(dir)
  return dir
}

function task(taskId: string, userId = 'u1'): Record<string, unknown> {
  return {
    taskId,
    userId,
    sessionId: 's1',
    goal: 'g',
    status: 'completed',
    startedAt: '2026-11-27T08:00:00.000Z',
    updatedAt: '2026-11-27T08:01:00.000Z',
    iterations: 1,
    steps: [{ iteration: 1, type: 'llm', content: 'hello' }],
    result: 'done',
    error: null,
  }
}

beforeEach(() => {
  process.env.IHUI_AGENT_TASK_ARCHIVE = 'on'
})

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  delete process.env.IHUI_AGENT_TASK_ARCHIVE
})

describe('agent task archive', () => {
  it('写入 JSONL 后可回放；同 taskId 只取最新一行', () => {
    const root = tempRoot()
    const now = new Date('2026-11-27T08:00:00.000Z')
    expect(archiveAgentTask(task('t1'), { storeRoot: root, now }).ok).toBe(true)
    const updated = { ...task('t1'), status: 'failed', error: 'boom' }
    expect(archiveAgentTask(updated, { storeRoot: root, now }).ok).toBe(true)

    const rows = listAgentTaskArchive({ storeRoot: root }).filter((row) => row.taskId === 't1')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.status).toBe('failed')
    const line = readFileSync(join(root, 'workspace-agent-tasks', 'tasks-2026-11-27.jsonl'), 'utf8')
    expect(line.trim().split('\n')).toHaveLength(2)
  })

  it('按 userId 过滤，limit 生效', () => {
    const root = tempRoot()
    const now = new Date('2026-11-27T08:00:00.000Z')
    for (let i = 0; i < 5; i += 1) {
      archiveAgentTask(task(`u1-${i}`, 'u1'), { storeRoot: root, now })
      archiveAgentTask(task(`u2-${i}`, 'u2'), { storeRoot: root, now })
    }
    expect(listAgentTaskArchive({ storeRoot: root, userId: 'u1' })).toHaveLength(5)
    expect(listAgentTaskArchive({ storeRoot: root, userId: 'u2', limit: 2 })).toHaveLength(2)
  })

  it('敏感键脱敏，usage.tokens 与命令文本保留', () => {
    const root = tempRoot()
    const secret = {
      ...task('secret'),
      authorization: 'Bearer abc',
      nested: { apiKey: 'sk-live', tokens: 123 },
      command: 'curl -H "X-Test: visible" https://example.com',
    }
    expect(archiveAgentTask(secret, { storeRoot: root }).ok).toBe(true)
    const row = listAgentTaskArchive({ storeRoot: root })[0] as Record<string, unknown>
    expect(row['authorization']).toBe('[REDACTED]')
    expect((row['nested'] as Record<string, unknown>)['apiKey']).toBe('[REDACTED]')
    expect((row['nested'] as Record<string, unknown>)['tokens']).toBe(123)
    expect(row['command']).toContain('visible')
  })

  it('新进程读同一 storeRoot，步骤顺序与 usage 不丢（模拟 API 重启）', () => {
    const root = tempRoot()
    const taskWithUsage = {
      ...task('restart'),
      usage: { promptTokens: 120, completionTokens: 30, totalTokens: 150 },
      result: 'final answer',
      steps: [
        { iteration: 1, type: 'llm', content: 'first' },
        { iteration: 1, type: 'tool_call', tool: 'read_file', content: '{"path":"README.md"}' },
        { iteration: 1, type: 'tool_result', tool: 'read_file', content: 'line-1' },
      ],
    }
    expect(archiveAgentTask(taskWithUsage, { storeRoot: root }).ok).toBe(true)

    const moduleUrl = pathToFileURL(
      fileURLToPath(new URL('../agent-task-archive.ts', import.meta.url)),
    ).href
    const script = `import { listAgentTaskArchive } from ${JSON.stringify(moduleUrl)};
const rows = listAgentTaskArchive({ storeRoot: ${JSON.stringify(root)} });
process.stdout.write(JSON.stringify(rows[0] ?? null));`
    const stdout = execFileSync(process.execPath, ['--import', 'tsx', '-e', script], {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      env: { ...process.env, IHUI_AGENT_TASK_ARCHIVE: 'on', IHUI_STORE_ROOT: root },
      encoding: 'utf8',
    })
    const row = JSON.parse(stdout) as Record<string, unknown>
    expect(row['taskId']).toBe('restart')
    expect(row['usage']).toEqual({ promptTokens: 120, completionTokens: 30, totalTokens: 150 })
    expect(row['result']).toBe('final answer')
    expect((row['steps'] as Array<Record<string, unknown>>).map((step) => step['type'])).toEqual([
      'llm',
      'tool_call',
      'tool_result',
    ])
    expect((row['steps'] as Array<Record<string, unknown>>)[1]?.['tool']).toBe('read_file')
  })

  it('超大任务压步骤预览并标 archiveTruncated', () => {
    const root = tempRoot()
    const huge = {
      ...task('huge'),
      steps: [{ iteration: 1, type: 'tool_result', content: 'x'.repeat(1_500_000) }],
    }
    expect(archiveAgentTask(huge, { storeRoot: root }).ok).toBe(true)
    const row = listAgentTaskArchive({ storeRoot: root })[0]
    expect(row?.['archiveTruncated']).toBe(true)
    const steps = row?.['steps'] as Array<{ content: string }>
    expect(steps[0]?.content).toHaveLength(AGENT_TASK_ARCHIVE_STEP_PREVIEW)
  })

  it('IHUI_AGENT_TASK_ARCHIVE=off 时不写盘', () => {
    const root = tempRoot()
    process.env.IHUI_AGENT_TASK_ARCHIVE = 'off'
    const result = archiveAgentTask(task('off'), { storeRoot: root })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('archive-disabled')
    expect(listAgentTaskArchive({ storeRoot: root })).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
