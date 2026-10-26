// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 B02 最后一格(2026-10-26):非 web 端 chat 多端/多标签实时同步 —— 广播帧 → 会话消息面 store。
 *
 * 住在这里而不是端内(AGENTS §3 共享层优先):小程序(taro)与 App(RN)各有一个聊天页、
 * 各一份页级 useState;两端各写一套"收帧 → 改状态"的判断必然漂移,而漂移的表现不是报错,
 * 是"手机上看到半截回复"这一型。端内只留两件事:①把广播 handler 挂到本端适配器上
 * (`lib/user-broadcast.ts`),②用本端状态库把 store 包成 hook(小程序 = zustand/vanilla)。
 *
 * 三条不可漂(判据全部来自 @ihui/types 的 chat-sync-contract,本层零复算):
 *  ① 幂等 = `(messageId, rev)`,四态裁定由 `applyChatSyncEvent` 给出(duplicate/stale/gap);
 *    本文件**不写第二套比较**。被拒时不发布 —— 契约原文:"拒绝不得触发状态发布/重渲染"。
 *  ② gap 的唯一出路 = `planChatSyncResync` 的产物进待 resync 表,由上层拉 sync-snapshot
 *    再走 `mergeChatSyncResyncSnapshot` 并回;**store 不发请求**(纯逻辑层,零平台依赖)。
 *  ③ 认不出的帧(未知帧类型 / 协议版本与帧族不同域 / 缺房间键)与未接线帧(terminal,
 *    票面已按 §24 记录"不做 + 理由")一律**点名计数**,绝不静默丢弃(§0.3);
 *    但都不写状态 —— 把没做写成做了是本仓最高频的失效型。
 *
 * 为什么不复用 api-client 的 `subscribeChatSync`:那把房间键在建订阅时钉死(切会话要重订),
 * 而 per-user 广播本来就把**所有**会话的帧送到同一条连接上;本 store 按 `room.conversationId`
 * 分桶,切会话不丢帧也不重订。房间过滤的判据在本文件一处,不在订阅侧抄第二份。
 */

import {
  CHAT_SYNC_EVENT_NAMES,
  CHAT_SYNC_PROTOCOL_VERSION,
  CHAT_SYNC_TERMINAL_PROTOCOL_VERSION,
  EMPTY_CHAT_SYNC_STATE,
  applyChatSyncEvent,
  mergeChatSyncResyncSnapshot,
  planChatSyncResync,
  type ChatSyncApplyResult,
  type ChatSyncEvent,
  type ChatSyncMessageSnapshot,
  type ChatSyncMessageSurface,
  type ChatSyncResyncMergeOutcome,
  type ChatSyncResyncPlan,
  type ChatSyncResyncRequest,
  type ChatSyncState,
} from '@ihui/types'

/** 参与内核裁定的帧族(terminal 认识但本端未接线,见下方 unwired 分支)。 */
const CHAT_FRAME_TYPES: readonly string[] = [
  CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED,
  CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED,
  CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL,
]

/** 帧族 → 该族信封的协议版本。两族不同域(created/patched 恒 v1、terminal 恒 v2),不得互认。 */
function expectedProtocolVersionOf(type: string): string | null {
  if (type === CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL) return CHAT_SYNC_TERMINAL_PROTOCOL_VERSION
  if (type === CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED) return CHAT_SYNC_PROTOCOL_VERSION
  if (type === CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED) return CHAT_SYNC_PROTOCOL_VERSION
  return null
}

/** 缺房间键 ⇒ 这一帧没有任何会话能认领(空房间键在线上等于发给空气)。 */
function readConversationId(event: ChatSyncEvent): string | null {
  const room = (event as { room?: unknown }).room
  if (typeof room !== 'object' || room === null) return null
  const r = room as { kind?: unknown; conversationId?: unknown }
  // 'conversation' 是契约 ChatSyncRoom.kind 的唯一取值(类型层封闭,无导出常量可引)。
  if (r.kind !== 'conversation') return null
  return typeof r.conversationId === 'string' && r.conversationId.length > 0
    ? r.conversationId
    : null
}

function readMessageId(event: ChatSyncEvent): string | null {
  const id = (event as { messageId?: unknown }).messageId
  return typeof id === 'string' && id.length > 0 ? id : null
}

/** 未判定原因(逐档可判,别把三种坏法压成一个布尔)。 */
export type ChatSyncUndeterminedReason =
  'unknown-type' | 'protocol-version-mismatch' | 'missing-room' | 'missing-message-id'

/** 未接线帧(认识但本端不投影)。与「未判定」分桶:一个是"认不出",一个是"没做"。 */
export type ChatSyncUnwiredReason = 'terminal'

/** 一帧被 store 处理后的可判结论(调用方据此点名/记日志,不必自己再判一遍)。 */
export interface ChatSyncStoreFrameOutcome {
  /** 帧声明的会话;读不到房间键 ⇒ null(该帧不进任何会话桶) */
  conversationId: string | null
  messageId: string | null
  /** 内核裁定;未判定帧 / 未接线帧 ⇒ null(它们没进内核) */
  result: ChatSyncApplyResult | null
  /** 契约唯一转译点(`planChatSyncResync`)的产物;gap 与"未判定但可定位"时 needed=true */
  resync: ChatSyncResyncPlan
  /** 有值 = 本帧未进内核(逐档点名,不静默) */
  undetermined?: ChatSyncUndeterminedReason
  /** 有值 = 帧认识但本端未接线(terminal);不写状态,只计数点名 */
  unwired?: ChatSyncUnwiredReason
}

/** 计数器(诊断面;按事件身份分桶,不做比例/阈值判定 —— 判红权归人)。 */
export interface ChatSyncStoreCounters {
  applied: number
  duplicate: number
  stale: number
  gap: number
  undetermined: number
  unwired: number
}

const ZERO_COUNTERS: ChatSyncStoreCounters = Object.freeze({
  applied: 0,
  duplicate: 0,
  stale: 0,
  gap: 0,
  undetermined: 0,
  unwired: 0,
})

/**
 * 待 resync 表的键:`conversationId` + `messageId`。
 * 用 `\u0000` 分隔而不是 `#`:messageId 里允许出现 `#`(uuid 不会,但契约没禁止),
 * 而 NUL 不在任何标识符字符集里 —— 与 chatPatchKey 的 `#` 是两台不同的尺子。
 */
function resyncKey(conversationId: string, messageId: string): string {
  return `${conversationId}\u0000${messageId}`
}

export interface ChatSyncStore {
  /**
   * 唯一写入口:把一条广播帧应用到对应会话的消息面。
   * 返回值必须被消费(至少用于点名未判定帧);**不抛异常** —— 线上帧不该让端侧崩。
   */
  applyEvent(event: ChatSyncEvent): ChatSyncStoreFrameOutcome
  /** 会话消息面(插入顺序 = 首次到达顺序;无变更时返回同一引用,供 useSyncExternalStore 用) */
  messagesOf(conversationId: string): readonly ChatSyncMessageSurface[]
  /** 该消息已应用的 rev;0 = 只有 created(或未知) */
  appliedRevOf(conversationId: string, messageId: string): number
  /** 待 resync 请求(按首次判 gap 的顺序;同一消息只留一条) */
  pendingResyncs(): readonly ChatSyncResyncRequest[]
  /** 一次 resync 拉回后并回(复用契约 `mergeChatSyncResyncSnapshot`),真应用了才摘待办 */
  mergeResyncSnapshot(snapshot: ChatSyncMessageSnapshot): ChatSyncResyncMergeOutcome
  /** 已知会话 id(插入顺序) */
  conversationIds(): readonly string[]
  counters(): ChatSyncStoreCounters
  /** 每次真实变更递增(端内用它做"是否重渲染"的比较基准) */
  version(): number
  subscribe(listener: () => void): () => void
  /** 登出/切账号:别人的消息必须清掉(store 是设备级的,身份不是) */
  clear(): void
}

/**
 * 工厂形态而不是裸模块单例(与 `createConversationMetaLedger` 同一条理由):
 * 单测需要隔离实例,全局单例会让用例之间互相顶。每端仍只有一个实例(`chatSyncStore`)。
 *
 * @param options.onUndetermined 未判定/未接线帧的诊断出口(端内 = logger.warn)。
 *   **不得**用它代替返回值里的 `undetermined`/`unwired` 字段 —— 诊断出口可以丢,
 *   返回值是调用方点名的唯一凭据。
 */
export function createChatSyncStore(
  options: {
    onUndetermined?: (info: {
      event: string
      reason: ChatSyncUndeterminedReason | ChatSyncUnwiredReason
      conversationId: string | null
      messageId: string | null
    }) => void
  } = {},
): ChatSyncStore {
  const states = new Map<string, ChatSyncState>()
  /** 每会话的消息面视图缓存;状态一变就删该会话的缓存(懒重建 ⇒ 引用稳定) */
  const views = new Map<string, readonly ChatSyncMessageSurface[]>()
  const emptyView: readonly ChatSyncMessageSurface[] = Object.freeze([])
  const pending = new Map<string, ChatSyncResyncRequest>()
  let pendingView: readonly ChatSyncResyncRequest[] | null = Object.freeze([])
  let counters: ChatSyncStoreCounters = ZERO_COUNTERS
  /** 诊断读数的稳定引用:计数变化**不发布**(计数器不是界面数据,发布它会让 duplicate/stale
   *  也触发重渲染,与契约"拒绝不得触发状态发布"冲突)。 */
  let frozenCounters = ZERO_COUNTERS
  let version = 0
  const listeners = new Set<() => void>()

  const publish = (): void => {
    version += 1
    pendingView = null
    for (const listener of Array.from(listeners)) listener()
  }

  const bump = (key: keyof ChatSyncStoreCounters): void => {
    counters = { ...counters, [key]: counters[key] + 1 }
    frozenCounters = Object.freeze(counters)
  }

  const stateOf = (conversationId: string): ChatSyncState =>
    states.get(conversationId) ?? EMPTY_CHAT_SYNC_STATE

  const noteUndetermined = (
    event: ChatSyncEvent,
    reason: ChatSyncUndeterminedReason,
    conversationId: string | null,
    messageId: string | null,
  ): void => {
    bump('undetermined')
    publish()
    options.onUndetermined?.({
      event: event.type,
      reason,
      conversationId,
      messageId,
    })
  }

  const runKernel = (
    conversationId: string,
    event: ChatSyncEvent,
  ): { result: ChatSyncApplyResult; resync: ChatSyncResyncPlan } => {
    const before = stateOf(conversationId)
    const { state, result } = applyChatSyncEvent(before, event)
    const resync = planChatSyncResync({ conversationId, result })
    if (result.applied) {
      states.set(conversationId, state)
      views.delete(conversationId)
      // 帧补齐了 ⇒ 该消息不再欠一份权威快照(快照只是补缺,不是第二条通道)
      pending.delete(resyncKey(conversationId, result.messageId))
      bump('applied')
      publish()
      return { result, resync }
    }
    bump(result.reason)
    if (resync.needed) {
      // 同一消息只留一条:后到的 gap 带的是更新的 lastAppliedRev(端侧只会前进)
      pending.set(resyncKey(conversationId, result.messageId), resync.request)
      publish()
    }
    return { result, resync }
  }

  return {
    applyEvent(event) {
      const type = event.type
      const conversationId = readConversationId(event)
      const messageId = readMessageId(event)

      // ① 帧类型不在契约集里:内核只判 created/terminal,其余一律当 patched —— 未知类型
      //    一旦进内核就会被"当作 patch 应用",这是静默分叉的最短路径。故在此拦下。
      if (!CHAT_FRAME_TYPES.includes(type)) {
        noteUndetermined(event, 'unknown-type', conversationId, messageId)
        return {
          conversationId,
          messageId,
          result: null,
          resync: { needed: false },
          undetermined: 'unknown-type',
        }
      }

      // ② 协议版本与帧族不同域:契约 §2 注要求"不认识的版本按 gap 处理"(不应用、留待 resync)。
      const expected = expectedProtocolVersionOf(type)
      if (
        expected !== null &&
        (event as { protocolVersion?: unknown }).protocolVersion !== expected
      ) {
        const resync: ChatSyncResyncPlan =
          conversationId !== null && messageId !== null
            ? {
                needed: true,
                request: {
                  conversationId,
                  messageId,
                  lastAppliedRev: stateOf(conversationId).appliedRevs.get(messageId) ?? 0,
                },
              }
            : { needed: false }
        if (resync.needed && resync.request) {
          pending.set(
            resyncKey(resync.request.conversationId, resync.request.messageId),
            resync.request,
          )
        }
        noteUndetermined(event, 'protocol-version-mismatch', conversationId, messageId)
        return {
          conversationId,
          messageId,
          result: null,
          resync,
          undetermined: 'protocol-version-mismatch',
        }
      }

      // ③ 房间键缺失:没有会话能认领这一帧(不猜"大概就是当前会话")。
      if (conversationId === null) {
        noteUndetermined(event, 'missing-room', null, messageId)
        return {
          conversationId: null,
          messageId,
          result: null,
          resync: { needed: false },
          undetermined: 'missing-room',
        }
      }

      if (messageId === null) {
        noteUndetermined(event, 'missing-message-id', conversationId, null)
        return {
          conversationId,
          messageId: null,
          result: null,
          resync: { needed: false },
          undetermined: 'missing-message-id',
        }
      }

      // ④ 终态帧:没接线就如实说没接线,绝不当作"什么都没发生"(§0.3)。
      //    这条路**不写状态**也**不排 resync** —— 拉回快照也没人投影终态,排出无人消费的队列
      //    就是把"没做"洗成"在等"。
      if (type === CHAT_SYNC_EVENT_NAMES.MESSAGE_TERMINAL) {
        bump('unwired')
        publish()
        options.onUndetermined?.({
          event: type,
          reason: 'terminal',
          conversationId,
          messageId,
        })
        return {
          conversationId,
          messageId,
          result: null,
          resync: { needed: false },
          unwired: 'terminal',
        }
      }

      const { result, resync } = runKernel(conversationId, event)
      return { conversationId, messageId, result, resync }
    },

    messagesOf(conversationId) {
      const cached = views.get(conversationId)
      if (cached) return cached
      const state = states.get(conversationId)
      if (!state || state.messages.size === 0) return emptyView
      const list = Object.freeze(Array.from(state.messages.values()))
      views.set(conversationId, list)
      return list
    },

    appliedRevOf(conversationId, messageId) {
      return stateOf(conversationId).appliedRevs.get(messageId) ?? 0
    },

    pendingResyncs() {
      if (pendingView === null) pendingView = Object.freeze(Array.from(pending.values()))
      return pendingView
    },

    mergeResyncSnapshot(snapshot) {
      const conversationId = snapshot.conversationId
      const outcome = mergeChatSyncResyncSnapshot(stateOf(conversationId), snapshot)
      if (outcome.applied) {
        states.set(conversationId, outcome.state)
        views.delete(conversationId)
        pending.delete(resyncKey(conversationId, snapshot.messageId))
        bump('applied')
        publish()
      }
      return outcome
    },

    conversationIds() {
      return Object.freeze(Array.from(states.keys()))
    },

    counters() {
      return frozenCounters
    },

    version() {
      return version
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    clear() {
      if (states.size === 0 && pending.size === 0 && version === 0) return
      states.clear()
      views.clear()
      pending.clear()
      counters = ZERO_COUNTERS
      frozenCounters = ZERO_COUNTERS
      publish()
    },
  }
}

/** 设备级单例:每个端进程一份(小程序 / RN 各自打包,不共享内存)。 */
export const chatSyncStore: ChatSyncStore = createChatSyncStore()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
