// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 回放式 token 计量(W4-11)—— 一份会话日志只算一次,压缩/占用显示/遥测共读。
 *
 * 与 `token-estimate.ts` 的分工:
 *   - `estimateMessagesTokens` 仍是"怎么给一条消息计价"的唯一实现;
 *   - 本模块只做"按事件顺序回放、按节点留价、按锚点报带符号增量",不另造估算器。
 *
 * 三个判据:
 *   1. 同一份事件序列重复回放 ⇒ 逐字段相同,revision 相同;
 *   2. 提供方用量只在请求 envelope 完全一致、且总量不低于本轮启发式总量时复用;
 *   3. 替换后的增量是 `当前总量 − 锚点总量`,缩量为负 —— 不取绝对值、不压成 0。
 */

import { projectSurface, type SessionEvent, type SurfaceNode } from './session-surface.js'
import {
  assertTokenAnchor,
  canonicalJson,
  estimateNodePrice,
  resolveProviderUsage,
  stableDigest,
  type ProviderUsageResolution,
  type ProviderUsageSample,
  type TokenAnchor,
  type TokenMeterOptionsBase,
  type TokenPrice,
  type TokenPricer,
  type TokenRequestEnvelope,
} from './token-usage.js'
import type { ChatMessage } from './types.js'

export interface TokenMeterNode {
  nodeId: string
  seq: number
  tokens: number
  heuristicTokens: number
  removed: boolean
}

export interface TokenMeasurement {
  revision: string
  totalTokens: number
  surfaceTokens: number
  heuristicTokens: number
  /** 相对锚点的带符号增量;无锚点时为 0 */
  anchorDelta: number
  nodes: TokenMeterNode[]
  providerUsage: ProviderUsageResolution
}

export interface TokenMeterOptions extends TokenMeterOptionsBase {
  providerUsage?: ProviderUsageSample
  requestEnvelope?: TokenRequestEnvelope
}

function assertTokenCount(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`token-meter: ${name} 必须是非负整数,收到 ${String(value)}`)
  }
}

export function tokenRevision(nodes: readonly SurfaceNode[]): string {
  const body = nodes.map((node) => ({
    seq: node.seq,
    nodeId: node.nodeId,
    removed: node.removed === true,
    replacedBy: node.replacedBy ?? '',
    message: node.message,
  }))
  return `fnv1a64:${stableDigest(canonicalJson(body))}`
}

function priceNode(pricer: TokenPricer, message: ChatMessage, seq: number): TokenPrice {
  const price = pricer(message, { seq })
  assertTokenCount('tokens', price.tokens)
  assertTokenCount('heuristicTokens', price.heuristicTokens)
  return { tokens: price.tokens, heuristicTokens: price.heuristicTokens }
}

function measurementOf(nodes: readonly SurfaceNode[], options: TokenMeterOptions): TokenMeasurement {
  const pricer = options.pricer ?? estimateNodePrice
  const measured: TokenMeterNode[] = []
  let surfaceTokens = 0
  let heuristicTokens = 0
  for (const node of nodes) {
    const price = priceNode(pricer, node.message, node.seq)
    if (node.removed !== true) {
      surfaceTokens += price.tokens
      heuristicTokens += price.heuristicTokens
    }
    measured.push({
      nodeId: node.nodeId,
      seq: node.seq,
      tokens: price.tokens,
      heuristicTokens: price.heuristicTokens,
      removed: node.removed === true,
    })
  }
  const providerUsage = resolveProviderUsage(
    options.providerUsage,
    options.requestEnvelope,
    surfaceTokens,
    heuristicTokens,
  )
  if (options.anchor !== undefined) assertTokenAnchor(options.anchor)
  const revision = tokenRevision(nodes)
  const anchorDelta = options.anchor === undefined ? 0 : providerUsage.totalTokens - options.anchor.totalTokens
  return {
    revision,
    totalTokens: providerUsage.totalTokens,
    surfaceTokens,
    heuristicTokens,
    anchorDelta,
    nodes: measured,
    providerUsage,
  }
}
/** 纯回放:事件 → 测量。O(surface),确定性;同一序列必得同一 revision。 */
export function measureSessionTokens(
  events: readonly SessionEvent[],
  options: TokenMeterOptions = {},
): TokenMeasurement {
  return measurementOf(projectSurface(events), options)
}

/** 消息数组 → 等价的新增事件序列(seq 从 1 起),供尚无事件日志的调用方使用。 */
export function measureMessageListTokens(
  messages: readonly ChatMessage[],
  options: TokenMeterOptions = {},
): TokenMeasurement {
  const events: SessionEvent[] = messages.map((message, index) => ({
    seq: index + 1,
    type: 'message.added',
    message,
  }))
  return measureSessionTokens(events, options)
}
export function tokenAnchorOf(measurement: TokenMeasurement): TokenAnchor {
  return {
    revision: measurement.revision,
    totalTokens: measurement.totalTokens,
    heuristicTokens: measurement.heuristicTokens,
  }
}

/**
 * 增量游标:只对 `seq > lastSeq` 的事件计价;重复同步同一前缀不算第二遍。
 * 同一 seq 内容变了、或回退到未应用 seq,直接抛错,不静默混用两份历史。
 */
export class TokenMeter {
  private readonly pricer: TokenPricer
  private nodes: SurfaceNode[] = []
  private prices = new Map<number, TokenPrice>()
  private indexBySeq = new Map<number, number>()
  private seals = new Map<number, string>()
  private lastSeq = -1

  constructor(pricer: TokenPricer = estimateNodePrice) {
    this.pricer = pricer
  }

  get revisionSeq(): number {
    return this.lastSeq
  }
  reset(): void {
    this.nodes = []
    this.prices = new Map()
    this.indexBySeq = new Map()
    this.seals = new Map()
    this.lastSeq = -1
  }
  /** @returns 本次实际应用的事件数(前缀已应用的部分不计) */
  sync(events: readonly SessionEvent[]): number {
    let applied = 0
    for (const event of events) {
      const seal = canonicalJson(event)
      if (event.seq <= this.lastSeq) {
        const known = this.seals.get(event.seq)
        if (known !== seal) {
          throw new Error(`token-meter: seq ${event.seq} 已应用过但内容变了,拒绝混用两份历史`)
        }
        continue
      }
      this.apply(event)
      this.seals.set(event.seq, seal)
      applied += 1
    }
    return applied
  }
  measure(options: Omit<TokenMeterOptions, 'pricer'> = {}): TokenMeasurement {
    const cachedPricer: TokenPricer = (message, ctx) =>
      this.prices.get(ctx.seq) ?? estimateNodePrice(message, ctx)
    return measurementOf(this.nodes, { ...options, pricer: cachedPricer })
  }
  private apply(event: SessionEvent): void {
    if (!Number.isInteger(event.seq) || event.seq <= this.lastSeq) {
      throw new Error(`token-meter: 事件 seq 必须严格递增,收到 ${String(event.seq)}`)
    }
    if (event.type === 'message.added') {
      this.nodes.push({
        nodeId: `n:${event.seq}`,
        seq: event.seq,
        message: event.message,
        appliedOpIds: [],
      })
      this.indexBySeq.set(event.seq, this.nodes.length - 1)
      this.prices.set(event.seq, priceNode(this.pricer, event.message, event.seq))
    } else if (event.type === 'message.inserted') {
      if (!Number.isInteger(event.index) || event.index < 0 || event.index > this.nodes.length) {
        throw new Error(`token-meter: 插入下标越界,收到 ${String(event.index)}`)
      }
      this.nodes.splice(event.index, 0, {
        nodeId: `n:${event.seq}`,
        seq: event.seq,
        message: event.message,
        appliedOpIds: [],
      })
      this.reindex()
      this.prices.set(event.seq, priceNode(this.pricer, event.message, event.seq))
    } else {
      const at = this.indexBySeq.get(event.targetSeq)
      if (at === undefined) throw new Error(`token-meter: 目标 seq ${event.targetSeq} 不存在`)
      const node = this.nodes[at]
      if (node === undefined) throw new Error(`token-meter: 目标下标 ${at} 越界`)
      if (!node.appliedOpIds.includes(event.opId)) {
        this.nodes[at] =
          event.type === 'message.replaced'
            ? {
                ...node,
                message: event.message,
                replacedBy: event.opId,
                appliedOpIds: [...node.appliedOpIds, event.opId],
              }
            : { ...node, removed: true, appliedOpIds: [...node.appliedOpIds, event.opId] }
        if (event.type === 'message.replaced') {
          this.prices.set(node.seq, priceNode(this.pricer, event.message, node.seq))
        }
      }
    }
    this.lastSeq = event.seq
  }

  private reindex(): void {
    this.indexBySeq.clear()
    this.nodes.forEach((node, index) => this.indexBySeq.set(node.seq, index))
  }
}
