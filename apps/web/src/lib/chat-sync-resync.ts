// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票71 剩余缺口②(2026-10-31 立):web 端 resync 的真实发起与并回。
 *
 * 契约正本 docs/chat-sync-contract.md §4/§7:
 *  - 发起判据唯一转译点 = `planChatSyncResync`(只有 gap 才发,duplicate/stale 是正常路径);
 *  - 并回判据唯一入口 = `applyChatSyncSnapshot`(created → snapshot → terminal 三步全走内核);
 *  - 本文件**不重写任何裁定**:gap 坐标由 store 的 `chatSyncGapMessageIds` 给出(内核
 *    `applyChatSyncEvent` 判 gap 时写入),快照合并由 store action 完成。这里只有三件事:
 *    ① 逐坐标调 `fetchChatSyncSnapshot`;② 失败分类与有限重试;③ 取消/会话切换时让路。
 *
 * 三类失败的分叉(不许合并成一个布尔):
 *  - 404 / 409:服务端明确说"补不齐"(消息不存在/不属于该会话、角色不在契约封闭集)⇒
 *    摘除坐标,不重试(重试风暴只会在同一条不存在的消息上空转)。
 *  - 网络错误 / 5xx / 超时:瞬时不可用 ⇒ 退避重试,最多 `MAX_ATTEMPTS` 次;
 *    耗尽后**保留坐标**(下一次挂载/新 gap 触发时再拉),不把"没拉到"洗成"已对齐"。
 *  - 取消(切会话 / 组件卸载):立即让路,不改任何状态。
 *
 * 同坐标并发去重:`inFlight` 模块级 Set,effect 重入不会对同一消息发第二条请求。
 */
import { fetchChatSyncSnapshot } from '@/api/chat-sync-api'
import { useChatStore } from '@/stores/chat'
import type { ChatSyncMessageSnapshot } from '@ihui/types'

/** 单条坐标的最大尝试次数(含首次);耗尽后保留 gap 坐标,交下一次触发 */
export const CHAT_SYNC_RESYNC_MAX_ATTEMPTS = 3

/** 退避基数(第 n 次重试等 n × 基数);测试可注入 delay 跳过等待 */
export const CHAT_SYNC_RESYNC_BACKOFF_MS = 800

export interface ChatSyncResyncOutcome {
  /** 真正尝试过的坐标数(已在飞被去重跳过的不计) */
  attempted: number
  /** 拉到权威快照并交给 store 合并的坐标数 */
  merged: number
  /** 服务端明确说补不齐、坐标已摘除的枚数 */
  dropped: number
  /** 重试耗尽仍失败的枚数(坐标保留) */
  failed: number
}

export interface ResyncChatSyncGapsInput {
  conversationId: string
  messageIds: readonly string[]
  fetchSnapshot?: (conversationId: string, messageId: string) => Promise<ChatSyncMessageSnapshot>
  isCancelled?: () => boolean
  delay?: (ms: number) => Promise<void>
}

/** 在飞去重表:键 = conversationId + NUL + messageId(与 shared chat-sync-store 的 resyncKey 同形) */
const inFlight = new Set<string>()

function keyOf(conversationId: string, messageId: string): string {
  return `${conversationId}\u0000${messageId}`
}

/** 仅测试与显式运维复位:常规路径随请求结束自然清空 */
export function resetChatSyncResyncInflight(): void {
  inFlight.clear()
}

function statusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const status = (err as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

/**
 * 把当前 gap 坐标逐条拉回并合并。永不抛 —— 线上故障不该让收帧 hook 崩掉。
 * 返回值逐维可判(attempted/merged/dropped/failed),调用方据此点名,不把"没拉到"读成"已对齐"。
 */
export async function resyncChatSyncGaps(
  input: ResyncChatSyncGapsInput,
): Promise<ChatSyncResyncOutcome> {
  const fetchSnapshot = input.fetchSnapshot ?? fetchChatSyncSnapshot
  const isCancelled = input.isCancelled ?? (() => false)
  const delay =
    input.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const outcome: ChatSyncResyncOutcome = { attempted: 0, merged: 0, dropped: 0, failed: 0 }

  for (const messageId of input.messageIds) {
    if (isCancelled()) break
    const key = keyOf(input.conversationId, messageId)
    if (inFlight.has(key)) continue
    inFlight.add(key)
    outcome.attempted += 1

    let settled: 'merged' | 'dropped' | 'failed' = 'failed'
    try {
      for (let attempt = 1; attempt <= CHAT_SYNC_RESYNC_MAX_ATTEMPTS; attempt += 1) {
        if (isCancelled()) break
        try {
          const snapshot = await fetchSnapshot(input.conversationId, messageId)
          const merged = useChatStore.getState().applyChatSyncSnapshot(snapshot)
          // 会话已切走 ⇒ store 按房间过滤拒收(切会话时坐标本就已清);照实记 failed,
          // 不把"没合并"写成 merged。其余裁定(应用/duplicate/stale)都算"拿到了权威回答"。
          settled = 'reason' in merged && merged.reason === 'room-mismatch' ? 'failed' : 'merged'
          break
        } catch (err) {
          const status = statusOf(err)
          if (status === 404 || status === 409) {
            // 服务端已给出权威否定 ⇒ 不再重试,摘坐标(否则每次挂载都问同一条死消息)
            settled = 'dropped'
            break
          }
          if (attempt < CHAT_SYNC_RESYNC_MAX_ATTEMPTS) {
            await delay(CHAT_SYNC_RESYNC_BACKOFF_MS * attempt)
          }
        }
      }
    } finally {
      inFlight.delete(key)
    }

    if (settled === 'merged') {
      outcome.merged += 1
    } else if (settled === 'dropped') {
      outcome.dropped += 1
      useChatStore.getState().dropChatSyncGap(messageId)
    } else {
      outcome.failed += 1
    }
  }

  return outcome
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
