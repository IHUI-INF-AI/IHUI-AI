// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 通知状态翻转的 web 消费面(2026-11-24)。
 *
 * 载体与连接与会话广播共享(`@ihui/api-client` 的 `subscribeUserBroadcast`,设备级单例
 * + 引用计数):本 hook 只做平台适配 —— 把 `notification:state` 帧落到 web 的两处真值:
 *  ① zustand 通知 store(侧栏角标/列表缓存)的批量翻转 API
 *  ② react-query `['notifications','list',…]` 缓存(通知中心列表就地改,不发 HTTP)
 *
 * 三条纪律:
 *  ① **按服务端 ids 精确应用**:不用"无条件全量置读" —— 那会把本地尚未收到的新通知
 *     也洗成已读。`read-all` 帧也带确切 ids,同样按 ids 应用;删除两档同样按 ids
 *     精确移除,不用"无条件全量清空"。
 *  ② **角标取服务端真相**:翻转后重新 getUnreadCount 覆盖,不靠本地条目数重算
 *     (归档行的口径与本地列表不一致,本地重算会把两者互相掩盖)。
 *  ③ **回声不误报**:帧会发给本人全部连接(含发起端),发起端本地已是新值;
 *     这里只静默对账、不弹提示(状态翻转本就没有面向用户的提示文案)。
 */
import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getUnreadCount, subscribeUserBroadcast, type UserBroadcastConfig } from '@ihui/api-client'
import type { NotificationStateEvent } from '@ihui/types'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notification'
import { resolveWsApiBaseUrl } from '@/lib/api-base-url'

/** 就地改 react-query 里所有通知列表缓存的对应行;不命中不新增(它可能是本页不显示的归档行) */
function patchNotificationListCaches(
  qc: ReturnType<typeof useQueryClient>,
  evt: NotificationStateEvent,
): void {
  const ids = new Set(evt.data.ids)
  qc.setQueriesData<{ list?: Array<{ id: string; isRead?: boolean; archivedAt?: string | null }> }>(
    { queryKey: ['notifications', 'list'] },
    (old) => {
      if (!old || !Array.isArray(old.list)) return old
      // 删除翻转:按确切 ids 移除,不用无条件清空(那会误删本地尚未收到的新通知)
      if (evt.data.op === 'delete' || evt.data.op === 'delete-all') {
        return { ...old, list: old.list.filter((row) => !ids.has(row.id)) }
      }
      return {
        ...old,
        list: old.list.map((row) => {
          if (!ids.has(row.id)) return row
          if (evt.data.op === 'archive') return { ...row, archivedAt: new Date().toISOString() }
          if (evt.data.op === 'restore') return { ...row, archivedAt: null }
          // read / read-all 都按确切 ids 置读
          return { ...row, isRead: true }
        }),
      }
    },
  )
}

export function useNotificationStateSync(): { connected: boolean; undetermined: number } {
  const token = useAuthStore((s) => s.token)
  const qc = useQueryClient()
  const [undetermined, setUndetermined] = React.useState(0)
  const [connected, setConnected] = React.useState(false)

  React.useEffect(() => {
    if (!token) return
    if (typeof window === 'undefined') return
    const config: UserBroadcastConfig = {
      baseUrl: resolveWsApiBaseUrl(),
      tokenProvider: () => useAuthStore.getState().token,
    }
    let cancelled = false
    const sub = subscribeUserBroadcast(config, {
      'notification:state': (evt) => {
        if (cancelled) return
        const { op, ids } = evt.data
        const store = useNotificationStore.getState()
        if (op === 'read' || op === 'read-all') store.markAsReadByIds(ids)
        else if (op === 'archive') store.archiveByIds(ids)
        else if (op === 'restore') store.restoreByIds(ids)
        else if (op === 'delete' || op === 'delete-all') store.deleteByIds(ids)
        // 缓存就地改 + 角标取服务端真相:两条都不等 UI 自己数条目
        patchNotificationListCaches(qc, evt)
        void getUnreadCount()
          .then((res) => {
            if (cancelled || !res.success || !res.data) return
            useNotificationStore.getState().setUnreadCounts({
              notifications: res.data.notification ?? 0,
              messages: res.data.message ?? 0,
            })
          })
          .catch(() => {
            // 静默失败:角标下次推送/重连再对齐,不把失败冒充已同步
          })
      },
      onState: (state) => setConnected(state === 'open'),
      onUndetermined: () => setUndetermined((n) => n + 1),
    })
    return () => {
      cancelled = true
      sub.close()
    }
  }, [token, qc])

  return { connected, undetermined }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
