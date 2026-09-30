// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sanitizeModelDimension } from './telemetry-provider-scope'

/**
 * UI 性能遥测(2026-09-30 立,吸收批次 74 票 G-977991)。
 *
 * 机制吸收自上游 UI perf 出口(上游 packages/ui/src/lib/uiPerfArmsTelemetry.ts
 * 的 98-144 启动哨兵 / 305-344 流式停顿 / 350-399 输入卡顿段),事件名/字段名
 * 按本仓遥测协议中性自命名,未复制上游协议。
 *
 * 机制要点:
 * - 启动分段全有或全无哨兵:六段启动分段 + 总时长,总时长 > 300s 视为时钟异常/
 *   进程挂起整批丢弃;任一段为负(跨进程时钟偏移/回拨)整批丢弃——两者保
 *   sum(6 段) == total 的看板恒等式;
 * - 流式停顿:per-task 记正文 chunk 到达时刻,间隔超 3s 上报真实间隔;
 *   工具调用期间不计入(工具事件清掉追踪,工具后第一个正文 chunk 视为首个);
 * - 输入卡顿:单次输入处理耗时 > 500ms 且 ≤ 5s(挂起/休眠哨兵)才报;
 *   程序化改写(粘贴/setText/mention/历史回填)与 IME 组合态不算打字卡顿;
 * - model 属性在唯一 emit 出口统一卫生化,防各上报函数各自处理后漏洗;
 * - emit 永不抛进 UI 主流程(观测链路严格旁路)。
 */

/** 启动总时长超过视为时钟异常/挂起,整批丢弃,避免污染分布。 */
export const STARTUP_MAX_SANE_MS = 300_000

/** 超过该间隔未收到新正文 chunk 视为停顿并上报;value 仍为真实间隔。 */
export const STREAM_STALL_THRESHOLD_MS = 3_000

/** 输入卡顿保守起点:只抓最严重卡点,事件量最小。 */
export const INPUT_LAG_THRESHOLD_MS = 500

/** 超此值大概率是断点调试/标签页挂起/设备休眠唤醒,丢弃避免污染分布。 */
export const INPUT_LAG_MAX_SANE_MS = 5_000

export const UI_PERF_EVENT_GROUP = 'ui_perf'

/** 启动六段(顺序即时间轴;段时长由相邻端点相减得出)。 */
export const STARTUP_STAGES = [
  'shell_init',
  'backend_ready',
  'window_shown',
  'view_loaded',
  'first_commit',
  'gate_cleared',
] as const

export type StartupStageName = (typeof STARTUP_STAGES)[number]

export interface PerfEvent {
  group: string
  name: string
  value: number
  properties: Record<string, string | number | boolean | undefined>
}

export type PerfReporter = (event: PerfEvent) => void | Promise<unknown>

export interface UiPerfTelemetryOptions {
  /** 观测上报器;缺失时整组静默。 */
  reporter?: PerfReporter | null
  /** 可注入时钟,测试用;默认 Date.now。 */
  now?: () => number
  /** 上报失败的观察钩子(默认静默)。 */
  onWarn?: (message: string, detail?: unknown) => void
}

export interface StartupStageEnds {
  shell_init: number
  backend_ready: number
  window_shown: number
  view_loaded: number
  first_commit: number
  gate_cleared: number
}

/**
 * 输入卡顿判定抽成纯函数便于单测:程序化改写(粘贴/setText/mention/回填)与
 * IME 组合态都不算打字卡顿,即使耗时超阈也跳过;
 * > 500ms 且 ≤ 5s 才报(挂起/休眠哨兵)。
 */
export function shouldReportInputLag(args: {
  lagMs: number
  isProgrammatic: boolean
  isComposing: boolean
}): boolean {
  if (args.isProgrammatic || args.isComposing) {
    return false
  }
  return args.lagMs > INPUT_LAG_THRESHOLD_MS && args.lagMs <= INPUT_LAG_MAX_SANE_MS
}

export class UiPerfTelemetry {
  private readonly reporter: PerfReporter | null
  private readonly nowFn: () => number
  private readonly onWarn?: (message: string, detail?: unknown) => void
  /** 流式停顿:per-task 记录上一个正文 chunk 到达时刻。 */
  private readonly lastContentChunkAtByTask = new Map<string, number>()

  constructor(options?: UiPerfTelemetryOptions) {
    this.reporter = options?.reporter ?? null
    this.nowFn = options?.now ?? Date.now
    this.onWarn = options?.onWarn
  }

  /**
   * model 属性在唯一 emit 出口统一卫生化:避免每个上报函数各自处理后,
   * 新增事件漏洗导致自定义命名的模型名泄漏进观测维度。
   */
  private emit(event: PerfEvent): void {
    if (!this.reporter) return
    const properties = { ...event.properties }
    if (typeof properties.model === 'string') {
      properties.model = sanitizeModelDimension(properties.model)
    }
    const sanitized: PerfEvent = { ...event, properties }
    try {
      Promise.resolve(this.reporter(sanitized)).catch((error) => {
        this.onWarn?.('[ui-perf] 上报失败', { name: event.name, error })
      })
    } catch (error) {
      // 观测链路属于旁路:emit 永不抛进 UI 主流程(启动/发送/渲染)。
      this.onWarn?.('[ui-perf] 上报异常', { name: event.name, error })
    }
  }

  /**
   * 启动分段:全有或全无。
   * stageEnds 是各段结束时刻的时间轴(依次递增应为单调);total = 最后段端点 -
   * startedAt。哨兵两道:总时长异常(时钟跳变/挂起)整批丢弃;任一段为负
   * (跨进程时钟偏移/回拨)整批丢弃——否则 sum(6 段) != total,破坏看板恒等式。
   */
  reportStartupStages(input: { sessionId: string; startedAt: number; stageEnds: StartupStageEnds }): void {
    const ends = STARTUP_STAGES.map((stage) => input.stageEnds[stage])
    const total = ends[ends.length - 1]! - input.startedAt
    if (!Number.isFinite(total) || total < 0 || total > STARTUP_MAX_SANE_MS) {
      this.onWarn?.('[ui-perf] 启动总时长异常,整批丢弃', { total })
      return
    }
    const stageMs = ends.map((end, index) =>
      index === 0 ? end - input.startedAt : end - ends[index - 1]!,
    )
    const negativeStage = stageMs.findIndex((ms) => ms < 0)
    if (negativeStage !== -1) {
      this.onWarn?.('[ui-perf] 启动某段为负(跨进程时钟偏移/回拨),整批丢弃', {
        stage: STARTUP_STAGES[negativeStage],
        ms: stageMs[negativeStage],
      })
      return
    }
    // 至此各段保证 >= 0 且 sum(6 段) == total;round 仅取整,不改变恒等关系
    // (各段与 total 同源相减,取整前恒等成立;观测端以取整值做看板口径)。
    this.emit({
      group: UI_PERF_EVENT_GROUP,
      name: 'startup_total',
      value: Math.round(total),
      properties: { session_id: input.sessionId },
    })
    STARTUP_STAGES.forEach((stage, index) => {
      this.emit({
        group: UI_PERF_EVENT_GROUP,
        name: `startup_stage_${stage}`,
        value: Math.round(stageMs[index]!),
        properties: { session_id: input.sessionId },
      })
    })
  }

  /**
   * 流式停顿:per-task 记录正文 chunk 到达时刻,间隔超阈值上报真实间隔。
   * 首个 chunk 只记基线不上报。
   */
  recordContentChunk(taskId: string, options?: { talkId?: string; model?: string; chunkType?: 'content' | 'thought'; now?: number }): void {
    const now = options?.now ?? this.nowFn()
    const last = this.lastContentChunkAtByTask.get(taskId)
    this.lastContentChunkAtByTask.set(taskId, now)
    if (last === undefined) {
      return
    }
    const gapMs = now - last
    if (gapMs <= STREAM_STALL_THRESHOLD_MS) {
      return
    }
    this.emit({
      group: UI_PERF_EVENT_GROUP,
      name: 'stream_stall',
      value: Math.round(gapMs),
      properties: {
        stall_ms: Math.round(gapMs),
        model: options?.model,
        chunk_type: options?.chunkType,
        talk_id: options?.talkId ?? taskId,
      },
    })
  }

  /**
   * 工具调用期间不计入停顿:工具事件清掉该 task 的追踪,
   * 工具后第一个正文 chunk 视为首个(只记基线,不与工具前的 chunk 比较)——
   * 避免把工具执行耗时误判成流式停顿。
   */
  clearStallTracking(taskId: string): void {
    this.lastContentChunkAtByTask.delete(taskId)
  }

  /** 输入卡顿:单次输入处理耗时(输入侧),与 stream_stall(输出侧)区分。 */
  recordInputLag(params: { lagMs: number; textLength: number; isProgrammatic: boolean; isComposing: boolean; taskId?: string }): void {
    if (
      !shouldReportInputLag({
        lagMs: params.lagMs,
        isProgrammatic: params.isProgrammatic,
        isComposing: params.isComposing,
      })
    ) {
      return
    }
    const lagMs = Math.round(params.lagMs)
    this.emit({
      group: UI_PERF_EVENT_GROUP,
      name: 'input_lag',
      value: lagMs,
      properties: {
        lag_ms: lagMs,
        text_length: params.textLength,
        // 草稿态无 taskId,留空与其它 ui_perf 事件口径一致。
        task_id: params.taskId,
      },
    })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
