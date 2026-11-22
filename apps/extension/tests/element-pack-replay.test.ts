// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D64⑤ 消费票(2026-10-14):extension 历史回放侧元素包帧归并自证。
 *
 * 三层(与 tool-delta-frames.test.ts 那把尺子同形):
 *  ① 纯逻辑:foldElementPackFrames 的 spawn/progress/end 折算语义 +
 *     无主帧不凭空造条目 + 重复 spawn 不重建;
 *  ② 端到端:D64⑤ 落库 wire 形态(metadata.elementPack.frames)经共享
 *     parseElementPackFrames 守卫解析后直接喂归并层,产物与 web 流式侧
 *     SubAgentActivity 同形(渲染走 MessageContent 既有 subagent 块);
 *  ③ 源码级接线:hydrateBranchTranscript 透传 metadata → ChatPage 组合
 *     hydrateElementPackActivities,任一环节被摘掉即红("造好没装车")。
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseElementPackFrames } from '@ihui/shared/chat/element-pack-history'
import type { SubAgentActivity } from '@ihui/types/ai'

import { foldElementPackFrames, hydrateElementPackActivities } from '../lib/element-pack-replay'
import { hydrateBranchTranscript } from '../entrypoints/sidepanel/pages/chat-branch-utils'

const END_ROOT = join(__dirname, '..')
const REPO_ROOT = resolve(__dirname, '../../..')
if (!existsSync(join(REPO_ROOT, 'pnpm-workspace.yaml'))) {
  throw new Error(`REPO_ROOT 解析异常:${REPO_ROOT} 下没有 pnpm-workspace.yaml ⇒ 相对层数写错`)
}

/** D64⑤ wire 形态的一帧族(与 33286330a8 落库侧同字段) */
const WIRE_FRAMES = [
  { kind: 'subagent_spawn', id: 'sub-1', role: 'validator', task: '校验回归', timestamp: '2026-10-14T10:00:00.000Z' },
  { kind: 'subagent_progress', id: 'sub-1', phase: 'tool_call', tool: 'read_file', iteration: 1, timestamp: '2026-10-14T10:00:01.000Z' },
  { kind: 'subagent_progress', id: 'sub-1', phase: 'tool_result', tool: 'read_file', ok: true, iteration: 1, timestamp: '2026-10-14T10:00:02.000Z' },
  { kind: 'subagent_progress', id: 'sub-1', phase: 'output_ready', outputPreview: '结论:全绿', timestamp: '2026-10-14T10:00:03.000Z' },
  { kind: 'subagent_end', id: 'sub-1', status: 'done', timestamp: '2026-10-14T10:00:04.000Z' },
] as const

const runningAgent: SubAgentActivity = {
  agentId: 'sub-1',
  name: 'validator',
  type: 'worker',
  status: 'running',
  currentStep: '校验回归',
  completedSteps: [],
}

describe('foldElementPackFrames(D64⑤ 纯逻辑)', () => {
  it('spawn 新建 running 活动:role→name / task→currentStep,与 web addSubagentSpawn 同形', () => {
    const [spawn] = WIRE_FRAMES
    const out = foldElementPackFrames([], [spawn])
    expect(out).toEqual([
      {
        agentId: 'sub-1',
        name: 'validator',
        type: 'worker',
        status: 'running',
        currentStep: '校验回归',
        completedSteps: [],
      },
    ])
  })

  it('spawn 缺 role/task 时取缺省名与「执行中…」', () => {
    const out = foldElementPackFrames([], [
      { kind: 'subagent_spawn', id: 'abcdef123456', role: '', task: '', timestamp: 't' },
    ])
    expect(out[0]?.name).toBe('Subagent 123456')
    expect(out[0]?.currentStep).toBe('执行中…')
  })

  it('spawn 同 id 已存在原样保留,不重建不追加', () => {
    const [spawn] = WIRE_FRAMES
    const out = foldElementPackFrames([runningAgent], [spawn])
    expect(out).toEqual([runningAgent])
  })

  it('progress 全相:tool_call 文案 → tool_result 计数入账 → output_preview 留档', () => {
    const progress = WIRE_FRAMES.slice(1, 4)
    const out = foldElementPackFrames([runningAgent], [...progress])
    expect(out[0]?.currentStep).toBe('输出就绪')
    expect(out[0]?.progressPhase).toBe('output_ready')
    expect(out[0]?.toolCallsCount).toBe(1)
    expect(out[0]?.completedSteps).toEqual([
      { stepAction: 'read_file ✓', createdAt: '2026-10-14T10:00:02.000Z', status: 'completed' },
    ])
    expect(out[0]?.outputPreview).toBe('结论:全绿')
  })

  it('end(done):currentStep 推入 completedSteps 后清空,streamingDone 置真', () => {
    const [, , , , end] = WIRE_FRAMES
    const mid = foldElementPackFrames([runningAgent], [WIRE_FRAMES[1]!])
    const out = foldElementPackFrames(mid, [end])
    expect(out[0]?.status).toBe('completed')
    expect(out[0]?.currentStep).toBe('')
    expect(out[0]?.streamingDone).toBe(true)
    expect(out[0]?.completedSteps).toEqual([
      { stepAction: '调用工具: read_file (轮次 1)', createdAt: '2026-10-14T10:00:04.000Z', status: 'completed' },
    ])
  })

  it('end(failed):status 失败 + currentStep 换错误摘要(截 200),不动 completedSteps', () => {
    const out = foldElementPackFrames([runningAgent], [
      { kind: 'subagent_end', id: 'sub-1', status: 'failed', failureReason: 'x'.repeat(300), timestamp: 't' },
    ])
    expect(out[0]?.status).toBe('failed')
    expect(out[0]?.currentStep).toBe(`失败:${'x'.repeat(200)}`)
    expect(out[0]?.streamingDone).toBe(true)
  })

  it('无主帧(progress/end 无 spawn)整帧丢弃,不凭空造条目', () => {
    expect(foldElementPackFrames([], [WIRE_FRAMES[1]!])).toEqual([])
    expect(foldElementPackFrames([], [WIRE_FRAMES[4]!])).toEqual([])
  })

  it('多子代理互不串扰,无主的第二代理进度帧照丢', () => {
    const twoAgents = foldElementPackFrames([], [WIRE_FRAMES[0]!, { ...WIRE_FRAMES[0]!, id: 'sub-2', role: 'reviewer' }])
    const out = foldElementPackFrames(twoAgents, [WIRE_FRAMES[1]!])
    expect(out.map((a) => a.agentId)).toEqual(['sub-1', 'sub-2'])
    expect(out[1]?.currentStep).toBe('校验回归')
  })
})

describe('D64⑤ 端到端:落库 wire 形态经共享守卫解析后直接喂归并层', () => {
  it('metadata.elementPack.frames → parseElementPackFrames → fold,产物与流式侧 SubAgentActivity 同形', () => {
    const metadata = { elementPack: { frames: WIRE_FRAMES.map((f) => ({ ...f })) } }
    const frames = parseElementPackFrames(metadata)
    expect(frames).toHaveLength(5)
    const out = foldElementPackFrames([], frames)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      agentId: 'sub-1',
      name: 'validator',
      status: 'completed',
      toolCallsCount: 1,
      outputPreview: '结论:全绿',
    })
  })

  it('坏 metadata(垃圾值/frames 非数组)按「无元素包」处理,守卫返回空数组', () => {
    expect(parseElementPackFrames('nonsense')).toEqual([])
    expect(parseElementPackFrames({ elementPack: { frames: 'bad' } })).toEqual([])
    expect(parseElementPackFrames(null)).toEqual([])
  })
})

describe('hydrateElementPackActivities(列表水合面)', () => {
  it('assistant 消息带元素包 ⇒ 挂上等价 subagentActivities;user 消息跳过', () => {
    const messages: Array<{
      id: string
      role: string
      content: string
      metadata?: unknown
      subagentActivities?: SubAgentActivity[]
    }> = [
      { id: 'u1', role: 'user', content: '问题', metadata: { elementPack: { frames: [...WIRE_FRAMES] } } },
      { id: 'a1', role: 'assistant', content: '答复', metadata: { elementPack: { frames: [...WIRE_FRAMES] } } },
    ]
    const out = hydrateElementPackActivities(messages)
    expect(out[0]).toBe(messages[0])
    expect(out[1]?.subagentActivities).toHaveLength(1)
    expect(out[1]?.subagentActivities?.[0]?.status).toBe('completed')
  })

  it('无元素包 / 全无主帧 / 纯坏值的 assistant 消息原样返回(最小降级,不造空卡)', () => {
    const plain = { id: 'a1', role: 'assistant', content: '答复' }
    const orphan = { id: 'a2', role: 'assistant', content: '答复', metadata: { elementPack: { frames: [{ ...WIRE_FRAMES[1] }] } } }
    const garbage = { id: 'a3', role: 'assistant', content: '答复', metadata: { broken: true } }
    const out = hydrateElementPackActivities([plain, orphan, garbage])
    expect(out[0]).toBe(plain)
    expect(out[1]).toBe(orphan)
    expect(out[2]).toBe(garbage)
  })

  it('既有 subagentActivities(如分支回放已带)在其上续折,不覆盖', () => {
    const seeded = hydrateElementPackActivities([
      { id: 'a1', role: 'assistant', content: '答复', metadata: { elementPack: { frames: [{ ...WIRE_FRAMES[4] }] } }, subagentActivities: [{ ...runningAgent, currentStep: '收尾中…' }] },
    ])
    expect(seeded[0]?.subagentActivities?.[0]?.completedSteps).toEqual([
      { stepAction: '收尾中…', createdAt: '2026-10-14T10:00:04.000Z', status: 'completed' },
    ])
  })
})

describe('D64⑤ 接线自证(源码级):透传 / 组合缺一即红', () => {
  const page = readFileSync(join(END_ROOT, 'entrypoints/sidepanel/pages/ChatPage.tsx'), 'utf8')
  const branchUtils = readFileSync(
    join(END_ROOT, 'entrypoints/sidepanel/pages/chat-branch-utils.ts'),
    'utf8',
  )

  it('hydrateBranchTranscript 透传服务端 metadata(元素包历史帧的唯一载体)', () => {
    expect(branchUtils).toMatch(/metadata\?:\s*unknown/)
    expect(branchUtils).toMatch(/metadata:\s*item\.metadata/)
  })

  it('hydrateBranchTranscript 对带 metadata 的服务端消息原样透传(元素包唯一载体),无 metadata 不添键', () => {
    const out = hydrateBranchTranscript([
      { id: 'a1', role: 'assistant', content: '答复', metadata: { elementPack: { frames: [{ ...WIRE_FRAMES[0] }] } } },
      { id: 'u1', role: 'user', content: '问题' },
    ])
    expect(out.messages[0]?.metadata).toEqual({ elementPack: { frames: [{ ...WIRE_FRAMES[0] }] } })
    expect(out.messages[1]).not.toHaveProperty('metadata')
  })

  it('ChatPage 分支回读后过 hydrateElementPackActivities(不接=历史子代理卡断链)', () => {
    expect(page).toMatch(/hydrateBranchTranscript\(loaded\.data\.messages\)/)
    expect(page).toMatch(/hydrateElementPackActivities\(transcript\.messages\)/)
  })
})
