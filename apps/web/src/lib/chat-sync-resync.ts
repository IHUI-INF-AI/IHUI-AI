// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票71 剩余缺口②(2026-10-31 立):web 端 resync 的真实发起与并回。
 *
 * 编排内核(失败分类 / 退避重试 / 在飞去重)已抽到 `@ihui/shared/chat` 的
 * `resyncChatSyncGaps`(零平台依赖,web / taro / RN / extension 共用同一份);本文件只做
 * **web 适配**:把 web 自己的 store 动作与 fetch 注入进去,不重写任何判据。
 *
 *  - `fetchSnapshot` 默认走 `@/api/chat-sync-api`(刻意不走 @ihui/api-client,见该文件头注:
 *    该包此切片在飞、且快照是 REST 单次拉取不与广播连接共享传输层);
 *  - `mergeSnapshot` 转交 `useChatStore.applyChatSyncSnapshot`(判据在契约内核与 web store);
 *    房间不匹配(快照会话非当前打开的那个)⇒ 按 failed 记,不把"没并对"洗成"已对齐"也不摘坐标;
 *  - `dropRequest` 转交 `useChatStore.dropChatSyncGap`(404/409 摘坐标,不重试风暴)。
 *
 * 三类失败的分叉(不许合并成一个布尔)由共享内核统一处理:404/409 ⇒ 摘坐标;
 * 网络错误 / 5xx / 超时 ⇒ 退避重试,最多 `CHAT_SYNC_RESYNC_MAX_ATTEMPTS` 次,耗尽保留坐标;
 * 取消 ⇒ 让路。同坐标并发去重由共享内核的模块级 `inFlight` 承担。
 */
import { useChatStore } from '@/stores/chat'
import { fetchChatSyncSnapshot } from '@/api/chat-sync-api'
import {
  resyncChatSyncGaps as sharedResyncChatSyncGaps,
  CHAT_SYNC_RESYNC_MAX_ATTEMPTS,
  resetChatSyncResyncInflight,
} from '@ihui/shared/chat'
import type { ChatSyncMessageSnapshot } from '@ihui/types'

export { CHAT_SYNC_RESYNC_MAX_ATTEMPTS, resetChatSyncResyncInflight }

/** 各维独立可判,调用方据此点名,不把"没拉到"读成"已对齐" */
export interface ChatSyncResyncOutcome {
  attempted: number
  merged: number
  dropped: number
  failed: number
}

export interface ResyncChatSyncGapsInput {
  conversationId: string
  messageIds: readonly string[]
  fetchSnapshot?: (conversationId: string, messageId: string) => Promise<ChatSyncMessageSnapshot>
  isCancelled?: () => boolean
  delay?: (ms: number) => Promise<void>
}

/**
 * 把当前 gap 坐标逐条拉回并合并。永不抛 —— 线上故障不该让收帧 hook 崩掉。
 * 返回值逐维可判(attempted/merged/dropped/failed),调用方据此点名,不把"没拉到"读成"已对齐"。
 */
export async function resyncChatSyncGaps(
  input: ResyncChatSyncGapsInput,
): Promise<ChatSyncResyncOutcome> {
  return sharedResyncChatSyncGaps({
    conversationId: input.conversationId,
    messageIds: input.messageIds,
    fetchSnapshot: input.fetchSnapshot ?? fetchChatSyncSnapshot,
    mergeSnapshot: (snapshot) => {
      const merged = useChatStore.getState().applyChatSyncSnapshot(snapshot)
      // 房间不匹配(快照的会话不是当前打开的那个)⇒ 不算"拿到了权威回答",按 failed 记,不摘坐标。
      const isRoomMismatch =
        typeof merged === 'object' &&
        merged !== null &&
        'reason' in merged &&
        (merged as { reason?: unknown }).reason === 'room-mismatch'
      return { merged: !isRoomMismatch }
    },
    dropRequest: (_conversationId, messageId) =>
      useChatStore.getState().dropChatSyncGap(messageId),
    isCancelled: input.isCancelled,
    delay: input.delay,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
