// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 B02 / 票71 phase 2:小程序端的 gap-resync 发起器(平台适配层)。
 *
 * 分工与 web 端一致,只是调度换成共享泵:
 *  - 端点路径与 ApiResult 失败分型 = `@ihui/shared/chat` 的 `chat-sync-snapshot`(四端同源);
 *  - 失败分类 / 退避重试 / 在飞去重 = `chat-sync-resync`(四端同源);
 *  - 什么时候拉 / 拉完还拉不拉 = `chat-sync-resync-pump`(四端同源);
 *  - 本文件只做一件事:把 Taro 侧的 HTTP 出口(`fetchApi`,已由 app.tsx 绑定 token 与 baseUrl)
 *    交给泵。判据一行都不在这里。
 *
 * 为什么泵不在 `lib/user-broadcast.ts` 里启动:那一层会被 node 用例直接驱动
 * (`feedUserBroadcastFrame` 造 gap),若在那里启动泵,用例就会真的发网络请求 ——
 * 于是"测接线"变成"测网络",且失败形态是安静的。启动点放在应用级 hook
 * (`hooks/use-user-broadcast-sync.ts`)的 token effect 里:有登录态才建泵,登出即停。
 */
import { fetchApi } from '@ihui/api-client'
import type { ChatSyncMessageSnapshot } from '@ihui/types'
import {
  chatSyncStore,
  createChatSyncSnapshotFetcher,
  startChatSyncResyncPump,
  type ChatSyncResyncPumpHandle,
} from '@ihui/shared/chat'

import { logger } from '@/utils/logger'

/** 快照拉取(路径 / 状态码分型在共享层,本端只交 fetchApi) */
export const fetchTaroChatSyncSnapshot = createChatSyncSnapshotFetcher((path) =>
  fetchApi<ChatSyncMessageSnapshot>(path),
)

let pump: ChatSyncResyncPumpHandle | null = null

/**
 * 启动本端 resync 泵(幂等:同一登录态重复调用返回同一句柄)。
 * 仅在应用级 hook 的 token effect 里调用,不在广播适配器里调用(见文件头注)。
 */
export function startTaroChatSyncResync(): ChatSyncResyncPumpHandle {
  if (pump) return pump
  pump = startChatSyncResyncPump({
    store: chatSyncStore,
    fetchSnapshot: fetchTaroChatSyncSnapshot,
    onOutcome: ({ conversationId, outcome }) => {
      // 只有"没补齐"的两种结局值得留痕;merged 全成功属正常路径,不打日志(避免刷屏)。
      if (outcome.failed === 0 && outcome.dropped === 0) return
      logger.warn(
        'chat-sync-resync',
        'gaps not fully resynced',
        `conv=${conversationId} attempted=${outcome.attempted} merged=${outcome.merged} dropped=${outcome.dropped} failed=${outcome.failed}`,
      )
    },
  })
  return pump
}

/** 停止本端 resync 泵(登出 / token 变化 / 卸载);幂等。 */
export function stopTaroChatSyncResync(): void {
  pump?.stop()
  pump = null
}

/** 诊断读数:当前还有多少待办坐标(测试 / 运维面板用) */
export function taroChatSyncResyncPendingCount(): number {
  return pump?.pendingCount() ?? 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
