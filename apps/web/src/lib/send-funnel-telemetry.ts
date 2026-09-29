// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​​‌​‌‍‍​‌​​​​​‌‍‍​‌​​​‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​‌‌​⁠

/**
 * 发送漏斗埋点(2026-09-30 立,吸收批次 74 票 G-977983)。
 *
 * 机制吸收自上游发送漏斗 ARMS 出口(上游 packages/ui/src/lib/sendFunnelArmsTelemetry.ts:1-137),
 * 事件名/字段名按本仓遥测协议中性自命名,未复制上游协议。
 *
 * 机制要点:
 * - 三事件漏斗:composer_focus(聚焦)→ send_submit(提交)→ send_settled(落定);
 * - send_settled 的 value = 端到端耗时 ms,观测端可对该事件直接出 avg/p50/p95/p99
 *   并按 status/reason_code 切分;
 * - 端到端 totalCostMs(提交 → 消息呈现)与 ackCostMs(提交 → 收到 ACK)分字段上报,
 *   两者相减即"回流 + 渲染"段耗时;
 * - 9 种落定原因码枚举(见 SEND_SETTLE_REASON_CODES);
 * - 空 sessionId/commandId 不下发对应维度(避免观测端出现空串维度);
 * - 聚焦事件只在用户真实聚焦时上报(isTrustedUserFocus 由调用方注入判定,
 *   程序性自动聚焦不算漏斗入口);
 * - reporter 注入式;观测失败只 warn,发送主链路不得因埋点失败而中断。
 */

/** 发送落定原因码(9 种,成功落定不携带)。 */
export type SendSettleReasonCode =
  | 'attachment_not_ready'
  | 'blocked'
  | 'rejected'
  | 'stale'
  | 'failed'
  | 'render_timeout'
  | 'transport_error'
  | 'provider_not_ready'
  | 'composer_error'

export const SEND_SETTLE_REASON_CODES: readonly SendSettleReasonCode[] = [
  'attachment_not_ready',
  'blocked',
  'rejected',
  'stale',
  'failed',
  'render_timeout',
  'transport_error',
  'provider_not_ready',
  'composer_error',
]

export const SEND_FUNNEL_EVENT_GROUP = 'send_path'

export interface FunnelEvent {
  group: string
  name: 'composer_focus' | 'send_submit' | 'send_settled'
  /** ARMS/观测干道的 value 位:聚焦/提交恒为 1,落定为端到端耗时 ms。 */
  value: number
  properties: Record<string, string | number | boolean | undefined>
}

export type FunnelReporter = (event: FunnelEvent) => void | Promise<unknown>

export interface SendFunnelTelemetryOptions {
  /** 观测上报器;缺失时整组静默(如无观测干道的运行形态)。 */
  reporter?: FunnelReporter | null
  /** 上报失败的观察钩子(默认静默);观测链路失败不得影响主流程。 */
  onWarn?: (message: string, detail?: unknown) => void
}

/** 空 id 不下发该维度,避免观测端出现空串维度。 */
function optionalDimension(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function roundNonNegativeMs(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

/** 会话态/草稿态:区分"已有会话里发"和"新建首发"两类漏斗。 */
function composerScopeOf(sessionId: string | null | undefined): 'session' | 'draft' {
  return sessionId && sessionId.trim() ? 'session' : 'draft'
}

export class SendFunnelTelemetry {
  private readonly reporter: FunnelReporter | null
  private readonly onWarn?: (message: string, detail?: unknown) => void

  constructor(options?: SendFunnelTelemetryOptions) {
    this.reporter = options?.reporter ?? null
    this.onWarn = options?.onWarn
  }

  private emit(event: FunnelEvent): void {
    if (!this.reporter) return
    try {
      Promise.resolve(this.reporter(event)).catch((error) => {
        this.onWarn?.('[send-funnel] 上报失败', { name: event.name, error })
      })
    } catch (error) {
      // 观测链路属于旁路,任何同步异常都不冒泡进发送主链路。
      this.onWarn?.('[send-funnel] 上报异常', { name: event.name, error })
    }
  }

  /**
   * 漏斗入口:用户聚焦输入框。trustedFocus 由调用方注入(仅真实用户聚焦为 true,
   * 程序性自动聚焦不构成漏斗入口,不上报)。
   */
  reportComposerFocus(params: {
    sessionId: string | null
    /** 聚焦时刻距会话/页面起点的 ms,用于定位"打开后多久开始输入"。 */
    focusMs: number
    isTrustedUserFocus: boolean
  }): void {
    if (!params.isTrustedUserFocus) return
    this.emit({
      group: SEND_FUNNEL_EVENT_GROUP,
      name: 'composer_focus',
      value: 1,
      properties: {
        focus_ms: roundNonNegativeMs(params.focusMs),
        composer_scope: composerScopeOf(params.sessionId),
        session_id: optionalDimension(params.sessionId),
      },
    })
  }

  /** 提交:点击发送按钮或快捷键提交并通过发送门禁。 */
  reportSendSubmit(params: {
    sessionId: string | null
    /** 本次提交的关联键,与 send_settled 对账。 */
    submitSeq: string
    submitMs: number
    trigger: 'button' | 'shortcut'
    detail?: Record<string, string>
  }): void {
    this.emit({
      group: SEND_FUNNEL_EVENT_GROUP,
      name: 'send_submit',
      value: 1,
      properties: {
        ...params.detail,
        submit_seq: params.submitSeq,
        submit_ms: roundNonNegativeMs(params.submitMs),
        send_trigger: params.trigger,
        composer_scope: composerScopeOf(params.sessionId),
        session_id: optionalDimension(params.sessionId),
      },
    })
  }

  /**
   * 落定(成功与失败共用)。value = 端到端耗时:
   * totalCostMs 是"提交 → 用户消息呈现在对话里"的端到端段;
   * ackCostMs 单独留"提交 → 收到 ACK"段,两者相减即"回流 + 渲染"耗时。
   */
  reportSendSettled(params: {
    sessionId: string | null
    commandId?: string
    submitSeq: string
    status: 'success' | 'fail'
    reasonCode?: SendSettleReasonCode
    ackStatus?: string
    totalCostMs: number
    ackCostMs?: number
    queueConfirmed: boolean
    detail?: Record<string, string>
  }): void {
    const totalCostMs = roundNonNegativeMs(params.totalCostMs)
    const ackCostMs =
      params.ackCostMs === undefined ? undefined : roundNonNegativeMs(params.ackCostMs)
    this.emit({
      group: SEND_FUNNEL_EVENT_GROUP,
      name: 'send_settled',
      value: totalCostMs,
      properties: {
        ...params.detail,
        submit_seq: params.submitSeq,
        status: params.status,
        ...(params.reasonCode ? { reason_code: params.reasonCode } : {}),
        ...(params.ackStatus ? { ack_status: params.ackStatus } : {}),
        total_cost_ms: totalCostMs,
        ...(ackCostMs !== undefined ? { ack_cost_ms: ackCostMs } : {}),
        queue_confirmed: params.queueConfirmed,
        composer_scope: composerScopeOf(params.sessionId),
        session_id: optionalDimension(params.sessionId),
        command_id: optionalDimension(params.commandId),
      },
    })
  }
}
