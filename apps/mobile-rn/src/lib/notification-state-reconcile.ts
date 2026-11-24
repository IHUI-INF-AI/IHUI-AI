// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通知重连权威对账(mobile-rn,2026-11-24)。
 *
 * 与 web 端 notification-state-reconcile 同语义:WS notification:state 帧不重放,
 * 服务端在慢连接上跳帧并断连制造重连边沿;重连后拉一次 state-query 把断线期丢的
 * read/archive/delete 翻转补回。本模块不 import hook / Context store —— ids 来源、
 * 查询函数、应用出口全部由挂载层注入,便于用例直接驱动与 mock。
 *
 * 三条纪律(与 web 同):
 * ① 按 500 分片,与后端 stateQuerySchema 同限;
 * ② 任一分片失败 ⇒ 整批不 apply(不留半批状态);
 * ③ apply 只按权威 ids 改本地已有条目,不重算角标、不猜不新增。
 */
import type { NotificationStateActions } from './user-broadcast'

/** 单次查询上限,与后端 stateQuerySchema 同限 */
export const STATE_QUERY_LIMIT = 500

export interface NotificationStateSnapshot {
  readIds: string[]
  archivedIds: string[]
  deletedIds: string[]
}

export interface ReconcileDeps {
  /** 本地已知通知 ids(挂载层从通知 store 现读) */
  getLocalIds: () => string[]
  /** 权威查询:与 web 共用的 @ihui/api-client.queryNotificationStates */
  query: (
    ids: string[],
  ) => Promise<{ success: boolean; data?: NotificationStateSnapshot | null }>
  /** 权威结果应用口(挂载层从通知 store 取批量 action) */
  apply: (snapshot: NotificationStateSnapshot, actions: NotificationStateActions) => void
  actions: NotificationStateActions
  /** 取消判定(卸载/换账号后停止,避免旧请求回写新身份) */
  isCancelled: () => boolean
}

/**
 * 跑一轮权威对账。返回是否真的 apply 了(全部分片成功且未被取消)。
 * 失败/取消都返回 false,且不写入任何半批结果。
 */
export async function reconcileNotificationState(deps: ReconcileDeps): Promise<boolean> {
  const allIds = deps.getLocalIds()
  if (allIds.length === 0 || deps.isCancelled()) return false
  const merged: NotificationStateSnapshot = { readIds: [], archivedIds: [], deletedIds: [] }
  try {
    for (let offset = 0; offset < allIds.length; offset += STATE_QUERY_LIMIT) {
      if (deps.isCancelled()) return false
      const chunk = allIds.slice(offset, offset + STATE_QUERY_LIMIT)
      const res = await deps.query(chunk)
      if (deps.isCancelled() || !res.success || !res.data) return false
      merged.readIds.push(...res.data.readIds)
      merged.archivedIds.push(...res.data.archivedIds)
      merged.deletedIds.push(...res.data.deletedIds)
    }
    if (deps.isCancelled()) return false
    deps.apply(merged, deps.actions)
    return true
  } catch {
    // 静默失败:下次重连再试,不把失败冒充已对齐
    return false
  }
}

/** 权威快照按确切 ids 落到注入的 action(幂等;未知 id 不猜不新增)。 */
export function applySnapshot(
  snapshot: NotificationStateSnapshot,
  actions: NotificationStateActions,
): void {
  if (snapshot.readIds.length > 0) actions.markAsReadByIds(snapshot.readIds)
  if (snapshot.archivedIds.length > 0) actions.archiveByIds(snapshot.archivedIds)
  if (snapshot.deletedIds.length > 0) actions.deleteByIds(snapshot.deletedIds)
}
