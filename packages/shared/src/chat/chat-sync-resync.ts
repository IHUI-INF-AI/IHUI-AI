// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 B02 / 票71 跨端 resync 编排(纯函数内核,零平台依赖):
 * 把"gap 坐标 → 拉权威快照 → 合并"的失败分类 / 退避重试 / 在飞去重抽成通用实现,
 * 由 web / taro / RN / extension 各自注入 `fetchSnapshot` + `mergeSnapshot` + `dropRequest`
 * 三件套(见各端 `chat-sync-resync` 适配层),本文件不认任何一端的 HTTP / 状态库。
 *
 * 判据不在这里重写:拉的是服务端权威快照(契约 §4 的
 * `GET /conversations/:id/messages/:messageId/sync-snapshot`),合并走调用方转交的
 * store action(各端判据在契约内核)。本文件只做"触发 + 失败分类 + 退避 + 去重"。
 *
 * 三类失败分叉(不许合并成一个布尔):
 *  - 404 / 409:服务端明确说"补不齐"(消息不存在 / 不属于该会话 / 角色不在契约封闭集)
 *    ⇒ 摘除坐标,不重试(重试风暴只会在同一条不存在的消息上空转);
 *  - 网络错误 / 5xx / 超时(无 `status` 或非 404/409):瞬时不可用 ⇒ 退避重试,
 *    最多 `CHAT_SYNC_RESYNC_MAX_ATTEMPTS` 次;耗尽后**保留坐标**(下一次挂载 / 新 gap
 *    触发时再拉),不把"没拉到"洗成"已对齐";
 *  - 取消(切会话 / 组件卸载):立即让路,不改任何状态。
 *
 * 同坐标并发去重:`inFlight` 模块级 Set,effect 重入不会对同一消息发第二条请求。
 */
import type { ChatSyncMessageSnapshot } from '@ihui/types'

/** 单条坐标的最大尝试次数(含首次);耗尽后保留 gap 坐标,交下一次触发 */
export const CHAT_SYNC_RESYNC_MAX_ATTEMPTS = 3

/** 退避基数(第 n 次重试等 n × 基数);测试可注入 delay 跳过等待 */
const CHAT_SYNC_RESYNC_BACKOFF_MS = 800

/** 合并结果:是否真把快照并回了(拿到了权威回答)。`false` = 房间不匹配等被拒情形,按 failed 记 */
export interface ResyncMergeResult {
  merged: boolean
}

export interface ResyncChatSyncGapsInput {
  conversationId: string
  messageIds: readonly string[]
  /**
   * 拉服务端权威快照。抛错时可在 `error.status` 上带 HTTP 状态码
   * —— 404 / 409 ⇒ 摘坐标(不可重试),其余 ⇒ 退避重试。
   */
  fetchSnapshot: (conversationId: string, messageId: string) => Promise<ChatSyncMessageSnapshot>
  /** 合并快照(判据在契约内核;返回 `merged:false` 表示被房间过滤等拒收,按 failed 记) */
  mergeSnapshot: (snapshot: ChatSyncMessageSnapshot) => ResyncMergeResult | Promise<ResyncMergeResult>
  /** 404/409 摘坐标回调 */
  dropRequest: (conversationId: string, messageId: string) => void
  isCancelled?: () => boolean
  delay?: (ms: number) => Promise<void>
}

/** 各维独立可判,调用方据此点名,不把"没拉到"读成"已对齐" */
export interface ChatSyncResyncOutcome {
  /** 真正尝试过的坐标数(已在飞被去重跳过的不计) */
  attempted: number
  /** 拉到权威快照并交给 mergeSnapshot 的坐标数 */
  merged: number
  /** 服务端明确说补不齐、坐标已摘除的枚数 */
  dropped: number
  /** 重试耗尽仍失败的枚数(坐标保留) */
  failed: number
}

/** 在飞去重表:键 = conversationId + NUL + messageId(与 chat-sync-store 的 resyncKey 同形) */
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
          const snapshot = await input.fetchSnapshot(input.conversationId, messageId)
          const merged = await input.mergeSnapshot(snapshot)
          settled = merged.merged ? 'merged' : 'failed'
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
      input.dropRequest(input.conversationId, messageId)
    } else {
      outcome.failed += 1
    }
  }

  return outcome
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
