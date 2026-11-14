// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 B02 / 票71 phase 2:App(RN)端的 gap-resync 发起器(平台适配层)。
 *
 * 与小程序端逐字同构(分层约定见两端 user-broadcast 头注):
 *  - 端点路径 / ApiResult 失败分型 = `@ihui/shared/chat` 的 `chat-sync-snapshot`;
 *  - 失败分类 / 退避重试 / 在飞去重 = `chat-sync-resync`;
 *  - 调度(微任务合并 / 失败不自动重跑 / 停止即让路) = `chat-sync-resync-pump`;
 *  - 本文件只交 RN 侧的 HTTP 出口(`fetchApi`,已在 `lib/token.ts` 经
 *    `bindTokenStoreToApiClient` 绑定凭据与续期)。
 *
 * 启动点在 `hooks/use-user-broadcast-sync.ts` 的 token effect:有登录态才建泵,
 * 登出即停 —— 不在 `lib/user-broadcast.ts` 启动,否则 node 用例造 gap 会真的发网络请求。
 */
import { fetchApi } from '@ihui/api-client'
import type { ChatSyncMessageSnapshot } from '@ihui/types'
import {
  chatSyncStore,
  createChatSyncSnapshotFetcher,
  startChatSyncResyncPump,
  type ChatSyncResyncPumpHandle,
} from '@ihui/shared/chat'

const LOG_TAG = '[chat-sync-resync]'

/** 快照拉取(路径 / 状态码分型在共享层,本端只交 fetchApi) */
export const fetchRnChatSyncSnapshot = createChatSyncSnapshotFetcher((path) =>
  fetchApi<ChatSyncMessageSnapshot>(path),
)

let pump: ChatSyncResyncPumpHandle | null = null

/** 启动本端 resync 泵(幂等:同一登录态重复调用返回同一句柄)。 */
export function startRnChatSyncResync(): ChatSyncResyncPumpHandle {
  if (pump) return pump
  pump = startChatSyncResyncPump({
    store: chatSyncStore,
    fetchSnapshot: fetchRnChatSyncSnapshot,
    onOutcome: ({ conversationId, outcome }) => {
      // 只有"没补齐"的两种结局值得留痕;全成功属正常路径,不打日志(避免刷屏)。
      // 日志行写成 ASCII:守门 70 对新增硬编码中文按文件 HEAD 存量棘轮。
      if (outcome.failed === 0 && outcome.dropped === 0) return
      console.warn(
        `${LOG_TAG} conv=${conversationId} attempted=${outcome.attempted} merged=${outcome.merged} dropped=${outcome.dropped} failed=${outcome.failed}`,
      )
    },
  })
  return pump
}

/** 停止本端 resync 泵(登出 / token 变化 / 卸载);幂等。 */
export function stopRnChatSyncResync(): void {
  pump?.stop()
  pump = null
}

/** 诊断读数:当前还有多少待办坐标(测试 / 运维面板用) */
export function rnChatSyncResyncPendingCount(): number {
  return pump?.pendingCount() ?? 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
