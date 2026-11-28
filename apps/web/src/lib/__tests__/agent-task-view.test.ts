// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  type AgentTaskView,
  formatTaskTime,
  isDefaultWorkspacePath,
  pendingApprovalStep,
  stepKind,
  stepTarget,
  taskOutcome,
  taskStepCount,
  truncateText,
  workspaceLabel,
} from '../agent-task-view'

const task = (patch: Partial<AgentTaskView>): AgentTaskView => ({
  taskId: 't1',
  goal: '整理文件',
  status: 'running',
  iterations: 1,
  ...patch,
})

describe('agent-task-view 人话翻译', () => {
  it('工具名压成读/写/命令/搜索，不再暴露原始 tool 名', () => {
    expect(stepKind({ iteration: 1, type: 'tool_call', content: '', tool: 'read_file' })).toBe(
      'read',
    )
    expect(stepKind({ iteration: 1, type: 'tool_call', content: '', tool: 'write_file' })).toBe(
      'write',
    )
    expect(stepKind({ iteration: 1, type: 'tool_call', content: '', tool: 'run_command' })).toBe(
      'command',
    )
    expect(stepKind({ iteration: 1, type: 'tool_call', content: '', tool: 'grep' })).toBe('search')
    expect(stepKind({ iteration: 1, type: 'tool_result', content: '' })).toBe('done')
  })

  it('从工具参数里提取文件/命令/搜索目标，路径只留最后一段', () => {
    expect(
      stepTarget({
        iteration: 1,
        type: 'tool_call',
        content: '{"path":"C:\\\\IHUI-AI\\\\README.md"}',
        tool: 'read_file',
      }),
    ).toBe('README.md')
    expect(
      stepTarget({
        iteration: 1,
        type: 'tool_call',
        content: '{"command":"pnpm test"}',
        tool: 'run_command',
      }),
    ).toBe('pnpm test')
    expect(
      stepTarget({
        iteration: 1,
        type: 'tool_call',
        content: '{"pattern":"TODO"}',
        tool: 'grep',
      }),
    ).toBe('TODO')
  })

  it('完成态即使没有 result 也不会误判为进行中', () => {
    expect(taskOutcome(task({ status: 'completed', result: '' }))).toEqual({
      kind: 'result',
      text: '',
    })
    expect(taskOutcome(task({ status: 'completed', result: '已写入 out.txt' }))).toEqual({
      kind: 'result',
      text: '已写入 out.txt',
    })
  })

  it('运行中按最后一步显示准备/思考/执行工具', () => {
    expect(taskOutcome(task({ steps: [] }))).toEqual({ kind: 'running', phase: 'preparing' })
    expect(
      taskOutcome(
        task({
          steps: [{ iteration: 1, type: 'llm', content: '思考' }],
        }),
      ),
    ).toEqual({ kind: 'running', phase: 'thinking' })
    expect(
      taskOutcome(
        task({
          steps: [
            { iteration: 1, type: 'tool_call', content: '{"path":"a.txt"}', tool: 'write_file' },
          ],
        }),
      ),
    ).toEqual({ kind: 'running', phase: 'tool', target: 'a.txt' })
  })

  it('失败与停止态给出明确结局', () => {
    expect(taskOutcome(task({ status: 'failed', error: '命令退出码 1' }))).toEqual({
      kind: 'error',
      text: '命令退出码 1',
    })
    expect(taskOutcome(task({ status: 'canceled' }))).toEqual({ kind: 'canceled' })
  })

  it('步骤数只统计工具调用与结果，审批与时间展示可读', () => {
    expect(
      taskStepCount(
        task({
          steps: [
            { iteration: 1, type: 'llm', content: '' },
            { iteration: 1, type: 'tool_call', content: '', tool: 'read_file' },
            { iteration: 1, type: 'tool_result', content: 'ok' },
          ],
        }),
      ),
    ).toBe(2)
    expect(
      pendingApprovalStep(
        task({
          steps: [
            {
              iteration: 1,
              type: 'tool_call',
              content: '',
              tool: 'write_file',
              approval: { state: 'pending', requestId: 'r1' },
            },
          ],
        }),
      )?.approval?.requestId,
    ).toBe('r1')
    expect(formatTaskTime('2026-11-27T06:05:00.000Z')).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/)
    expect(workspaceLabel('C:\\IHUI-AI')).toBe('IHUI-AI')
    expect(isDefaultWorkspacePath('C:\\IHUI-AI\\.ihui\\agent-workspaces\\u-1')).toBe(true)
    expect(isDefaultWorkspacePath('C:\\IHUI-AI')).toBe(false)
  })

  it('长命令与多行内容压成单行，避免撑破卡片', () => {
    expect(truncateText('a\nb\nc', 10)).toBe('a b c')
    expect(truncateText('1234567890', 5)).toBe('1234…')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
