// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gap-resync 的传输面(票 B02 / 票71 phase 2):**端点路径与失败分型的唯一真相**。
 *
 * 路径正本 = `docs/chat-sync-contract.md` §7 第 3 项 / `apps/api/src/routes/chat.ts`:
 * `GET /conversations/:id/messages/:messageId/sync-snapshot`。
 * 此前 web 端内抄了一份路径;phase 2 三端接线时若再抄三份,四份字符串必然漂移
 * (本仓"抄清单"的失效型已发生过多次)。故收进共享层,四端只交 `request` 实现。
 *
 * 失败分型(与 `chat-sync-resync.ts` 的 404/409 判定对齐):
 *  - `request` 返回 `success:false` ⇒ 把 `status` 原样挂到 Error 上,由内核决定
 *    "摘坐标(404/409)"还是"退避重试(其余)";
 *  - `request` 抛错(网络层)⇒ 原样上抛,内核按瞬时处理;
 *  - 缺 `status` ⇒ 不定罪为"补不齐",按瞬时重试 —— 拿不到状态码就说"这条死了"
 *    等于把网络问题洗成数据缺失。
 *
 * 本文件零平台依赖:四端各交一个 `(path) => Promise<ApiResult>`(web 的 `apiOrThrow` 侧
 * 例外,见该端注释),不 import 任何 HTTP 客户端。
 */
import type { ChatSyncMessageSnapshot } from '@ihui/types'

/** API 根相对路径(fetchApi 会自动补 `/api` 前缀;web 端自行拼 `/api`) */
export const CHAT_SYNC_SNAPSHOT_ROUTE = '/chat/conversations'

/** 某条消息的权威快照路径(会话 id / 消息 id 一律 encode,不得拼裸串) */
export function chatSyncSnapshotPath(conversationId: string, messageId: string): string {
  return `${CHAT_SYNC_SNAPSHOT_ROUTE}/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/sync-snapshot`
}

/** 端内 `request` 的最小返回面(与 `@ihui/api-client` 的 ApiResult 结构兼容) */
export interface ChatSyncSnapshotRequestResult {
  success: boolean
  data?: unknown
  status?: number
  error?: string
}

/**
 * 把端内 `request` 适配成泵要的 `fetchSnapshot`。
 *
 * @param request 只负责发请求与交回 ApiResult;不得在此做 404/409 的特判
 *   (分型单一真相在内核,端内特判 = 第二套判据)。
 */
export function createChatSyncSnapshotFetcher(
  request: (path: string) => Promise<ChatSyncSnapshotRequestResult>,
): (conversationId: string, messageId: string) => Promise<ChatSyncMessageSnapshot> {
  return async (conversationId, messageId) => {
    const result = await request(chatSyncSnapshotPath(conversationId, messageId))
    if (!result.success) {
      const error = new Error(result.error || 'sync-snapshot failed') as Error & { status?: number }
      if (typeof result.status === 'number') error.status = result.status
      throw error
    }
    return result.data as ChatSyncMessageSnapshot
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
