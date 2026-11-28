// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { createDeviceExecutionTracker } from '../device-execution'

function fixedClock(start = 1_000) {
  let value = start
  return () => {
    value += 10
    return value
  }
}

describe('device execution tracker', () => {
  it('tool_call → tool_result 就地收口同一张卡,不追加第二张', () => {
    const tracker = createDeviceExecutionTracker({ now: fixedClock() })
    const id = tracker.onToolCall('read_file', { path: 'src/a.ts' })
    expect(id).toBe('dev-tool-1')
    expect(tracker.snapshot().toolCalls).toEqual([
      { id: 'dev-tool-1', toolName: 'read_file', args: { path: 'src/a.ts' }, status: 'running' },
    ])

    tracker.onToolResult('read_file', true, 'export const a = 1')
    const calls = tracker.snapshot().toolCalls
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      id: 'dev-tool-1',
      toolName: 'read_file',
      status: 'success',
      result: 'export const a = 1',
    })
    expect(calls[0]!.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('命令类工具同时投影终端卡:start→running,result→completed + 输出', () => {
    const tracker = createDeviceExecutionTracker({ now: fixedClock() })
    tracker.onToolCall('run_command', { command: 'pnpm test' })
    expect(tracker.snapshot().terminalTasks).toEqual([
      {
        id: 'dev-term-dev-tool-1',
        command: 'pnpm test',
        status: 'running',
        startedAt: expect.any(String),
      },
    ])

    tracker.onToolResult('run_command', true, 'all tests passed')
    const task = tracker.snapshot().terminalTasks[0]!
    expect(task).toMatchObject({
      id: 'dev-term-dev-tool-1',
      command: 'pnpm test',
      status: 'completed',
      output: 'all tests passed',
    })
    expect(task.endedAt).toEqual(expect.any(String))
    expect(task.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('没有 start 的 result 也补一张卡(旧事件/重启补报不丢执行痕迹)', () => {
    const tracker = createDeviceExecutionTracker()
    tracker.onToolResult('edit_file', false, 'permission denied')
    const calls = tracker.snapshot().toolCalls
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      id: 'dev-tool-1',
      toolName: 'edit_file',
      status: 'error',
      isError: true,
    })
  })

  it('并行同名工具:结果收口最近一张 running 卡', () => {
    const tracker = createDeviceExecutionTracker()
    tracker.onToolCall('read_file', { path: 'a.ts' })
    tracker.onToolCall('read_file', { path: 'b.ts' })
    tracker.onToolResult('read_file', true, 'b')
    tracker.onToolResult('read_file', true, 'a')
    const calls = tracker.snapshot().toolCalls
    expect(calls.map((call) => call.status)).toEqual(['success', 'success'])
    expect(calls.map((call) => call.result)).toEqual(['a', 'b'])
  })

  it('超长结果按 6000 字符截断为可渲染的 preview', () => {
    const tracker = createDeviceExecutionTracker()
    tracker.onToolCall('run_command', { command: 'cat big.log' })
    tracker.onToolResult('run_command', true, 'x'.repeat(7000))
    const result = tracker.snapshot().toolCalls[0]!.result as {
      truncated?: boolean
      preview?: string
    }
    expect(result.truncated).toBe(true)
    expect(result.preview).toHaveLength(6000)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
