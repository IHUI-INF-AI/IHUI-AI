// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 提供方用量的复用判据(W4-11)—— 只回答"这份 usage 能不能当锚点",不负责回放。
 *
 * 判据顺序固定:字段合法 → 当前请求 envelope 可算 → 与样本 envelope 一致 →
 * 样本总量不低于本次完整启发式估算。任一不满足都回落启发式,不拿半个样本凑数。
 */

import type { ChatMessage } from './types.js'
import { estimateMessagesTokens } from './token-estimate.js'

export interface TokenPrice {
  tokens: number
  heuristicTokens: number
}

export type TokenPricer = (message: ChatMessage, ctx: { seq: number }) => TokenPrice

export interface TokenMeterOptionsBase {
  pricer?: TokenPricer
  anchor?: TokenAnchor
}

/** 默认计价:路由无关的启发式,两项相同。 */
export const estimateNodePrice: TokenPricer = (message) => {
  const tokens = estimateMessagesTokens([message])
  return { tokens, heuristicTokens: tokens }
}

export interface TokenRequestEnvelope {
  provider: string
  model: string
  system?: string
  tools?: readonly unknown[]
  maxOutputTokens?: number
}

export interface ProviderUsageSample {
  envelope: TokenRequestEnvelope
  /** 请求侧总量(含缓存命中) */
  inputTokens: number
  /** 响应侧总量,缺省 0 */
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export type ProviderUsageStatus =
  | 'absent'
  | 'reused'
  | 'envelope-mismatch'
  | 'below-heuristic'
  | 'invalid'

export interface ProviderUsageResolution {
  status: ProviderUsageStatus
  source: 'provider' | 'heuristic'
  totalTokens: number
  reason: string
}

export interface TokenAnchor {
  revision: string
  totalTokens: number
  heuristicTokens: number
}

export function assertTokenAnchor(anchor: TokenAnchor): void {
  if (typeof anchor.revision !== 'string' || anchor.revision === '') {
    throw new Error('token-meter: anchor.revision 必须是非空字符串')
  }
  assertNonNegativeInteger('anchor.totalTokens', anchor.totalTokens)
  assertNonNegativeInteger('anchor.heuristicTokens', anchor.heuristicTokens)
}

function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`token-meter: ${name} 必须是非负整数,收到 ${String(value)}`)
  }
}

/** 稳定序列化:对象键排序,数组保序。只用于 revision,不用于安全摘要。 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  const bag = value as Record<string, unknown>
  const keys = Object.keys(bag).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(bag[key])}`).join(',')}}`
}

/** FNV-1a 64 位。确定性、无依赖;不是密码学摘要,不得用于鉴权。 */
export function stableDigest(text: string): string {
  let hash = 0xcbf29ce484222325n
  for (let i = 0; i < text.length; i += 1) {
    hash ^= BigInt(text.charCodeAt(i))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0')
}

export function requestEnvelopeFingerprint(envelope: TokenRequestEnvelope): string {
  if (typeof envelope.provider !== 'string' || envelope.provider === '') {
    throw new Error('token-meter: envelope.provider 必须是非空字符串')
  }
  if (typeof envelope.model !== 'string' || envelope.model === '') {
    throw new Error('token-meter: envelope.model 必须是非空字符串')
  }
  return `fnv1a64:${stableDigest(canonicalJson(envelope))}`
}

interface ParsedUsage {
  ok: true
  totalTokens: number
  fingerprint: string
}

function parseUsage(sample: ProviderUsageSample): ParsedUsage | { ok: false; reason: string } {
  try {
    assertNonNegativeInteger('providerUsage.inputTokens', sample.inputTokens)
    assertNonNegativeInteger('providerUsage.outputTokens', sample.outputTokens ?? 0)
    if (sample.cacheReadTokens !== undefined) {
      assertNonNegativeInteger('providerUsage.cacheReadTokens', sample.cacheReadTokens)
    }
    if (sample.cacheWriteTokens !== undefined) {
      assertNonNegativeInteger('providerUsage.cacheWriteTokens', sample.cacheWriteTokens)
    }
    return {
      ok: true,
      totalTokens: sample.inputTokens + (sample.outputTokens ?? 0),
      fingerprint: requestEnvelopeFingerprint(sample.envelope),
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, reason }
  }
}

/**
 * 解析提供方用量。`requestedEnvelope` 是当前请求的 envelope;缺省即无法判定同源。
 */
export function resolveProviderUsage(
  sample: ProviderUsageSample | undefined,
  requestedEnvelope: TokenRequestEnvelope | undefined,
  surfaceTokens: number,
  heuristicTokens: number,
): ProviderUsageResolution {
  if (sample === undefined) {
    return {
      status: 'absent',
      source: 'heuristic',
      totalTokens: surfaceTokens,
      reason: '没有提供方用量,按启发式计量',
    }
  }
  const parsed = parseUsage(sample)
  if (!parsed.ok) {
    return {
      status: 'invalid',
      source: 'heuristic',
      totalTokens: surfaceTokens,
      reason: `提供方用量非法(${parsed.reason}),回落到启发式`,
    }
  }
  if (requestedEnvelope === undefined) {
    return {
      status: 'envelope-mismatch',
      source: 'heuristic',
      totalTokens: surfaceTokens,
      reason: '没有当前请求 envelope,无法判断提供方用量是否同源',
    }
  }
  let requestedFingerprint: string
  try {
    requestedFingerprint = requestEnvelopeFingerprint(requestedEnvelope)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return {
      status: 'invalid',
      source: 'heuristic',
      totalTokens: surfaceTokens,
      reason: `当前请求 envelope 非法(${reason})`,
    }
  }
  if (requestedFingerprint !== parsed.fingerprint) {
    return {
      status: 'envelope-mismatch',
      source: 'heuristic',
      totalTokens: surfaceTokens,
      reason: '请求 envelope 已变化,不复用旧提供方用量',
    }
  }
  if (parsed.totalTokens < heuristicTokens) {
    return {
      status: 'below-heuristic',
      source: 'heuristic',
      totalTokens: surfaceTokens,
      reason: `提供方总量 ${parsed.totalTokens} 低于启发式 ${heuristicTokens},视为不完整样本`,
    }
  }
  return {
    status: 'reused',
    source: 'provider',
    totalTokens: parsed.totalTokens,
    reason: 'envelope 一致且提供方总量不低于启发式,复用提供方用量',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
