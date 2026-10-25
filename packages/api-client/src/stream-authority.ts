// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-816031:权威信封在 SSE 帧流上的生产消费点。
//
// 判据不在这里:解门 / 重订阅 / 片处置三把尺子全部来自 ./recovery-gate.js
// (它本身是 @ihui/shared 唯一出口的同形移植)。本文件只做**接线策略**:
//
//  · 生产端从不下发权威信封 ⇒ 恒 legacy,逐帧放行 —— 旧生产端零行为变化;
//  · 一旦出现权威信封,进入 fail-closed:
//      - 只有 deliveryKind === 'recovery' 能解门;
//      - RPC 响应先到不构成解门凭据(本层结构上不接收时序信息);
//      - 门关着时后续帧不投递,直到 recovery 重新授予权威(非对象帧同受此约束,
//        不得用顶层数组/字符串/数字绕过 fail-closed);
//  · reasonCode 命中重订阅档 ⇒ 报 resubscribe(调用方中止本轮 attempt 触发重连);
//    未知码 ⇒ 只记未判定,既不默认重订阅也不默认不用;
//  · 带 assembler ordinal 的片走 acceptChunk;drop-late 不得重置既有序号。
//
// 两条轴互不顶替:deliveryKind 只回答"解不解门",reasonCode 只回答"要不要重订阅"。
// 缺哪个字段就不问哪个出口 —— 不用通道去定码,也不用码去解门。

import {
  createRecoveryGate,
  formatRecoveryGateLedger,
  type RecoveryGateLedger,
  type RecoveryGateSnapshot,
} from './recovery-gate.js'

interface StreamAuthorityVerdict {
  /** 该帧是否应被丢弃(不投递、不进下游解析与渲染) */
  readonly drop: boolean
  /** 该帧要求重新订阅:调用方应中止本轮 attempt,走既有重连路径 */
  readonly resubscribe: boolean
  /** 本次判定是否读了权威信封(诊断用;legacy 帧恒 false) */
  readonly authority: boolean
  /** 丢弃/重订阅的原因(诊断用;放行时为 null) */
  readonly reason: string | null
}

export interface StreamAuthorityRouter {
  /** 每一条已解析的 SSE data 帧都经这里;返回是否放行 */
  observeFrame(frame: unknown): StreamAuthorityVerdict
  /** 帧水位判出 gap 时调用:关闭闸门(仅权威感知流) */
  observeGap(kind: string): void
  /** 重连建立新 attempt 时调用:新一代订阅 ⇒ 关闭闸门(仅权威感知流) */
  observeReconnect(): void
  snapshot(): RecoveryGateSnapshot
  ledger(): RecoveryGateLedger
  formatLedger(): string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key)
}

const DELIVERY_KEYS = ['deliveryKind', 'delivery_kind'] as const
const REASON_KEYS = ['reasonCode', 'reason_code'] as const

const ALLOW: StreamAuthorityVerdict = {
  drop: false,
  resubscribe: false,
  authority: false,
  reason: null,
}

/**
 * 建一台流级权威路由。一台实例对应一条 streamChat(跨重试共享:重试不是新的
 * 权威授予,只有 recovery 帧能重新开门)。无 I/O、无时钟 ⇒ "RPC 先到"在结构上
 * 没有入参通道。
 */
export function createStreamAuthorityRouter(): StreamAuthorityRouter {
  const gate = createRecoveryGate()
  /** 见过权威信封之后才启用 fail-closed;旧生产端永远到不了这一档 */
  let authorityAware = false

  const observeFrame = (frame: unknown): StreamAuthorityVerdict => {
    if (!isRecord(frame)) {
      // 非对象帧不可能是权威信封(读不出 deliveryKind/reasonCode),因此既不解门也不该
      // 成为 fail-closed 的绕过口:权威感知流的门关着时,顶层数组/字符串/数字/null
      // 一律不投递。从未见过权威字段的 legacy 流仍照旧放行(旧生产端零行为变化)。
      if (authorityAware && !gate.snapshot().open) {
        return { drop: true, resubscribe: false, authority: false, reason: 'authority-closed' }
      }
      return ALLOW
    }

    const hasDelivery = DELIVERY_KEYS.some((key) => hasOwn(frame, key))
    const hasReason = REASON_KEYS.some((key) => hasOwn(frame, key))
    const isAuthority = hasDelivery || hasReason
    if (isAuthority) authorityAware = true

    let resubscribe = false
    let drop = false
    let reason: string | null = null

    // 轴一:解门 —— 只读 deliveryKind
    if (hasDelivery) {
      const release = gate.applyAuthority(frame)
      if (release.verdict !== 'release' && !gate.snapshot().open) {
        drop = true
        reason = release.reason
      }
    }

    // 轴二:重订阅 —— 只读 reasonCode
    if (hasReason) {
      const decision = gate.decideSubscription(frame)
      if (decision.verdict === 'resubscribe') {
        resubscribe = true
        reason = decision.reasonCode ?? decision.detail
      }
    }

    // fail-closed:权威感知流一旦门关着,普通帧不投递。门从不开的旧流不受影响。
    if (!drop && !isAuthority && authorityAware && !gate.snapshot().open) {
      drop = true
      reason = 'authority-closed'
    }

    // 轴三:片处置 —— 只在帧真会被投递时推进装配器水位;
    // 因门关闭而丢弃的帧没有"被接受"过,不得把它的 ordinal 记成既有序号。
    if (!drop && hasOwn(frame, 'ordinal')) {
      const chunk = gate.acceptChunk(frame)
      if (chunk.kind === 'drop-late') {
        drop = true
        reason = chunk.reason
      }
    }

    return { drop, resubscribe, authority: isAuthority, reason }
  }

  const closeIfAuthorityAware = (reason: string): void => {
    if (!authorityAware) return
    gate.resetForNewGeneration(reason)
  }

  return {
    observeFrame,
    observeGap: (kind) => closeIfAuthorityAware(`frame-gap:${kind}`),
    observeReconnect: () => closeIfAuthorityAware('reconnect'),
    snapshot: () => gate.snapshot(),
    ledger: () => gate.ledger(),
    formatLedger: () => formatRecoveryGateLedger(gate.ledger()),
  }
}

/**
 * resubscribe 判定的唯一动作 = 重连。调用方抛这个错误,runResumableSSEStream
 * 的 catch 会把它当可重试的传输失败(没有业务 code),走既有退避重连路径。
 */
export class StreamAuthorityResubscribeError extends Error {
  readonly reason: string

  constructor(reason: string) {
    super(`权威信封要求重订阅:${reason}`)
    this.name = 'StreamAuthorityResubscribeError'
    this.reason = reason
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
