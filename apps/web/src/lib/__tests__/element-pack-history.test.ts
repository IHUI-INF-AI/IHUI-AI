// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:web 端元素包历史回放读侧测试

import { describe, expect, it } from 'vitest'
import {
  elementPackFramesToSubagentActivities,
  parseElementPackFrames,
  readSubagentActivitiesFromMetadata,
} from '../element-pack-history'

/** D64⑤ 落库契约的一轮完整 subagent 生命周期(与 shared 判定层判例同形)。 */
const SPAWN = {
  kind: 'subagent_spawn',
  id: 'sa-1',
  role: 'reviewer',
  task: '复查 diff',
  timestamp: '2026-10-14T10:00:00.000Z',
}
const PROGRESS_TOOL = {
  kind: 'subagent_progress',
  id: 'sa-1',
  phase: 'tool_call' as const,
  timestamp: '2026-10-14T10:00:01.000Z',
  iteration: 2,
  tool: 'read_file',
}
const PROGRESS_RESULT_OK = {
  kind: 'subagent_progress',
  id: 'sa-1',
  phase: 'tool_result' as const,
  timestamp: '2026-10-14T10:00:02.000Z',
  tool: 'read_file',
  ok: true,
}
const PROGRESS_THINKING = {
  kind: 'subagent_progress',
  id: 'sa-1',
  phase: 'thinking' as const,
  timestamp: '2026-10-14T10:00:03.000Z',
}
const PROGRESS_OUTPUT = {
  kind: 'subagent_progress',
  id: 'sa-1',
  phase: 'output_ready' as const,
  timestamp: '2026-10-14T10:00:04.000Z',
  outputPreview: '结论:diff 无问题',
}
const END_DONE = {
  kind: 'subagent_end',
  id: 'sa-1',
  status: 'done' as const,
  timestamp: '2026-10-14T10:00:05.000Z',
}
const END_FAILED = {
  kind: 'subagent_end',
  id: 'sa-1',
  status: 'failed' as const,
  failureReason: 'provider 502',
  timestamp: '2026-10-14T10:00:05.000Z',
}

function pack(frames: unknown[]) {
  return { elementPack: { frames } }
}

describe('parseElementPackFrames', () => {
  it('metadata 无 elementPack / null / 非对象 → 空数组', () => {
    expect(parseElementPackFrames(undefined)).toEqual([])
    expect(parseElementPackFrames(null)).toEqual([])
    expect(parseElementPackFrames({})).toEqual([])
    expect(parseElementPackFrames({ elementPack: { frames: 'x' } })).toEqual([])
  })

  it('frames 非数组成员逐条丢弃,合法帧保留', () => {
    const frames = parseElementPackFrames(pack([SPAWN, null, 'junk', { kind: 'subagent_end' }]))
    expect(frames).toHaveLength(1)
    expect(frames[0]?.kind).toBe('subagent_spawn')
  })

  it('progress.phase 非契约四值 → 整帧丢弃', () => {
    const frames = parseElementPackFrames(
      pack([{ ...PROGRESS_TOOL, phase: 'dancing' }]),
    )
    expect(frames).toHaveLength(0)
  })

  it('end.status 非 failed 归一为 done;帧序保持落库顺序', () => {
    const frames = parseElementPackFrames(pack([{ ...END_DONE, status: 'weird' }]))
    expect(frames[0]?.status).toBe('done')
    const ordered = parseElementPackFrames(pack([SPAWN, PROGRESS_TOOL, END_DONE]))
    expect(ordered.map((f) => f.kind)).toEqual([
      'subagent_spawn',
      'subagent_progress',
      'subagent_end',
    ])
  })

  it('未知 kind 保留为降级帧(不丢信息)', () => {
    const frames = parseElementPackFrames(
      pack([{ kind: 'future_card', id: 'f1', timestamp: '2026-10-14T10:00:00.000Z' }]),
    )
    expect(frames).toHaveLength(1)
    expect(frames[0]?.kind).toBe('future_card')
  })
})

describe('elementPackFramesToSubagentActivities', () => {
  it('完整生命周期 → 与流式 store 终态等价的单条 activity', () => {
    const [a] = elementPackFramesToSubagentActivities(
      parseElementPackFrames(pack([SPAWN, PROGRESS_TOOL, PROGRESS_RESULT_OK, PROGRESS_OUTPUT, END_DONE])),
    )
    expect(a).toMatchObject({
      agentId: 'sa-1',
      name: 'reviewer',
      type: 'worker',
      status: 'completed',
      progressPhase: 'output_ready',
      progressIteration: 2,
      progressTool: 'read_file',
      outputPreview: '结论:diff 无问题',
      toolCallsCount: 1,
      currentStep: '',
      streamingDone: true,
    })
    // tool_result 推一条 completed step;end(done) 再把 output_ready 的 stepText 收口一条
    expect(a?.completedSteps).toHaveLength(2)
    expect(a?.completedSteps[0]).toMatchObject({
      stepAction: 'read_file ✓',
      status: 'completed',
    })
  })

  it('failed 终态 → status=failed 且 currentStep 为失败摘要(与 markSubagentEnd 同文案)', () => {
    const [a] = elementPackFramesToSubagentActivities(
      parseElementPackFrames(pack([SPAWN, END_FAILED])),
    )
    expect(a?.status).toBe('failed')
    expect(a?.currentStep).toBe('失败:provider 502')
    expect(a?.streamingDone).toBe(true)
  })

  it('progress thinking 阶段文案与 store updateSubagentProgress 同形', () => {
    const [a] = elementPackFramesToSubagentActivities(
      parseElementPackFrames(pack([SPAWN, PROGRESS_THINKING])),
    )
    expect(a?.currentStep).toBe('思考中…')
    expect(a?.progressPhase).toBe('thinking')
  })

  it('spawn 的 name/role 兜底与 task→currentStep 对齐 addSubagentSpawn', () => {
    const [noRole] = elementPackFramesToSubagentActivities(
      parseElementPackFrames(pack([{ ...SPAWN, role: '' }])),
    )
    expect(noRole?.name).toBe('Subagent sa-1')
    expect(noRole?.currentStep).toBe('复查 diff')
    expect(noRole?.status).toBe('running')
  })

  it('缺 spawn 的 progress/end 帧静默忽略(不造孤儿卡)', () => {
    const acts = elementPackFramesToSubagentActivities(
      parseElementPackFrames(pack([PROGRESS_TOOL, END_DONE])),
    )
    expect(acts).toHaveLength(0)
  })

  it('未知 kind 帧 → 最小降级卡(completed 占位,不伪装运行中/失败)', () => {
    const acts = elementPackFramesToSubagentActivities(
      parseElementPackFrames(
        pack([{ kind: 'future_card', id: 'f1', timestamp: '2026-10-14T10:00:00.000Z' }]),
      ),
    )
    expect(acts).toHaveLength(1)
    expect(acts[0]).toMatchObject({
      agentId: 'f1',
      name: 'future_card',
      status: 'completed',
    })
    expect(acts[0]?.currentStep).toContain('future_card')
  })

  it('多 subagent 各自折叠互不串线', () => {
    const acts = elementPackFramesToSubagentActivities(
      parseElementPackFrames(
        pack([
          SPAWN,
          { ...SPAWN, id: 'sa-2', role: 'tester', task: '跑用例' },
          PROGRESS_TOOL,
          { ...END_DONE, id: 'sa-2' },
          END_DONE,
        ]),
      ),
    )
    expect(acts).toHaveLength(2)
    expect(acts[0]?.status).toBe('completed')
    expect(acts[1]).toMatchObject({ agentId: 'sa-2', name: 'tester', status: 'completed' })
  })
})

describe('readSubagentActivitiesFromMetadata', () => {
  it('无元素包 → undefined(不挂字段)', () => {
    expect(readSubagentActivitiesFromMetadata(undefined)).toBeUndefined()
    expect(readSubagentActivitiesFromMetadata({})).toBeUndefined()
    expect(readSubagentActivitiesFromMetadata(pack([]))).toBeUndefined()
  })

  it('有元素包 → 折叠后的 SubAgentActivity[]', () => {
    const acts = readSubagentActivitiesFromMetadata(pack([SPAWN, END_DONE]))
    expect(acts).toHaveLength(1)
    expect(acts?.[0]?.status).toBe('completed')
  })
})
