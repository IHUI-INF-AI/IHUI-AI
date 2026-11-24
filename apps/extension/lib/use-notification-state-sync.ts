// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Extension 端通知状态翻转的消费面（2026-11-24）。
 *
 * 载体与连接复用 `@ihui/api-client` 的 `subscribeUserBroadcast`（设备级单例 + 引用计数 +
 * 短期 WS ticket），端内**不**自己 `new WebSocket` 再解析一遍帧形态。与 web 的
 * `use-notification-state-sync` 同纪律，只是平台适配点换成扩展的 token/baseUrl 读取。
 *
 * 此前扩展只订阅 `/ws/notifications` 的新通知到达帧：他端已读/删除/归档/恢复走的是
 * `/ws/broadcast` 的 `notification:state` 六档，扩展完全没接 ⇒ 常驻侧栏期间角标与列表
 * 一直停在旧值（铃铛只在打开/新通知时重拉，被包装成"按服务端真相收敛"是美化说法）。
 * 这里接上六档翻转 + 重连边沿权威对账（背压跳帧时服务端会断此连接制造重连）。
 */
import { useEffect } from 'react'
import { subscribeUserBroadcast, type UserBroadcastConfig } from '@ihui/api-client'
import type { NotificationStateEvent } from '@ihui/types'
import { getApiBaseUrl } from './config'
import { getToken } from './token'

export interface NotificationStateSyncHandlers {
  /** 收到一帧状态翻转（read/read-all/archive/restore/delete/delete-all） */
  onStateEvent: (evt: NotificationStateEvent) => void
  /** 广播重连边沿：背压跳帧丢的翻转靠这里拉权威真相补回，不靠重放 */
  onReconnect: () => void
}

export function useNotificationStateSync(
  token: string | null,
  handlers: NotificationStateSyncHandlers,
): void {
  const { onStateEvent, onReconnect } = handlers
  useEffect(() => {
    if (!token) return
    const config: UserBroadcastConfig = {
      baseUrl: getApiBaseUrl(),
      tokenProvider: () => getToken(),
    }
    let everConnected = false
    const sub = subscribeUserBroadcast(config, {
      'notification:state': (evt) => onStateEvent(evt),
      onState: (state) => {
        const open = state === 'open'
        const reconnect = open && everConnected
        everConnected = everConnected || open
        if (reconnect) onReconnect()
      },
    })
    return () => sub.close()
  }, [token, onStateEvent, onReconnect])
}
