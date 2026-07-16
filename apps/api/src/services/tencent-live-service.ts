/**
 * 腾讯云直播回调验签服务(迁移自旧架构 TencentCloudLiveSafeUtils.checkSign)。
 * 签名算法:HMAC-SHA256,签名串 = timestamp + nonce + rawBody + callbackKey。
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { updateLiveChannelStatusByStreamName } from '../db/live-queries.js'

/** 回调时间戳容忍窗口(5 分钟,防重放攻击)。 */
export const CALLBACK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

/** 幂等去重窗口(回调事件 ID 重复处理不产生副作用)。 */
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000
const processedEventIds = new Map<string, number>()

export interface CallbackSignatureHeaders {
  'x-signature'?: string
  'x-timestamp'?: string
  'x-nonce'?: string
  signature?: string
  timestamp?: string
  nonce?: string
}

export interface CallbackVerifyResult {
  ok: boolean
  reason?: string
}

export interface CallbackEventResult {
  ok: boolean
  event?: string
  streamName?: string
  duplicated?: boolean
  ignored?: boolean
}

/** 计算腾讯云直播回调签名: HMAC-SHA256(timestamp + nonce + rawBody + callbackKey)。 */
export function computeCallbackSignature(
  timestamp: string,
  nonce: string,
  rawBody: string,
  callbackKey: string,
): string {
  return createHmac('sha256', callbackKey)
    .update(`${timestamp}${nonce}${rawBody}${callbackKey}`)
    .digest('hex')
}

/** 验证腾讯云直播回调签名(含时间戳过期校验)。 */
export function verifyCallbackSignature(
  headers: CallbackSignatureHeaders,
  rawBody: string,
  callbackKey: string,
): CallbackVerifyResult {
  if (!callbackKey) return { ok: false, reason: 'callback key not configured' }

  const timestamp = headers['x-timestamp'] ?? headers.timestamp
  const nonce = headers['x-nonce'] ?? headers.nonce
  const signature = headers['x-signature'] ?? headers.signature
  if (!timestamp || !nonce || !signature) {
    return { ok: false, reason: 'missing signature headers' }
  }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid timestamp' }
  const age = Math.abs(Date.now() - ts)
  if (age > CALLBACK_TIMESTAMP_TOLERANCE_MS) return { ok: false, reason: 'timestamp expired' }

  const expected = computeCallbackSignature(timestamp, nonce, rawBody, callbackKey)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return { ok: false, reason: 'signature mismatch' }
  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: 'signature mismatch' }
}

/** 处理腾讯云直播回调事件(stream_begin/stream_end/stream_mixed/stream_notify)。 */
export async function handleCallbackEvent(
  eventType: string | undefined,
  data: Record<string, unknown>,
): Promise<CallbackEventResult> {
  const streamName =
    (data.stream_id as string | undefined) ??
    (data.streamName as string | undefined) ??
    (data.streamId as string | undefined)
  const eventId =
    (data.eventId as string | undefined) ??
    `${eventType ?? 'unknown'}-${streamName ?? ''}-${data.t ?? ''}`

  const now = Date.now()
  const last = processedEventIds.get(eventId)
  if (last !== undefined && now - last < IDEMPOTENCY_WINDOW_MS) {
    return { ok: true, duplicated: true, event: eventType, streamName }
  }
  processedEventIds.set(eventId, now)
  if (processedEventIds.size > 1000) {
    for (const [k, v] of processedEventIds) {
      if (now - v > IDEMPOTENCY_WINDOW_MS) processedEventIds.delete(k)
    }
  }

  switch (eventType) {
    case 'stream_begin':
      if (streamName) await updateLiveChannelStatusByStreamName(streamName, true)
      return { ok: true, event: 'stream_begin', streamName }
    case 'stream_end':
      if (streamName) await updateLiveChannelStatusByStreamName(streamName, false)
      return { ok: true, event: 'stream_end', streamName }
    case 'stream_mixed':
      return { ok: true, event: 'stream_mixed', streamName }
    case 'stream_notify':
      return { ok: true, event: 'stream_notify', streamName }
    default:
      return { ok: true, event: eventType, ignored: true, streamName }
  }
}

/** 测试辅助:清空幂等去重缓存(仅用于单元测试隔离)。 */
export function __resetProcessedEventIdsForTest(): void {
  processedEventIds.clear()
}
