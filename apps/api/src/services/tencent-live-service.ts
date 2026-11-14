// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 腾讯云直播回调验签服务(迁移自旧架构 TencentCloudLiveSafeUtils.checkSign)。
 * 签名算法:HMAC-SHA256,签名串 = timestamp + nonce + rawBody + callbackKey。
 */

import { createHmac } from 'node:crypto'
import { secretsEqual } from '../plugins/internal-service-token.js'
import { updateLiveChannelStatusByStreamName } from '../db/live-queries.js'

/** 回调时间戳容忍窗口(5 分钟,防重放攻击)。 */
export const CALLBACK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

/** 幂等去重窗口(回调事件 ID 重复处理不产生副作用)。 */
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000
// 值 == null 表示"正在处理"(占位)；数字 = 已完成时刻。见 F-143。
const processedEventIds = new Map<string, number | null>()

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
  // 经全仓唯一比较出口 secretsEqual(定长散列 + timingSafeEqual):长度不等不抛、无长度泄漏
  return secretsEqual(signature, expected)
    ? { ok: true }
    : { ok: false, reason: 'signature mismatch' }
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
  // 占位(null)也是"已在处理" ⇒ 并发重复投递按重复返回,不重复执行副作用
  if (last !== undefined && (last === null || now - last < IDEMPOTENCY_WINDOW_MS)) {
    return { ok: true, duplicated: true, event: eventType, streamName }
  }
  // F-143:去重标记必须**在副作用成功之后**才落,不能先写。
  //
  // 修前这里是 `processedEventIds.set(eventId, now)` 紧接 `await updateLiveChannelStatus...`:
  // DB 一抛错,路由回 500 让腾讯云重发同一 eventId —— 而缓存里已经有它 ⇒ 重试被判
  // duplicated 直接返回 ok,那次状态更新永远不会被补上,频道状态与真实直播永久不一致。
  // 现在的写法:占位值为 null(表示"正在处理"),成功后才盖时间戳;失败/抛错时删除占位,
  // 让平台重发能真正重试。同进程并发同一 eventId 仍互斥(第二次看到占位即按重复返回)。
  processedEventIds.set(eventId, null)
  const markDone = (): void => {
    processedEventIds.set(eventId, Date.now())
    if (processedEventIds.size > 1000) {
      for (const [k, v] of processedEventIds) {
        if (v !== null && now - v > IDEMPOTENCY_WINDOW_MS) processedEventIds.delete(k)
      }
      // F-688:清过期项后仍超额(窗口内洪峰)时按插入顺序淘汰最老的非占位项,
      // 给去重 Map 一个硬上限,避免条目只增不减、每次 set 都全表扫描。
      while (processedEventIds.size > 1000) {
        let evicted = false
        for (const [k, v] of processedEventIds) {
          if (v === null) continue // 占位(处理中)不能删,否则并发重投会漏状态更新
          processedEventIds.delete(k)
          evicted = true
          break
        }
        if (!evicted) break
      }
    }
  }
  const releaseOnFailure = (): void => {
    // 只清自己那枚占位(并发下别的请求可能已经接管成已完成态,不能误删)
    if (processedEventIds.get(eventId) === null) processedEventIds.delete(eventId)
  }

  try {
    switch (eventType) {
      case 'stream_begin':
        if (streamName) await updateLiveChannelStatusByStreamName(streamName, true)
        markDone()
        return { ok: true, event: 'stream_begin', streamName }
      case 'stream_end':
        if (streamName) await updateLiveChannelStatusByStreamName(streamName, false)
        markDone()
        return { ok: true, event: 'stream_end', streamName }
      case 'stream_mixed':
        markDone()
        return { ok: true, event: 'stream_mixed', streamName }
      case 'stream_notify':
        markDone()
        return { ok: true, event: 'stream_notify', streamName }
      default:
        // 非状态变更事件也占位:同一 eventId 反复投递没有意义,但失败仍要能重试
        markDone()
        return { ok: true, event: eventType, ignored: true, streamName }
    }
  } catch (e) {
    // F-143:副作用失败 ⇒ 撤掉占位,让平台重发能真正重试(否则本事件 10 分钟内被判重复)
    releaseOnFailure()
    throw e
  }
}

/** 测试辅助:清空幂等去重缓存(仅用于单元测试隔离)。 */
export function __resetProcessedEventIdsForTest(): void {
  processedEventIds.clear()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
