// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 Taro(showToast)与端内 store 的登录态,不适合共享。
// 接线本体在 `@/lib/user-broadcast`(可被 node 环境用例驱动),跨端判据在
// `@ihui/shared/chat/user-broadcast-store`(AGENTS §3 共享层优先)—— 本文件只是挂载点。

import { useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { conversationMetaLedger, mcpStatusLedger } from '@ihui/shared/chat'

import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { BASE_URL } from '@/utils/api-config'
import { logger } from '@/utils/logger'
import { taroWebSocketFactory } from '@/utils/taro-websocket-adapter'
import { attachUserBroadcast, resetBroadcastNotices } from '@/lib/user-broadcast'

/**
 * D153b / D154(2026-09-30 立)App 级挂载点(`app.tsx` 的 `UserBroadcastHandler`)。
 *
 * 依赖数组只有 token:换 token(重新登录 / 登出)才重建订阅。取词口走 ref ——
 * `useI18n()` 交回的 `t` 是渲染期新建的函数,放进依赖会让订阅在**每一次渲染**上重建,
 * 表现是连接反复断开重连,而 typecheck 与用例全都看不出来(本仓"失效形态永远是安静"同型)。
 *
 * 登出清两张账本:账本是设备级的,而身份不是 —— 留着上一位用户的行,
 * 读起来就像"这台机还连着别人的会话"。
 */
export function useUserBroadcastSync(): void {
  const { t } = useI18n()
  const token = useUserStore((s) => s.token)
  const translateRef = useRef(t)
  translateRef.current = t

  useEffect(() => {
    if (!token) {
      conversationMetaLedger.clear()
      mcpStatusLedger.clear()
      resetBroadcastNotices()
      return
    }
    const sub = attachUserBroadcast({
      baseUrl: BASE_URL,
      token,
      translate: (key, params) => translateRef.current(key, params),
      notify: (message) => {
        Taro.showToast({ title: message, icon: 'none' })
      },
      webSocketFactory: taroWebSocketFactory,
      // 只打事件名,不打载荷内容(载荷可能带用户数据)
      onUndetermined: (raw) => {
        const event =
          typeof raw === 'object' && raw !== null ? (raw as { event?: unknown }).event : undefined
        logger.warn('user-broadcast', 'frame undetermined', typeof event === 'string' ? event : '-')
      },
    })
    return () => {
      sub?.close()
    }
  }, [token])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
