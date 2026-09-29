// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台适配层(D153b / D154,2026-09-30 立)—— App(RN)端接 per-user 广播的最小可用链路。
//
// 与小程序端同一分层:跨端判据住在 `@ihui/shared/chat/user-broadcast-store`,
// 本文件只做「把共享订阅出口接到账本 + 通过 deps 交回的提示口说话」,
// 挂载点在 `hooks/use-user-broadcast-sync.ts`。
// 分成两层的理由:用例必须在 vitest 下驱动**同一条接线**,所以这一层不 import
// 导航 / 认证 store / FloatBox —— 那些由调用方注入。
//
// 票面拍板(V4 §11.3 D153 第 6 栏 / D154 第 8 栏③):
//  - 会话元数据:收到 `conversation:updated` ⇒ 就地改掉本端已知的行值(抽屉里的会话标题),
//    并明示 `chat.meta.pullOnly`。**这一端不能照抄"小程序端…"的措辞**(所以语包
//    `packages/i18n/messages/mobile-rn/*` 里有 override):App 不会被切后台挂起,
//    但抽屉是**懒加载**的(没打开过就没有行 ⇒ 账本无从覆盖),而且分页/排序不是一条推送能重算的,
//    所以同样不得声明"实时完备" —— 把没判到说成已同步是本仓最高频的失效型。
//  - MCP 状态:收到 `mcp:status` ⇒ 状态行(`chat.mcp.state.*`)+ `chat.mcp.mobileSettingsHint`
//    (本端没有 MCP 管理面,只给话不给按钮)。
//
// 三条不可漂的写法:
//  ① 连接只走共享出口 `subscribeUserBroadcast`(设备级单例 + 引用计数);端内不得
//    `new WebSocket` 再解析一遍帧,也不得抄第二份事件名清单;
//  ② 提示出口**复用本端已有的 FloatBox**(由调用方注入 `notify`),不新立 UI 面 ——
//    新立一面会触发 AGENTS §17 的运行时 DOM 自验,而 RN 界面本机渲染不了,
//    那条验收就会变成"写了但没人验过"的第二格;
//  ③ 未登录不建连(返回 null 而不是"假装已订阅")。

import { subscribeUserBroadcast, type UserBroadcastSubscription } from '@ihui/api-client'
import type { WebSocketLike } from '@ihui/api-client'
import type { ConversationUpdatedEvent, McpStatusEvent } from '@ihui/types'
import {
  conversationMetaLedger,
  mcpStatusLedger,
  mcpStatusMessage,
  MCP_MOBILE_SETTINGS_HINT_KEY,
} from '@ihui/shared/chat'

/** 已提示过的帧指纹上限:RN 前台可连续数小时,不得无界增长 */
const NOTICE_SEEN_LIMIT = 200
const noticeSeen = new Set<string>()

function rememberNotice(key: string): boolean {
  if (noticeSeen.has(key)) return false
  noticeSeen.add(key)
  if (noticeSeen.size > NOTICE_SEEN_LIMIT) {
    for (const old of Array.from(noticeSeen).slice(0, noticeSeen.size - NOTICE_SEEN_LIMIT)) {
      noticeSeen.delete(old)
    }
  }
  return true
}

/** 用例隔离与显式复位用(业务路径不调) */
export function resetBroadcastNotices(): void {
  noticeSeen.clear()
}

export interface UserBroadcastAdapterDeps {
  /** REST 基址(真机取 `src/lib/config` 的 API_BASE_URL) */
  baseUrl: string
  /** 当前 access token;为空 ⇒ 一条连接都不建 */
  token: string | null
  /** 取词口(真机 = `useI18n().t`) */
  translate: (key: string, params?: Record<string, string | number>) => string
  /** 提示出口:调用方交进本端已有的 FloatBox,本文件不新立界面 */
  notify: (message: string) => void
  /**
   * WS 工厂。默认不注入 ⇒ 共享层用全局 `WebSocket`(RN 环境具备)。
   * 形参存在是为了用例可以注入假 socket;本端用例不建连,帧一律经
   * `feedUserBroadcastFrame` 从共享 hub 打进来。
   */
  webSocketFactory?: (url: string) => WebSocketLike
  /** 诊断出口:认不下来的帧在这里点名(真机 = console.warn,与本端桥接层同一约定) */
  onUndetermined?: (raw: unknown) => void
}

/**
 * 挂上广播订阅:帧落到共享账本(列表值就地变,零 HTTP 请求),并按票面给一次性明示。
 *
 * @returns null = 没有 token(未登录)。调用方不得把 null 读成"已订阅"。
 */
export function attachUserBroadcast(
  deps: UserBroadcastAdapterDeps,
): UserBroadcastSubscription | null {
  if (!deps.token) return null

  return subscribeUserBroadcast(
    {
      baseUrl: deps.baseUrl,
      tokenProvider: () => deps.token,
      ...(deps.webSocketFactory ? { webSocketFactory: deps.webSocketFactory } : {}),
    },
    {
      'conversation:updated': (evt) => {
        const e = evt as ConversationUpdatedEvent
        const { changed, known } = conversationMetaLedger.apply(e)
        if (known && changed.length === 0) return
        const message = deps.translate('chat.meta.pullOnly')
        if (message && rememberNotice(`meta|${e.data.conversationId}|${e.data.at}`)) deps.notify(message)
      },
      'mcp:status': (evt) => {
        const e = evt as McpStatusEvent
        if (!mcpStatusLedger.apply(e)) return
        const line = mcpStatusMessage(e)
        // 连上 / 未知档 ⇒ 没有要说的话(未知档由 onUndetermined 点名,不在这里静默)
        if (!line) return
        const text = deps.translate(line.key, line.params)
        const hint = deps.translate(MCP_MOBILE_SETTINGS_HINT_KEY)
        const message = [text, hint].filter((s) => s.length > 0).join(' · ')
        const attempt = e.data.attempt ?? '-'
        if (message && rememberNotice(`mcp|${e.data.server}|${e.data.state}|${attempt}`)) deps.notify(message)
      },
      onUndetermined: (raw) => deps.onUndetermined?.(raw),
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
