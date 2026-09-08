import { describe, expect, it } from 'vitest'
import type { AgentStreamEvent } from '@ihui/api-client'
import {
  CHANGE_TOOL_NAMES,
  deriveDiffInfoFromArgs,
  isPlanStepStatus,
  isTerminalStatus,
  parsePlanData,
  parseTerminalData,
  parseToolData,
} from '../agent-pane-model'

const event = {
  type: 'tool',
  id: '1',
  name: 'write_file',
  args: { path: 'src/a.ts', content: 'new' },
} as unknown as AgentStreamEvent

describe('agent-pane-model', () => {
  it('parses structured SSE event payload fields', () => {
    expect(parseToolData(event)).toMatchObject({
      id: '1',
      name: 'write_file',
      args: { path: 'src/a.ts' },
    })
    expect(
      parseTerminalData({ ...event, command: 'pnpm test', status: 'running' } as AgentStreamEvent),
    ).toMatchObject({
      command: 'pnpm test',
      status: 'running',
    })
    expect(
      parsePlanData({
        type: 'plan',
        explanation: 'plan',
        plan: [{ step: 'a', status: 'completed' }],
      } as unknown as AgentStreamEvent),
    ).toMatchObject({
      explanation: 'plan',
      plan: [{ step: 'a', status: 'completed' }],
    })
  })

  it('guards plan and terminal status values', () => {
    for (const value of ['pending', 'in_progress', 'completed'])
      expect(isPlanStepStatus(value)).toBe(true)
    for (const value of ['running', 'completed', 'failed'])
      expect(isTerminalStatus(value)).toBe(true)
    expect(isPlanStepStatus('failed')).toBe(false)
    expect(isTerminalStatus('pending')).toBe(false)
  })

  it('derives edit and write diffs from tool args', () => {
    expect(
      deriveDiffInfoFromArgs('edit_file', { path: 'a.ts', oldText: 'old', newText: 'new' }, '?'),
    ).toEqual({
      file_path: 'a.ts',
      old_content: 'old',
      new_content: 'new',
    })
    expect(
      deriveDiffInfoFromArgs('write_file', { file_path: 'b.ts', content: 'new' }, '?'),
    ).toEqual({
      file_path: 'b.ts',
      old_content: '',
      new_content: 'new',
      is_new_file: true,
    })
    expect(deriveDiffInfoFromArgs('edit_file', { path: 'a.ts' }, '?')).toBeNull()
    expect(deriveDiffInfoFromArgs('read_file', { path: 'a.ts' }, '?')).toBeNull()
    expect(deriveDiffInfoFromArgs('write_file', {}, 'unknown.ts')).toBeNull()
  })

  it('tracks change-producing tools', () => {
    expect(CHANGE_TOOL_NAMES.has('write_file')).toBe(true)
    expect(CHANGE_TOOL_NAMES.has('edit_file')).toBe(true)
    expect(CHANGE_TOOL_NAMES.has('read_file')).toBe(false)
  })
})
