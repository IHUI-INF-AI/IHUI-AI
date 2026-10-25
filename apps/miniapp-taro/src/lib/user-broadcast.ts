// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台适配层(D153b / D154,2026-09-30 立)—— 小程序端接 per-user 广播的最小可用链路。
//
// 这一份**不 import Taro API**、判据不在本文件:跨端判据住在
// `@ihui/shared/chat/user-broadcast-store` 与 `@ihui/shared/chat/chat-sync-store`,
// 本文件只做「平台 URL 推导 + 把共享订阅出口接到账本 + 通过 deps 交回的提示口说话」。
// React 挂载点在 `hooks/use-user-broadcast-sync.ts`。
// 分成两层的理由不是审美:上一票记录过"模块加载期读 storage 在非小程序环境 import 即崩",
// 用例必须能在 node 环境下驱动同一条接线,否则测的就不是真链路。
//
// 2026-10-26(票 B02 最后一格)追加 chat 消息面:帧经本端 store 的绑定层
// `../stores/chat-sync` 投进共享 store(它是 zustand/vanilla + react 的纯绑定,**不碰 Taro API**),
// 所以"node 用例可驱动同一条接线"这条不变量仍然成立。
//
// 票面拍板(V4 §11.3 D153 第 6 栏 / D154 第 8 栏③):
//  - 会话元数据:收到 `conversation:updated` ⇒ 就地改掉本端已知的行值(所以不会出现
//    "另一端改了、这里还显示旧值"的沉默分叉),**同时**明示 `chat.meta.pullOnly` ——
//    本端不声明"实时完备":切后台 5s 即挂起 JS 线程(见 `use-ui-control-bridge.ts` 同一条平台事实),
//    断连期间的帧收不到,而分页与排序也不是一条推送能重算的。
//  - MCP 状态:收到 `mcp:status` ⇒ 状态行(`chat.mcp.state.*`)+ `chat.mcp.mobileSettingsHint`;
//    本端没有 MCP 管理面,所以只给话不给按钮。
//  - chat 消息面(2026-10-26):`message:created` / `message:patched` ⇒ 共享 chat-sync store
//    (幂等/四态/待 resync 引用契约内核,本端零复算);`message:terminal` 本票不投影,只点名。
//
// 三条不可漂的写法:
//  ① 连接只走共享出口 `subscribeUserBroadcast`(设备级单例 + 引用计数)。端内**不得**
//    `new WebSocket` / `Taro.connectSocket` 自己解析帧,也不得抄第二份事件名清单 ——
//    本文件按事件名挂 handler 是共享出口的入参形状,不是清单;
//  ② 提示出口由调用方注入(真机 = Taro.showToast,本端已有机制),本文件不新立 UI 面;
//  ③ 认不下来的帧必须点名(`onUndetermined`),静默丢弃与静默分叉在用户侧是同一个症状。

import { subscribeUserBroadcast, type UserBroadcastSubscription } from '@ihui/api-client'
import type { WebSocketLike } from '@ihui/api-client'
import {
  CHAT_SYNC_EVENT_NAMES,
  type ChatMessageCreatedEvent,
  type ChatMessagePatchedEvent,
  type ConversationUpdatedEvent,
  type McpStatusEvent,
} from '@ihui/types'
import {
  conversationMetaLedger,
  mcpStatusLedger,
  mcpStatusMessage,
  MCP_MOBILE_SETTINGS_HINT_KEY,
} from '@ihui/shared/chat'

import { chatSyncTaroStoreApi } from '../stores/chat-sync'

/** 已提示过的帧指纹上限:小程序长跑不得无界增长 */
const NOTICE_SEEN_LIMIT = 200
const noticeSeen = new Set<string>()

/**
 * 同一 (会话|字段|时刻) / (server|state|attempt) 只喊一次 —— 重连风暴不得刷屏
 * (与 web 侧 fireOnceNotice 同一档判断)。
 */
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

const ABSOLUTE_HTTP_RE = /^(https?):\/\/([^/?#]+)/i

/**
 * 由 HTTP(S) 基址拼 per-user 广播 WS 地址。
 *
 * 不用 `@ihui/api-client` 的 `buildBroadcastWsUrl`:它内部 `new URL(baseUrl)`,
 * 微信真机 JSCore 不保证有 WHATWG URL 构造器,一抛错就整条连接静默不建
 * (`app.tsx:244-248` 记过本端通知链路的同一条成因)。这里只用正则取 scheme + authority,
 * 并剥掉 BASE_URL 的 /api 前缀 —— 与 `new URL(base).host` 的取值等价。
 *
 * 返回 '' = 无法推导(如 H5 dev 的相对基址 '/api')⇒ 调用方**不建连**,
 * 不得拿一个坏 URL 去试(试了也只是多一次静默失败)。
 */
export function buildTaroBroadcastWsUrl(baseUrl: string, token: string): string {
  const match = ABSOLUTE_HTTP_RE.exec(baseUrl.trim())
  const scheme = match?.[1]?.toLowerCase()
  const authority = match?.[2]
  if (!scheme || !authority) return ''
  return `${scheme === 'https' ? 'wss' : 'ws'}://${authority}/ws/broadcast?token=${encodeURIComponent(token)}`
}

export interface UserBroadcastAdapterDeps {
  /** REST 基址(真机取 `@/utils/api-config` 的 BASE_URL) */
  baseUrl: string
  /** 当前 access token;为空 ⇒ 一条连接都不建(未登录不得挂着连接) */
  token: string | null
  /** 取词口(真机 = `useI18n().t`);用例注入假翻译以便断言"喊的是哪句" */
  translate: (key: string, params?: Record<string, string | number>) => string
  /** 提示出口(真机 = Taro.showToast;用例注入收集器) */
  notify: (message: string) => void
  /** WS 工厂(真机 = taroWebSocketFactory;不给则共享层按全局 WebSocket 判) */
  webSocketFactory?: (url: string) => WebSocketLike
  /** 诊断出口:认不下来的帧在这里点名(真机 = logger.warn) */
  onUndetermined?: (raw: unknown) => void
}

/**
 * chat 消息面帧 → 共享 store(票 B02 最后一格)。
 *
 * 判据零复算:`(messageId, rev)` 幂等、duplicate/stale/gap 四态、待 resync 全在
 * `@ihui/shared/chat` 的 `chat-sync-store`(它引用 `@ihui/types` 的契约内核)。
 * 本函数只做一件事:**把未判定帧的原因交回诊断口**(§0.3:认不出的帧必须点名,
 * 静默丢弃与静默分叉在用户侧是同一个症状)。
 */
function applyChatSyncFrame(
  eventName: string,
  payload: ChatMessageCreatedEvent | ChatMessagePatchedEvent,
  onUndetermined: ((raw: unknown) => void) | undefined,
): void {
  const outcome = chatSyncTaroStoreApi.getState().applyEvent(payload)
  if (outcome.undetermined) {
    // 端点只打事件名与原因,不打载荷(载荷是用户消息内容)
    onUndetermined?.({ event: eventName, reason: outcome.undetermined })
  }
}

/**
 * 挂上广播订阅:帧落到共享账本(列表值就地变,零 HTTP 请求),并按票面给一次性明示。
 *
 * @returns null 的两种情形都必须如实(不得"假装已订阅"):① 没有 token;
 *  ② 基址推不出 WS 地址 —— 这一格本端**结构上收不到帧**,界面只能靠下次打开时拉取对齐,
 *     这正是 `chat.meta.pullOnly` 这句话存在的原因。
 */
export function attachUserBroadcast(
  deps: UserBroadcastAdapterDeps,
): UserBroadcastSubscription | null {
  const token = deps.token
  if (!token) return null
  if (!buildTaroBroadcastWsUrl(deps.baseUrl, token)) return null

  const sub = subscribeUserBroadcast(
    {
      baseUrl: deps.baseUrl,
      // 每次现读:续期后不该拿挂载那一刻的值去换票(共享层 updateToken 依赖这个口)
      tokenProvider: () => deps.token,
      urlBuilder: (t: string) => buildTaroBroadcastWsUrl(deps.baseUrl, t),
      ...(deps.webSocketFactory ? { webSocketFactory: deps.webSocketFactory } : {}),
    },
    {
      'conversation:updated': (evt) => {
        const e = evt as ConversationUpdatedEvent
        const { changed, known } = conversationMetaLedger.apply(e)
        if (known && changed.length === 0) return
        const message = deps.translate('chat.meta.pullOnly')
        if (message && rememberNotice(`meta|${e.data.conversationId}|${e.data.at}`))
          deps.notify(message)
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
        if (message && rememberNotice(`mcp|${e.data.server}|${e.data.state}|${attempt}`))
          deps.notify(message)
      },
      // 票 B02 最后一格(2026-10-26):chat 消息面房间广播 → 共享 store。
      // 键位用 @ihui/types 的契约常量做计算属性 ⇒ 端内不出现帧名字面量(§0.6 单一真相源)。
      [CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED]: (evt) => {
        applyChatSyncFrame(evt.event, evt.data, deps.onUndetermined)
      },
      [CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED]: (evt) => {
        applyChatSyncFrame(evt.event, evt.data, deps.onUndetermined)
      },
      // 终态帧本票**不投影**(票面已按 §24 记录"不做 + 理由":与生产端发终态、web store
      // 状态投影、WS 载体登记同批)。但未接线的帧必须被点名,不得静默 —— 只计数不写状态。
      [CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL]: (evt) => {
        const outcome = chatSyncTaroStoreApi.getState().applyEvent(evt.data)
        if (outcome.unwired) deps.onUndetermined?.({ event: evt.event, reason: outcome.unwired })
      },
      onUndetermined: (raw) => deps.onUndetermined?.(raw),
    },
  )
  // 一次订阅 = 一份账本:`use-user-broadcast-sync` 只在 token 变化时重建订阅(重新登录/换账号),
  // 所以此处清空对齐"身份面重建"。上一位用户的会话消息不得留给下一位 —— store 是设备级的,
  // 身份不是。清空发生在订阅建立之后:订阅没建成(上面两个 return null)时不动既有账本。
  chatSyncTaroStoreApi.getState().clear()
  return sub
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
