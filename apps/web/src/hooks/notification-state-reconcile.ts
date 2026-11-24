// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 通知权威状态对账(2026-11-24)。
 *
 * WS notification:state 帧不重放,且服务端在慢连接上会跳过该帧并断连(令客户端重连)。
 * 故两个消费 hook(通知重载连 / 广播重连)都要在重连边沿拉一次权威快照收敛。
 * 本模块不依赖任何 hook/useWebSocket,只依赖 api-client 与 store —— 放在独立文件是
 * 为了切断 use-websocket ↔ use-global-notification 的循环 import。
 */

import { queryNotificationStates } from '@ihui/api-client'
import { useNotificationStore } from '@/stores/notification'

/** 单次请求上限,与后端 stateQuerySchema 同限;本地 ids 更多时分片循环 */
const STATE_QUERY_LIMIT = 500

export interface NotificationStateSnapshot {
  readIds: string[]
  archivedIds: string[]
  deletedIds: string[]
}

/** 把权威快照按确切 ids 落到 store(不重算角标、未知 id 不猜不新增)。 */
export function applyNotificationStateSnapshot(state: NotificationStateSnapshot): void {
  const store = useNotificationStore.getState()
  if (state.readIds.length > 0) store.markAsReadByIds(state.readIds)
  if (state.archivedIds.length > 0) store.archiveByIds(state.archivedIds)
  // 删除翻转兜底:断线期被删的通知靠快照 deletedIds 移除(WS 帧不重放)
  if (state.deletedIds.length > 0) store.deleteByIds(state.deletedIds)
}

/**
 * 拿本地已知 ids 跑权威对账:按 500 分片查完、合并后一次性 apply。
 * 任一分片失败/取消 ⇒ 整批不 apply(不留半批状态),下次重连重来。
 */
export async function reconcileNotificationState(isCancelled: () => boolean): Promise<void> {
  const allIds = useNotificationStore.getState().notifications.map((n) => n.id)
  if (allIds.length === 0 || isCancelled()) return
  const merged: NotificationStateSnapshot = { readIds: [], archivedIds: [], deletedIds: [] }
  try {
    for (let offset = 0; offset < allIds.length; offset += STATE_QUERY_LIMIT) {
      if (isCancelled()) return
      const chunk = allIds.slice(offset, offset + STATE_QUERY_LIMIT)
      const res = await queryNotificationStates(chunk)
      if (isCancelled() || !res.success || !res.data) return
      merged.readIds.push(...res.data.readIds)
      merged.archivedIds.push(...res.data.archivedIds)
      merged.deletedIds.push(...res.data.deletedIds)
    }
    if (isCancelled()) return
    applyNotificationStateSnapshot(merged)
  } catch {
    // 静默失败:下次重连再试,不把失败冒充已对齐
  }
}
