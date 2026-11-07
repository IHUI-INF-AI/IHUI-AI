// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 差距③ 运行中插话准入（Qoder steerQueuedChatTurn 渲染端处置表的本仓投影）。
//
// 只覆盖现有模型里已经有消费方的五因，不新造第二套队列：
//   runtime-unsupported → runtimeNoInterject（能力声明显式 false）
//   waiting-user        → awaitingApproval（高危审批正等用户）
//   control-command     → controlCommand（调用方有事实才喂，缺省不臆造）
//   queue-changed       → queueChanged（看到的队列已不是这一份）
//   inactive            → noRunningTurn（没有可注入的运行中 Turn）
//
// 未声明（null/undefined）≠ 不支持：闪电按钮在能力帧到达前必须仍能走既有入队请求。
// 语音/远端来源不符不在此表（对照报告明确不借）。

export const RUNNING_STEER_REJECT_REASONS = [
  'runtimeNoInterject',
  'awaitingApproval',
  'controlCommand',
  'queueChanged',
  'noRunningTurn',
] as const

export type RunningSteerRejectReason = (typeof RUNNING_STEER_REJECT_REASONS)[number]

/** 能力声明三态。只有严格 boolean 才算声明；其余一律未声明。 */
export type SteerCapability = 'supported' | 'unsupported' | 'undeclared'

export function steerCapabilityOf(declared: boolean | null | undefined): SteerCapability {
  if (declared === true) return 'supported'
  if (declared === false) return 'unsupported'
  return 'undeclared'
}

export interface RunningSteerFacts {
  readonly capability: SteerCapability
  /** 高危工具审批正等用户决策（waiting-user） */
  readonly awaitingApproval: boolean
  /** 本次正文是控制命令。无生产者的调用方必须传 false，不得猜。 */
  readonly isControlCommand: boolean
  /** 用户看到的队列快照已经过期。新键入的正文不是快照，调用方传 false。 */
  readonly queueChanged: boolean
  /** 当前有可注入的运行中 Turn（会话 id 与流式助手消息 id 都在） */
  readonly hasRunningTurn: boolean
}

export type RunningSteerAdmission =
  | { readonly disposition: 'steer' }
  | {
      readonly disposition: 'queue'
      readonly reason: 'runtimeNoInterject' | 'controlCommand' | 'noRunningTurn'
    }
  | {
      readonly disposition: 'hold'
      readonly reason: 'awaitingApproval' | 'queueChanged'
    }

/**
 * 运行中插话准入。
 *
 * steer：并入当前轮（调用方发既有 /chat/steer）。
 * queue：不能注入，但正文不能丢 —— 调用方转入既有待发队列，并出示 reason。
 * hold：现在写进去会落错地方（等用户拍板 / 队列已变）—— 正文留在输入框，并出示 reason。
 *
 * 优先级与既有插话门一致：没有落点 > 能力硬缺口 > 审批让行 > 控制命令 > 队列漂移。
 */
export function admitRunningSteer(facts: RunningSteerFacts): RunningSteerAdmission {
  if (!facts.hasRunningTurn) return { disposition: 'queue', reason: 'noRunningTurn' }
  if (facts.capability === 'unsupported') {
    return { disposition: 'queue', reason: 'runtimeNoInterject' }
  }
  if (facts.awaitingApproval) return { disposition: 'hold', reason: 'awaitingApproval' }
  if (facts.isControlCommand) return { disposition: 'queue', reason: 'controlCommand' }
  if (facts.queueChanged) return { disposition: 'hold', reason: 'queueChanged' }
  return { disposition: 'steer' }
}

/** 拒因 → `ai.pane.inputNotices` 下已有文案键。不新造措辞。 */
const REJECT_COPY_KEY = {
  runtimeNoInterject: 'queue.blocked.runtimeNoInterject',
  awaitingApproval: 'queue.denied.cause.awaitingApproval',
  controlCommand: 'queue.denied.cause.controlCommand',
  queueChanged: 'queue.denied.cause.queueChanged',
  noRunningTurn: 'queue.blocked.noRunningTurn',
} as const satisfies Record<RunningSteerRejectReason, string>

export function runningSteerRejectCopyKey(reason: RunningSteerRejectReason): string {
  switch (reason) {
    case 'runtimeNoInterject':
    case 'awaitingApproval':
    case 'controlCommand':
    case 'queueChanged':
    case 'noRunningTurn':
      return REJECT_COPY_KEY[reason]
  }
  return assertNeverReason(reason)
}

function assertNeverReason(reason: never): never {
  throw new Error(`unhandled running steer reject reason: ${String(reason)}`)
}

/**
 * 撤回尚未发送的队列项后回填输入框（withdraw → draft，正文不丢）。
 * 输入框已有草稿时换行接在后面，与待发队列「取消」同一形态。
 */
export function refillDraftAfterWithdraw(current: string, withdrawn: string): string {
  if (withdrawn.length === 0) return current
  if (current.length === 0) return withdrawn
  return `${current}\n${withdrawn}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
