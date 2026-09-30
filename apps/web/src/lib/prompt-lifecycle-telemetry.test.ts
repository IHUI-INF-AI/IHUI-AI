// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach } from 'vitest'
import {
  PromptLifecycleTelemetry,
  type LifecycleFact,
  type LifecycleEvent,
  type StepFact,
  type UsageSnapshot,
} from './prompt-lifecycle-telemetry'

/**
 * Prompt 生命周期遥测状态机验收测试(2026-09-30 立,吸收批次 74 票 G-977968)。
 * 锁定五条验收:旧 input 迟到 chunk 不计入 / 无正文 tool_use 不混桶 /
 * 乱序权限等待回填 / 三 step 互斥关闭顺序 / eventKey 去重。
 */

const TASK = 'task-1'
const MSG = 'msg-1'

let now = 1000
let tracker: PromptLifecycleTelemetry

function tick(ms: number): number {
  now += ms
  return now
}

function begin(messageId = MSG, inputId?: string): void {
  tracker.enqueue({ taskId: TASK, messageId, ...(inputId ? { inputId } : {}), sendTime: now })
  tracker.activate(TASK, messageId)
}

function send(event: LifecycleEvent, activeInputId?: string): LifecycleFact[] {
  return tracker.handleEvent(event, activeInputId ? { activeInputId } : undefined)
}

function stepFacts(facts: LifecycleFact[]): StepFact[] {
  return facts.filter((fact): fact is StepFact => fact.kind === 'step')
}

function usageOf(input: number, output: number, total: number): UsageSnapshot {
  return { inputTokens: input, outputTokens: output, totalTokens: total }
}

beforeEach(() => {
  now = 1000
  tracker = new PromptLifecycleTelemetry({ now: () => now })
})

describe('queue → activate 队列模型', () => {
  it('激活按 messageId 精确出队:先激活第二条,第一条仍留在队列', () => {
    tracker.enqueue({ taskId: TASK, messageId: 'm1', sendTime: now })
    tracker.enqueue({ taskId: TASK, messageId: 'm2', sendTime: now })

    expect(tracker.activate(TASK, 'm2')).toBe(true)
    expect(tracker.getActiveMessageId(TASK)).toBe('m2')

    // 第一条仍是排队事实,随后激活有效
    expect(tracker.activate(TASK, 'm1')).toBe(true)
    expect(tracker.getActiveMessageId(TASK)).toBe('m1')
  })

  it('不存在的 messageId 激活失败,且不顶掉当前激活', () => {
    begin('m1')
    expect(tracker.activate(TASK, 'ghost')).toBe(false)
    expect(tracker.getActiveMessageId(TASK)).toBe('m1')
  })

  it('无激活 prompt 时事件全部吞掉', () => {
    expect(
      send({ type: 'chunk', taskId: TASK, stream: 'content' }),
    ).toEqual([])
  })
})

describe('(c) inputId ownership guard', () => {
  it('旧 input 迟到 chunk 不计入当前 message(终态后无 step 事实)', () => {
    begin()
    // 迟到的旧输入 chunk:被 guard 吞掉,不得开出 generation step
    expect(
      send({ type: 'chunk', taskId: TASK, stream: 'content', inputId: 'old-input' }, 'new-input'),
    ).toEqual([])

    const facts = send({ type: 'terminal', taskId: TASK, result: 'success' })
    // 若旧 chunk 污染,这里会出现 generation step 事实
    expect(stepFacts(facts)).toEqual([])
    expect(facts).toHaveLength(1)
    expect(facts[0]?.kind).toBe('completion')
  })

  it('guard 放行当前 input 的事件,状态机正常工作', () => {
    begin()
    tick(100)
    send({ type: 'chunk', taskId: TASK, stream: 'content', inputId: 'new-input' }, 'new-input')
    const facts = send({ type: 'terminal', taskId: TASK, result: 'success' })

    const steps = stepFacts(facts)
    expect(steps).toHaveLength(1)
    expect(steps[0]?.stepType).toBe('generation')
    expect(steps[0]?.loopIndex).toBe(1)
  })

  it('事件不带 inputId 时不受 guard 影响(兼容无归属事件)', () => {
    begin()
    tick(100)
    send({ type: 'chunk', taskId: TASK, stream: 'content' }, 'new-input')
    const facts = send({ type: 'terminal', taskId: TASK, result: 'success' })
    expect(stepFacts(facts)).toHaveLength(1)
  })
})

describe('(b) 三 step 互斥关闭顺序', () => {
  it('思考 chunk 先关 generation;正文 chunk 先关 reasoning;工具先关两者', () => {
    begin()

    tick(100)
    send({ type: 'chunk', taskId: TASK, stream: 'content' }) // 开 generation (loop 1)

    tick(100)
    let facts = send({ type: 'chunk', taskId: TASK, stream: 'reasoning' })
    expect(stepFacts(facts).map((s) => [s.stepType, s.closeCause])).toEqual([
      ['generation', 'reasoning_chunk'],
    ])

    tick(100)
    facts = send({ type: 'chunk', taskId: TASK, stream: 'content' })
    expect(stepFacts(facts).map((s) => [s.stepType, s.closeCause])).toEqual([
      ['reasoning', 'content_chunk'],
    ])

    tick(100)
    facts = send({ type: 'tool_start', taskId: TASK, toolId: 't1', toolName: 'reader' })
    expect(stepFacts(facts).map((s) => [s.stepType, s.closeCause])).toEqual([
      ['generation', 'tool_start'],
    ])

    tick(100)
    facts = send({ type: 'tool_end', taskId: TASK, toolId: 't1', status: 'completed' })
    expect(stepFacts(facts).map((s) => [s.stepType, s.closeCause, s.toolId])).toEqual([
      ['tool', 'tool_end', 't1'],
    ])
  })

  it('loop_index 单调递增且与 step 出现顺序一致', () => {
    begin()
    send({ type: 'chunk', taskId: TASK, stream: 'content' }) // gen 1
    send({ type: 'chunk', taskId: TASK, stream: 'reasoning' }) // gen 1 关,reasoning 2
    send({ type: 'chunk', taskId: TASK, stream: 'content' }) // reasoning 2 关,gen 3
    send({ type: 'tool_start', taskId: TASK, toolId: 't1' }) // gen 3 关,tool 4
    const facts = send({ type: 'tool_end', taskId: TASK, toolId: 't1', status: 'completed' })

    // 终态前的 step 事实在各自关闭时已逐个返回;最后这条 tool 事实 loop=4
    expect(stepFacts(facts)[0]?.loopIndex).toBe(4)
  })

  it('思考与正文交替时每次都只关对应的一个(互斥不重复)', () => {
    begin()
    send({ type: 'chunk', taskId: TASK, stream: 'reasoning' })
    send({ type: 'chunk', taskId: TASK, stream: 'reasoning' }) // 续,不关
    const facts = send({ type: 'chunk', taskId: TASK, stream: 'content' })
    expect(stepFacts(facts)).toHaveLength(1)
    expect(stepFacts(facts)[0]?.stepType).toBe('reasoning')
  })
})

describe('(e) usage 按 requestId 归因', () => {
  it('模型直接 tool_use(无正文):补零时长 generation 承接本 request usage,工具不混桶', () => {
    begin()
    send({ type: 'model_request_started', taskId: TASK, requestId: 'req-a', model: 'model-a' })
    send({
      type: 'model_usage',
      taskId: TASK,
      eventKey: 'k1',
      requestId: 'req-a',
      usage: usageOf(10, 20, 30),
    })

    // 工具直接开始(没有正文 chunk):先补零时长 generation 承接 usage
    tick(100)
    const openFacts = send({ type: 'tool_start', taskId: TASK, toolId: 't1', toolName: 'agent' })
    const zeroGen = stepFacts(openFacts)
    expect(zeroGen).toHaveLength(1)
    expect(zeroGen[0]?.stepType).toBe('generation')
    expect(zeroGen[0]?.closeCause).toBe('zero_duration')
    expect(zeroGen[0]?.durationMs).toBe(0)
    expect(zeroGen[0]?.usage).toEqual(usageOf(10, 20, 30))
    expect(zeroGen[0]?.usageScope).toBe('model_request')
    expect(zeroGen[0]?.model).toBe('model-a')

    // 工具 step 独立,不再吃本 request 的 usage
    tick(100)
    const endFacts = send({ type: 'tool_end', taskId: TASK, toolId: 't1', status: 'completed' })
    const toolStep = stepFacts(endFacts)[0]
    expect(toolStep?.stepType).toBe('tool')
    expect(toolStep?.usage).toBeUndefined()

    // completion 总账只含本 request 的 usage
    const completion = send({ type: 'terminal', taskId: TASK, result: 'success' }).find(
      (f) => f.kind === 'completion',
    )
    expect(completion && completion.kind === 'completion' ? completion.usage : null).toEqual(
      usageOf(10, 20, 30),
    )
  })

  it('usage 出现晚于正文 step:直接归因到打开中的 generation', () => {
    begin()
    send({ type: 'model_request_started', taskId: TASK, requestId: 'req-b', model: 'model-b' })
    tick(100)
    send({ type: 'chunk', taskId: TASK, stream: 'content' })
    tick(100)
    send({
      type: 'model_usage',
      taskId: TASK,
      eventKey: 'k2',
      requestId: 'req-b',
      usage: usageOf(1, 2, 3),
    })

    const facts = send({ type: 'terminal', taskId: TASK, result: 'success' })
    const gen = stepFacts(facts).find((s) => s.stepType === 'generation')
    expect(gen?.usage).toEqual(usageOf(1, 2, 3))
    expect(gen?.model).toBe('model-b')
  })

  it('(f) 同 eventKey 二次上报被吞', () => {
    begin()
    send({
      type: 'model_usage',
      taskId: TASK,
      eventKey: 'dup-key',
      usage: usageOf(5, 5, 10),
    })
    // 同 key 不同数值:只计第一次
    send({
      type: 'model_usage',
      taskId: TASK,
      eventKey: 'dup-key',
      usage: usageOf(100, 100, 200),
    })

    const completion = send({ type: 'terminal', taskId: TASK, result: 'success' }).find(
      (f) => f.kind === 'completion',
    )
    expect(completion && completion.kind === 'completion' ? completion.usage : null).toEqual(
      usageOf(5, 5, 10),
    )
  })

  it('子代理 usage 覆盖不叠加(child fact 是生命周期累计值)', () => {
    begin()
    send({ type: 'tool_start', taskId: TASK, toolId: 'sub-1', toolName: 'delegate' })
    send({
      type: 'subagent_usage',
      taskId: TASK,
      toolId: 'sub-1',
      usage: usageOf(10, 10, 20),
      requestCount: 1,
    })
    // 第二次同步带的是累计值,覆盖而非相加
    send({
      type: 'subagent_usage',
      taskId: TASK,
      toolId: 'sub-1',
      usage: usageOf(30, 40, 70),
      requestCount: 3,
    })

    const facts = send({ type: 'tool_end', taskId: TASK, toolId: 'sub-1', status: 'completed' })
    const toolStep = stepFacts(facts)[0]
    expect(toolStep?.usage).toEqual(usageOf(30, 40, 70))
    expect(toolStep?.usageScope).toBe('subagent')
  })
})

describe('(d) 权限等待归因', () => {
  it('乱序链路:先 permission_request 后直接工具终态,settled 缓存回填 + startedAt 前移', () => {
    begin()
    // t=1000 权限请求(工具 T9 未开 step)
    send({ type: 'permission_requested', taskId: TASK, requestId: 'p1', toolId: 'T9' })
    // t=5000 权限结算:等待 4000ms,无 step 可回填 → settled 缓存
    tick(4000)
    expect(send({ type: 'permission_settled', taskId: TASK, requestId: 'p1' })).toEqual([])
    // t=6000 工具终态兜底:无 tool_start
    tick(1000)
    const facts = send({ type: 'tool_end', taskId: TASK, toolId: 'T9', status: 'completed' })
    const toolStep = stepFacts(facts)[0]

    expect(toolStep?.waitingMs).toBe(4000)
    expect(toolStep?.startedAt).toBe(1000) // 前移到权限请求时刻
    expect(toolStep?.endedAt).toBe(6000)
    expect(toolStep?.durationMs).toBe(5000) // 墙钟覆盖等待段
    expect(toolStep?.durationMs).toBeGreaterThanOrEqual(toolStep?.waitingMs ?? 0)

    // prompt 级等待总账同步累计
    const completion = send({ type: 'terminal', taskId: TASK, result: 'success' }).find(
      (f) => f.kind === 'completion',
    )
    expect(completion && completion.kind === 'completion' ? completion.waitingMs : 0).toBe(4000)
  })

  it('正常路径:工具 step 已存在,权限结算直接回填 waitingMs', () => {
    begin()
    tick(100)
    send({ type: 'tool_start', taskId: TASK, toolId: 'T1' })
    tick(100)
    send({ type: 'permission_requested', taskId: TASK, requestId: 'p2', toolId: 'T1' })
    tick(1900) // 等待 1900ms
    send({ type: 'permission_settled', taskId: TASK, requestId: 'p2' })
    tick(1000) // 执行 1000ms
    const facts = send({ type: 'tool_end', taskId: TASK, toolId: 'T1', status: 'completed' })
    const toolStep = stepFacts(facts)[0]

    expect(toolStep?.waitingMs).toBe(1900)
    expect(toolStep?.startedAt).toBe(1100)
    expect(toolStep?.durationMs).toBe(3000) // 4000 - 1100,含等待 + 执行
  })

  it('回合终态时未结算的权限等待全部收口', () => {
    begin()
    tick(100)
    send({ type: 'permission_requested', taskId: TASK, requestId: 'p3' })
    tick(500)
    const facts = send({ type: 'terminal', taskId: TASK, result: 'interrupted' })
    const completion = facts.find((f) => f.kind === 'completion')
    expect(completion && completion.kind === 'completion' ? completion.waitingMs : 0).toBe(500)
  })
})

describe('终态与 completion 统计', () => {
  it('completion 汇总 toolCallTotal/Failed/firstTokenMs,终态后事件吞掉', () => {
    begin()
    tick(100)
    send({ type: 'chunk', taskId: TASK, stream: 'content' }) // 首 token @1100,sendTime=1000
    send({ type: 'tool_start', taskId: TASK, toolId: 'a' })
    send({ type: 'tool_end', taskId: TASK, toolId: 'a', status: 'completed' })
    send({ type: 'tool_start', taskId: TASK, toolId: 'b' })
    send({ type: 'tool_end', taskId: TASK, toolId: 'b', status: 'failed', error: 'boom' })

    const facts = send({ type: 'terminal', taskId: TASK, result: 'fail', error: { type: 'E', msg: 'x' } })
    const completion = facts.find((f) => f.kind === 'completion')
    expect(completion).toBeTruthy()
    if (!completion || completion.kind !== 'completion') return

    expect(completion.toolCallTotal).toBe(2)
    expect(completion.toolCallFailed).toBe(1)
    expect(completion.firstToolError).toBe('boom')
    expect(completion.firstTokenMs).toBe(100)
    expect(completion.durationMs).toBe(now - 1000)
    expect(completion.result).toBe('fail')

    // 状态作废:终态后事件不再产生事实
    expect(send({ type: 'chunk', taskId: TASK, stream: 'content' })).toEqual([])
    expect(send({ type: 'terminal', taskId: TASK, result: 'success' })).toEqual([])
  })

  it('belongsToTool 的正文 chunk 不当主正文(generation 不因此开卡)', () => {
    begin()
    send({ type: 'chunk', taskId: TASK, stream: 'content', belongsToTool: true })
    const facts = send({ type: 'terminal', taskId: TASK, result: 'success' })
    expect(stepFacts(facts)).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
