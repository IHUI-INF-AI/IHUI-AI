// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'
import {
  buildAssistantExecutionViz,
  readAssistantExecutionVizFromMetadata,
} from '../src/utils/chat-render-model'

describe('RN 执行面还原(历史 metadata / 远端 chat-sync)', () => {
  it('metadata.toolCalls/planSteps/terminalTasks 归一为执行卡', () => {
    const viz = readAssistantExecutionVizFromMetadata({
      toolCalls: [
        { id: 'c1', toolName: 'read_file', status: 'success', args: { path: 'a.ts' } },
      ],
      planSteps: [{ id: 'p1', step: '读取', status: 'completed' }],
      terminalTasks: [{ id: 't1', command: 'ls', status: 'completed', output: 'ok' }],
    })
    expect(viz?.toolCalls?.[0]).toMatchObject({ id: 'c1', name: 'read_file', status: 'success' })
    expect(viz?.planSteps?.[0]).toMatchObject({ id: 'p1', step: '读取', status: 'completed' })
    expect(viz?.terminalTasks?.[0]).toMatchObject({ id: 't1', command: 'ls', output: 'ok' })
  })

  it('脏条目单条丢弃;空数组不造空态', () => {
    expect(
      buildAssistantExecutionViz({
        toolCalls: [{ id: 'bad' }, null, { id: 'c1', toolName: 'grep', status: 'running' }],
      })?.toolCalls,
    ).toHaveLength(1)
    expect(buildAssistantExecutionViz({ planSteps: [] })).toBeUndefined()
  })
})
