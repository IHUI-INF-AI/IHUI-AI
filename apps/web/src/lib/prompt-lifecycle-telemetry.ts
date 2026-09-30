// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Prompt 生命周期遥测状态机(2026-09-30 立,吸收批次 74 票 G-977968)。
 *
 * 状态机骨架吸收自上游 message 生命周期遥测(上游 packages/ui/src/lib/messageTelemetry.ts
 * 的 queue→activate / agent step / usage 归因段),字段与事件名按本仓遥测协议中性自命名,
 * 未复制上游协议字段。
 *
 * 定位:纯逻辑"事件进/事实出"的自包含状态机,不接触真实上报——调用方把返回的事实数组
 * 交给任意出口(本地日志/观测干道均可)。覆盖机制:
 * (a) send 入队/激活:激活按 messageId 精确出队,防先发后激活乱序串台;
 * (b) reasoning/generation/tool 三类 step 状态机,loop_index 单调递增;思考 chunk 先关
 *     generation、正文 chunk 先关 reasoning、工具先关两者(三类 step 互斥序列);
 * (c) inputId ownership guard:迟到的旧输入流 chunk/tool 不污染当前 message;
 * (d) 权限等待归因:结算时回填 tool step waitingMs;乱序链路(先收到权限请求、后直接
 *     工具终态、无 tool_start)走 settled 缓存 + startedAt 前移校正,保证工具墙钟耗时
 *     始终覆盖等待段;
 * (e) usage 按 requestId 归因:先挂 pending,step 出现即消费;模型直接 tool_use 无正文
 *     step 时补一个零时长 generation 承接本 request 的 usage(防不同模型 token 混进
 *     同一模型维度);子代理 usage 用"覆盖不叠加"(child 事实是生命周期累计值);
 * (f) 事件 key Set 去重:同一 eventKey 的 usage 上报只计一次。
 */

/** token 用量快照(本仓遥测口径的三元组)。 */
export interface UsageSnapshot {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

/** 三类 agent step(思考/正文/工具),互斥序列由 chunk 流转驱动。 */
export type LifecycleStepType = 'reasoning' | 'generation' | 'tool'

export type LifecycleStepStatus = 'success' | 'fail' | 'timeout'

/** step 关闭原因,供观测端核对互斥关闭顺序。 */
export type LifecycleCloseCause =
  | 'reasoning_chunk' // 被思考 chunk 关闭(先关 generation)
  | 'content_chunk' // 被正文 chunk 关闭(先关 reasoning)
  | 'tool_start' // 被工具开始关闭(先关两者)
  | 'tool_end' // 工具自身终态
  | 'terminal' // 回合终态收口
  | 'zero_duration' // 零时长承接 step(usage 归因专用)

export interface StepFact {
  kind: 'step'
  taskId: string
  messageId: string
  stepType: LifecycleStepType
  loopIndex: number
  startedAt: number
  endedAt: number
  durationMs: number
  /** 本 step 内权限等待耗时(已含 settled 缓存回填)。 */
  waitingMs: number
  status: LifecycleStepStatus
  closeCause: LifecycleCloseCause
  toolId?: string
  toolName?: string
  model?: string
  usage?: UsageSnapshot
  usageScope?: 'model_request' | 'subagent'
  error?: { type?: string; msg?: string }
}

export interface CompletionFact {
  kind: 'completion'
  taskId: string
  messageId: string
  result: 'success' | 'fail' | 'interrupted'
  endedAt: number
  /** 发送 → 终态 的端到端耗时。 */
  durationMs: number
  /** 首 token 到达耗时;整轮无输出为 null。 */
  firstTokenMs: number | null
  /** 全部权限等待耗时(prompt 级累计)。 */
  waitingMs: number
  toolCallTotal: number
  toolCallFailed: number
  firstToolError?: string
  usage: UsageSnapshot
  /** 运行时回包覆盖后的模型维度(比发送时的 UI 快照更接近真实请求)。 */
  model?: string
}

export type LifecycleFact = StepFact | CompletionFact

/** 生命周期事件(本仓遥测协议的中性自命名,不携带上游字段)。 */
export type LifecycleEvent =
  | { type: 'model_request_started'; taskId: string; requestId: string; model?: string; inputId?: string }
  | { type: 'chunk'; taskId: string; stream: 'reasoning' | 'content'; inputId?: string; belongsToTool?: boolean }
  | { type: 'tool_start'; taskId: string; toolId: string; toolName?: string; inputId?: string }
  | { type: 'tool_progress'; taskId: string; toolId: string; toolName?: string; inputId?: string }
  | { type: 'tool_end'; taskId: string; toolId: string; status: string; toolName?: string; error?: string; inputId?: string }
  | { type: 'permission_requested'; taskId: string; requestId: string; toolId?: string; inputId?: string }
  | { type: 'permission_settled'; taskId: string; requestId: string; inputId?: string }
  | {
      type: 'model_usage'
      taskId: string
      /** 去重键:同一 eventKey 只计一次。 */
      eventKey: string
      usage: UsageSnapshot
      requestId?: string
      model?: string
      modelProvider?: string
      inputId?: string
    }
  | {
      type: 'subagent_usage'
      taskId: string
      toolId: string
      usage: UsageSnapshot
      requestIds?: string[]
      requestCount?: number
      model?: string
      inputId?: string
    }
  | { type: 'terminal'; taskId: string; result: 'success' | 'fail' | 'interrupted'; error?: { type?: string; msg?: string }; inputId?: string }

interface StepModelInfo {
  requestId?: string
  model?: string
  provider?: string
}

/** step 级 usage 归因(含请求集合与口径,供跨 step 合并)。 */
interface StepUsage {
  requestIds: string[]
  requestCount: number
  scope: 'model_request' | 'subagent'
  usage: UsageSnapshot
}

interface ActiveStep {
  stepType: LifecycleStepType
  loopIndex: number
  startedAt: number
  waitingMs: number
  model?: StepModelInfo
  usage?: StepUsage
  toolId?: string
  toolName?: string
}

/** 权限等待:请求 → 请求时刻(+归属工具)。挂在 prompt 级,跨 step 状态存活。 */
interface PermissionWait {
  requestedAt: number
  toolId?: string
}

/** 已结算但工具 step 尚未出现的等待缓存(乱序链路兜底)。 */
interface SettledWait {
  waitingMs: number
  earliestRequestedAt: number
}

/** per-task 的 step 状态域(终态后整体作废重建)。 */
interface TaskStepState {
  nextLoopIndex: number
  currentRequest: StepModelInfo | null
  pendingUsageByRequestId: Map<string, StepUsage>
  reasoningStep: ActiveStep | null
  generationStep: ActiveStep | null
  toolStepsById: Map<string, ActiveStep>
  settledWaitsByToolId: Map<string, SettledWait>
}

/** 已激活 prompt 的遥测状态。 */
interface PromptState {
  taskId: string
  messageId: string
  inputId?: string
  sendTime: number
  firstTokenAt: number | null
  waitingMs: number
  usage: UsageSnapshot
  usageEventKeys: Set<string>
  toolCallTotal: number
  toolCallFailed: number
  firstToolError?: string
  model?: string
  permissionWaitsByRequestId: Map<string, PermissionWait>
  steps: TaskStepState
}

const ZERO_USAGE: UsageSnapshot = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

function createStepState(): TaskStepState {
  return {
    nextLoopIndex: 1,
    currentRequest: null,
    pendingUsageByRequestId: new Map(),
    reasoningStep: null,
    generationStep: null,
    toolStepsById: new Map(),
    settledWaitsByToolId: new Map(),
  }
}

function mergeUsage(a: UsageSnapshot, b: UsageSnapshot): UsageSnapshot {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  }
}

function mergeStepUsage(existing: StepUsage | undefined, incoming: StepUsage): StepUsage {
  if (!existing) return incoming
  return {
    requestIds: [...new Set([...existing.requestIds, ...incoming.requestIds])],
    requestCount: existing.requestCount + incoming.requestCount,
    // 子代理口径优先:一旦混入 subagent 事实,该 step 不再算纯模型请求。
    scope:
      existing.scope === 'subagent' || incoming.scope === 'subagent' ? 'subagent' : 'model_request',
    usage: mergeUsage(existing.usage, incoming.usage),
  }
}

/** 上游同款归一:fail/denied 家族归 fail,timeout 独立,其余 success。 */
function normalizeStepStatus(status: string): LifecycleStepStatus {
  if (status === 'failed' || status === 'fail' || status === 'denied') return 'fail'
  if (status === 'timeout') return 'timeout'
  return 'success'
}

export interface PromptLifecycleTelemetryOptions {
  /** 可注入时钟,测试用;默认 Date.now。 */
  now?: () => number
}

/**
 * Prompt 生命周期遥测状态机。
 * 一次实例化可服务多个 task;每个 task 同时只有一条激活 prompt。
 */
export class PromptLifecycleTelemetry {
  private readonly nowFn: () => number
  private readonly queuedByTask = new Map<string, PromptState[]>()
  private readonly activeByTask = new Map<string, PromptState>()

  constructor(options?: PromptLifecycleTelemetryOptions) {
    this.nowFn = options?.now ?? Date.now
  }

  /**
   * (a) send 入队:同一 task 可有多条排队;后续激活按 messageId 精确出队。
   * inputId 可选绑定,用于 (c) ownership guard 的兼容比对。
   */
  enqueue(input: { taskId: string; messageId: string; inputId?: string; sendTime?: number }): void {
    const sendTime = input.sendTime ?? this.nowFn()
    const state: PromptState = {
      taskId: input.taskId,
      messageId: input.messageId,
      ...(input.inputId ? { inputId: input.inputId } : {}),
      sendTime,
      firstTokenAt: null,
      waitingMs: 0,
      usage: { ...ZERO_USAGE },
      usageEventKeys: new Set(),
      toolCallTotal: 0,
      toolCallFailed: 0,
      permissionWaitsByRequestId: new Map(),
      steps: createStepState(),
    }
    const queue = this.queuedByTask.get(input.taskId) ?? []
    queue.push(state)
    this.queuedByTask.set(input.taskId, queue)
  }

  /**
   * (a) 激活:按 messageId 精确出队(不是弹队首)。
   * 找不到时不动当前激活——旧消息的迟到激活不能顶掉正在跑的 prompt。
   */
  activate(taskId: string, messageId: string): boolean {
    const queue = this.queuedByTask.get(taskId)
    if (!queue || queue.length === 0) return false
    const targetIndex = queue.findIndex((item) => item.messageId === messageId)
    if (targetIndex === -1) return false
    const [target] = queue.splice(targetIndex, 1)
    if (!target) return false
    if (queue.length === 0) {
      this.queuedByTask.delete(taskId)
    } else {
      this.queuedByTask.set(taskId, queue)
    }
    target.steps = createStepState()
    this.activeByTask.set(taskId, target)
    return true
  }

  getActiveMessageId(taskId: string): string | undefined {
    return this.activeByTask.get(taskId)?.messageId
  }

  /**
   * 事件入口。guard.activeInputId 是运行时当前 input 归属(调用方传入);
   * 事件自带 inputId 且两者同时存在但不一致时,整体吞掉——迟到的旧输入流
   * chunk/tool 不得污染当前 message。
   */
  handleEvent(
    event: LifecycleEvent,
    guard?: { activeInputId?: string },
  ): LifecycleFact[] {
    const prompt = this.activeByTask.get(event.taskId)
    if (!prompt) return []
    if (guard?.activeInputId && event.inputId && guard.activeInputId !== event.inputId) {
      return []
    }

    const now = this.nowFn()
    const facts: LifecycleFact[] = []
    switch (event.type) {
      case 'model_request_started': {
        // 运行时回包覆盖模型维度:发送时的 UI 快照不代表真实模型请求。
        prompt.steps.currentRequest = {
          requestId: event.requestId,
          ...(event.model ? { model: event.model } : {}),
        }
        if (event.model) prompt.model = event.model
        return facts
      }

      case 'chunk':
        return this.handleChunkEvent(prompt, event, now, facts)

      case 'tool_start':
        this.markFirstToken(prompt, now)
        this.openToolStep(prompt, event.toolId, event.toolName, now, facts)
        return facts

      case 'tool_progress':
        this.markFirstToken(prompt, now)
        // progress 形态的流:首个 progress 也承担"开 step"职责。
        if (!prompt.steps.toolStepsById.has(event.toolId)) {
          this.openToolStep(prompt, event.toolId, event.toolName, now, facts)
        }
        return facts

      case 'tool_end':
        this.markFirstToken(prompt, now)
        this.finishToolStep(prompt, event, now, facts)
        return facts

      case 'permission_requested':
        prompt.permissionWaitsByRequestId.set(event.requestId, {
          requestedAt: now,
          ...(event.toolId ? { toolId: event.toolId } : {}),
        })
        return facts

      case 'permission_settled':
        this.settlePermissionWait(prompt, prompt.steps, event.requestId, now)
        return facts

      case 'model_usage':
        this.applyModelUsage(prompt, event)
        return facts

      case 'subagent_usage': {
        const toolStep = prompt.steps.toolStepsById.get(event.toolId)
        if (!toolStep) return facts
        if (event.model) {
          toolStep.model = { ...toolStep.model, model: event.model }
        }
        // 覆盖不叠加:child 每次携带的是生命周期累计值,叠加会重复计数。
        toolStep.usage = {
          requestIds: [...(event.requestIds ?? [])],
          requestCount: event.requestCount ?? 1,
          scope: 'subagent',
          usage: event.usage,
        }
        return facts
      }

      case 'terminal':
        return this.finishPrompt(prompt, event, now, facts)
    }
  }

  private handleChunkEvent(
    prompt: PromptState,
    event: Extract<LifecycleEvent, { type: 'chunk' }>,
    now: number,
    facts: LifecycleFact[],
  ): LifecycleFact[] {
    // 带 belongsToTool 的 chunk 是工具/子代理输出,由工具卡片消费,
    // 不能当主正文开 generation step。
    if (event.stream === 'content' && event.belongsToTool) return facts
    this.markFirstToken(prompt, now)
    const steps = prompt.steps

    if (event.stream === 'reasoning') {
      // 思考 chunk:先关 generation 再开 reasoning(互斥序列)。
      if (!steps.reasoningStep) {
        this.closeGeneration(prompt, now, facts, 'success', 'reasoning_chunk')
        steps.reasoningStep = this.createStep(steps, 'reasoning', now)
      }
      return facts
    }

    // 正文 chunk:先关 reasoning 再开/续 generation。
    this.closeReasoning(prompt, now, facts, 'content_chunk')
    if (!steps.generationStep) {
      steps.generationStep = this.createStep(steps, 'generation', now)
    }
    return facts
  }

  private markFirstToken(prompt: PromptState, now: number): void {
    if (prompt.firstTokenAt === null) {
      prompt.firstTokenAt = now
    }
  }

  private createStep(
    steps: TaskStepState,
    stepType: LifecycleStepType,
    startedAt: number,
    options?: { toolId?: string; toolName?: string },
  ): ActiveStep {
    const step: ActiveStep = {
      stepType,
      loopIndex: steps.nextLoopIndex,
      startedAt,
      waitingMs: 0,
      ...(steps.currentRequest ? { model: { ...steps.currentRequest } } : {}),
      ...options,
    }
    // (e) step 出现即消费挂起的 usage:先到先得,只认同 requestId 的事实。
    const requestId = step.model?.requestId
    if (requestId) {
      const pending = steps.pendingUsageByRequestId.get(requestId)
      if (pending) {
        step.usage = pending
        steps.pendingUsageByRequestId.delete(requestId)
      }
    }
    steps.nextLoopIndex += 1
    return step
  }

  /** 打开工具 step:先互斥关闭两类输出 step,再消费挂起 usage,再吃 settled 缓存。 */
  private openToolStep(
    prompt: PromptState,
    toolId: string,
    toolName: string | undefined,
    now: number,
    facts: LifecycleFact[],
  ): void {
    const steps = prompt.steps
    this.closeReasoning(prompt, now, facts, 'tool_start')
    this.closeGeneration(prompt, now, facts, 'success', 'tool_start')
    this.materializePendingUsageBeforeTool(prompt, now, facts)
    const toolStep = this.createStep(steps, 'tool', now, { toolId, ...(toolName ? { toolName } : {}) })
    this.applySettledWait(steps, toolStep)
    steps.toolStepsById.set(toolId, toolStep)
  }

  private finishToolStep(
    prompt: PromptState,
    event: Extract<LifecycleEvent, { type: 'tool_end' }>,
    now: number,
    facts: LifecycleFact[],
  ): void {
    const steps = prompt.steps
    let step = steps.toolStepsById.get(event.toolId)
    if (!step) {
      // 乱序链路:没有前置 tool_start 的终态(如恢复/重放)。先消费挂起 usage,
      // 再用权限等待的最早请求时刻作为 startedAt 兜底。
      this.materializePendingUsageBeforeTool(prompt, now, facts)
      step = this.createStep(
        steps,
        'tool',
        this.earliestPermissionRequestedAt(prompt, steps, event.toolId) ?? now,
        { toolId: event.toolId, ...(event.toolName ? { toolName: event.toolName } : {}) },
      )
    }
    // 先回填已结算等待,再消费仍开放的等待,最后前移 startedAt,
    // 保证工具墙钟耗时始终覆盖 waitingMs(墙钟 = 执行 + 等待)。
    this.applySettledWait(steps, step)
    steps.toolStepsById.set(event.toolId, step)
    this.settlePermissionWaitsForTool(prompt, steps, event.toolId, now)
    step.startedAt = Math.min(step.startedAt, now - step.waitingMs)
    steps.toolStepsById.delete(event.toolId)

    const status = normalizeStepStatus(event.status)
    facts.push(
      this.finalizeStep(prompt, step, now, status, 'tool_end', {
        ...(status === 'fail' ? { type: 'tool_error' } : {}),
        ...(event.error ? { msg: event.error } : {}),
      }),
    )
  }

  private applyModelUsage(
    prompt: PromptState,
    event: Extract<LifecycleEvent, { type: 'model_usage' }>,
  ): void {
    const eventKey = event.eventKey.trim()
    if (!eventKey || prompt.usageEventKeys.has(eventKey)) {
      return
    }
    prompt.usageEventKeys.add(eventKey)
    prompt.usage = mergeUsage(prompt.usage, event.usage)

    const requestId = event.requestId?.trim()
    if (!requestId) return
    const steps = prompt.steps
    // 只归因到模型输出 step(reasoning/generation);工具 step 的 usage
    // 只来自子代理归因,否则主模型与子代理 token 会混进同一模型维度。
    const step = [steps.generationStep, steps.reasoningStep].find(
      (candidate) => candidate?.model?.requestId === requestId,
    )
    if (step) {
      step.model = {
        requestId,
        model: event.model ?? step.model?.model,
        provider: event.modelProvider ?? step.model?.provider,
      }
      step.usage = mergeStepUsage(step.usage, {
        requestIds: [requestId],
        requestCount: 1,
        scope: 'model_request',
        usage: event.usage,
      })
      return
    }
    // 挂起:step 尚未出现,等 createStep 消费(同 request 累计合并)。
    const pending = steps.pendingUsageByRequestId.get(requestId)
    steps.pendingUsageByRequestId.set(
      requestId,
      mergeStepUsage(pending, {
        requestIds: [requestId],
        requestCount: 1,
        scope: 'model_request',
        usage: event.usage,
      }),
    )
  }

  /**
   * (e) 防混桶核心:模型直接返回 tool_use 时没有正文 step,若放任挂起 usage
   * 被随后创建的工具 step 消费,主模型 A 与子代理模型 B 的 token 会混进同一
   * 模型维度。这里补一个零时长 generation 承接本次真实模型 request 的 usage;
   * 工具 step 保持独立,等待工具或子代理事实。
   */
  private materializePendingUsageBeforeTool(
    prompt: PromptState,
    now: number,
    facts: LifecycleFact[],
  ): void {
    const steps = prompt.steps
    const requestId = steps.currentRequest?.requestId
    if (
      !requestId ||
      steps.reasoningStep ||
      steps.generationStep ||
      !steps.pendingUsageByRequestId.has(requestId)
    ) {
      return
    }
    steps.generationStep = this.createStep(steps, 'generation', now)
    this.closeGeneration(prompt, now, facts, 'success', 'zero_duration')
  }

  private settlePermissionWait(
    prompt: PromptState,
    steps: TaskStepState,
    requestId: string,
    now: number,
  ): void {
    const wait = prompt.permissionWaitsByRequestId.get(requestId)
    if (!wait) return
    const waitingMs = Math.max(now - wait.requestedAt, 0)
    prompt.waitingMs += waitingMs
    if (wait.toolId) {
      const toolStep = steps.toolStepsById.get(wait.toolId)
      if (toolStep) {
        toolStep.waitingMs += waitingMs
      } else {
        // (d) 工具 step 还没出现:进 settled 缓存,等 step 出现/终态兜底时回填。
        const settled = steps.settledWaitsByToolId.get(wait.toolId)
        steps.settledWaitsByToolId.set(wait.toolId, {
          waitingMs: (settled?.waitingMs ?? 0) + waitingMs,
          earliestRequestedAt: Math.min(
            settled?.earliestRequestedAt ?? wait.requestedAt,
            wait.requestedAt,
          ),
        })
      }
    }
    prompt.permissionWaitsByRequestId.delete(requestId)
  }

  private applySettledWait(steps: TaskStepState, step: ActiveStep): void {
    if (!step.toolId) return
    const settled = steps.settledWaitsByToolId.get(step.toolId)
    if (!settled) return
    step.waitingMs += settled.waitingMs
    step.startedAt = Math.min(step.startedAt, settled.earliestRequestedAt)
    steps.settledWaitsByToolId.delete(step.toolId)
  }

  private earliestPermissionRequestedAt(
    prompt: PromptState,
    steps: TaskStepState,
    toolId: string,
  ): number | undefined {
    let earliest = steps.settledWaitsByToolId.get(toolId)?.earliestRequestedAt
    for (const wait of prompt.permissionWaitsByRequestId.values()) {
      if (wait.toolId !== toolId) continue
      earliest = Math.min(earliest ?? wait.requestedAt, wait.requestedAt)
    }
    return earliest
  }

  private settlePermissionWaitsForTool(
    prompt: PromptState,
    steps: TaskStepState,
    toolId: string,
    now: number,
  ): void {
    for (const requestId of [...prompt.permissionWaitsByRequestId.keys()]) {
      const wait = prompt.permissionWaitsByRequestId.get(requestId)
      if (wait?.toolId === toolId) {
        this.settlePermissionWait(prompt, steps, requestId, now)
      }
    }
  }

  private settleAllPermissionWaits(prompt: PromptState, steps: TaskStepState, now: number): void {
    for (const requestId of [...prompt.permissionWaitsByRequestId.keys()]) {
      this.settlePermissionWait(prompt, steps, requestId, now)
    }
  }

  private closeReasoning(
    prompt: PromptState,
    now: number,
    facts: LifecycleFact[],
    closeCause: LifecycleCloseCause,
  ): void {
    const step = prompt.steps.reasoningStep
    if (!step) return
    facts.push(this.finalizeStep(prompt, step, now, 'success', closeCause))
    prompt.steps.reasoningStep = null
  }

  private closeGeneration(
    prompt: PromptState,
    now: number,
    facts: LifecycleFact[],
    status: LifecycleStepStatus,
    closeCause: LifecycleCloseCause,
    error?: { type?: string; msg?: string },
  ): void {
    const step = prompt.steps.generationStep
    if (!step) return
    facts.push(this.finalizeStep(prompt, step, now, status, closeCause, error))
    prompt.steps.generationStep = null
  }

  /**
   * step 收口:聚合计数在这里同步累计(逐 step 收口是当前 message 的事实源,
   * 任何"终态再扫历史"的实现都会把旧轮次重复计入)。
   */
  private finalizeStep(
    prompt: PromptState,
    step: ActiveStep,
    finishedAt: number,
    status: LifecycleStepStatus,
    closeCause: LifecycleCloseCause,
    error?: { type?: string; msg?: string },
  ): StepFact {
    const isTool = step.stepType === 'tool'
    if (isTool) {
      prompt.toolCallTotal += 1
      const failed = status !== 'success' || Boolean(error?.msg)
      if (failed) {
        prompt.toolCallFailed += 1
        if (!prompt.firstToolError && error?.msg) {
          prompt.firstToolError = error.msg
        }
      }
    }
    return {
      kind: 'step',
      taskId: prompt.taskId,
      messageId: prompt.messageId,
      stepType: step.stepType,
      loopIndex: step.loopIndex,
      startedAt: step.startedAt,
      endedAt: finishedAt,
      durationMs: Math.max(0, finishedAt - step.startedAt),
      waitingMs: step.waitingMs,
      status,
      closeCause,
      ...(step.toolId ? { toolId: step.toolId } : {}),
      ...(step.toolName ? { toolName: step.toolName } : {}),
      ...(step.model?.model ? { model: step.model.model } : {}),
      ...(step.usage ? { usage: step.usage.usage, usageScope: step.usage.scope } : {}),
      ...(error && (error.type || error.msg) ? { error } : {}),
    }
  }

  /** 回合终态:结算全部等待 → 互斥收口三类 step → 出 completion 事实并作废状态。 */
  private finishPrompt(
    prompt: PromptState,
    event: Extract<LifecycleEvent, { type: 'terminal' }>,
    now: number,
    facts: LifecycleFact[],
  ): LifecycleFact[] {
    const steps = prompt.steps
    const stepStatus: LifecycleStepStatus = event.result === 'fail' ? 'fail' : 'success'
    this.settleAllPermissionWaits(prompt, steps, now)
    this.closeReasoning(prompt, now, facts, 'terminal')
    this.closeGeneration(prompt, now, facts, stepStatus, 'terminal', event.error)
    for (const [toolId, toolStep] of [...steps.toolStepsById]) {
      this.settlePermissionWaitsForTool(prompt, steps, toolId, now)
      facts.push(
        this.finalizeStep(prompt, toolStep, now, stepStatus, 'terminal', event.error),
      )
    }
    steps.toolStepsById.clear()
    this.activeByTask.delete(prompt.taskId)

    facts.push({
      kind: 'completion',
      taskId: prompt.taskId,
      messageId: prompt.messageId,
      result: event.result,
      endedAt: now,
      durationMs: Math.max(0, now - prompt.sendTime),
      firstTokenMs:
        prompt.firstTokenAt === null ? null : Math.max(0, prompt.firstTokenAt - prompt.sendTime),
      waitingMs: prompt.waitingMs,
      toolCallTotal: prompt.toolCallTotal,
      toolCallFailed: prompt.toolCallFailed,
      ...(prompt.firstToolError ? { firstToolError: prompt.firstToolError } : {}),
      usage: prompt.usage,
      ...(prompt.model ? { model: prompt.model } : {}),
    })
    return facts
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
