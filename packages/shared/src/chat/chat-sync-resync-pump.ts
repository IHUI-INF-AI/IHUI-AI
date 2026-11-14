// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 B02 / 票71 phase 2:**store 驱动的 resync 泵**(零平台依赖)。
 *
 * 与 `resyncChatSyncGaps` 的分工:
 *  - `chat-sync-resync.ts` 是"给定一组坐标怎么拉"(失败分类 / 退避 / 在飞去重);
 *  - 本文件是"什么时候拉、拉完之后还要不要再拉"——把两端最容易各写一套的**调度**
 *    也收成唯一实现,端内只剩"注入 fetch"这一件事。
 *
 * 语义(逐条可判,端内不得另立):
 *  - 订阅共享 store;任何一次 publish 后经**微任务**合并触发一次排空
 *    (不在 `applyEvent` 的同步栈里发网络请求,避免收帧路径被 fetch 拖慢);
 *  - 排空时按会话分组调 `resyncChatSyncGaps`,同坐标在飞去重仍由内核的 `inFlight` 承担;
 *  - 每处理一个坐标就记入 `attempted`:**失败(坐标保留)不会在同一 pump 生命周期内
 *    被自动重跑**,否则"publish → 拉 → 失败 → publish"会变成重试风暴 ——
 *    契约要的是"交下一次触发"(重新挂载 / 新 gap / 显式 `retryFailed()`);
 *  - 排空期间到达的新 gap 不会被丢:排空末尾再检查一次新鲜坐标,有就续跑一轮;
 *  - `stop()` 之后不再发起任何请求(切账号 / 卸载)。

 * 诊断出口 `onOutcome` 只用于点名,**不得**代替返回值:泵的返回值是
 * `ChatSyncResyncPumpHandle`,各端据此判"泵在不在"。
 */
import type { ChatSyncMessageSnapshot, ChatSyncResyncRequest } from '@ihui/types'
import {
  resyncChatSyncGaps,
  type ChatSyncResyncOutcome,
} from './chat-sync-resync'

/** 泵需要的 store 面(结构类型,端内 zustand 包装层只需实现这几个方法) */
export interface ChatSyncResyncPumpStore {
  subscribe(listener: () => void): () => void
  pendingResyncs(): readonly ChatSyncResyncRequest[]
  mergeResyncSnapshot(snapshot: ChatSyncMessageSnapshot): { applied: boolean }
  dropResyncRequest(conversationId: string, messageId: string): void
}

export interface StartChatSyncResyncPumpInput {
  store: ChatSyncResyncPumpStore
  /** 拉服务端权威快照;抛错时把 HTTP 状态码挂在 `error.status` 上(404/409 摘坐标) */
  fetchSnapshot: (conversationId: string, messageId: string) => Promise<ChatSyncMessageSnapshot>
  /** 诊断出口:每会话一轮结束报一次(端内 = logger.warn / console.warn) */
  onOutcome?: (info: {
    conversationId: string
    outcome: ChatSyncResyncOutcome
  }) => void
  /** 仅测试注入(跳过退避等待) */
  delay?: (ms: number) => Promise<void>
  /** 仅测试注入:调度器(默认 queueMicrotask) */
  schedule?: (run: () => void) => void
}

export interface ChatSyncResyncPumpHandle {
  /** 手动踢一次(测试 / 端内点"重试"用);已停止则无动作 */
  kick(): void
  /** 停止泵并退订(幂等) */
  stop(): void
  /** 清空"已尝试"记录并踢一次 —— 失败坐标的显式重试入口 */
  retryFailed(): void
  /** 诊断读数:当前待办坐标数 */
  pendingCount(): number
}

function pumpKeyOf(conversationId: string, messageId: string): string {
  return `${conversationId}\u0000${messageId}`
}

/**
 * 启动一个 store 驱动的 resync 泵。返回句柄;**不抛** —— 建成即返回,
 * 唯一失败形态是"没有待办所以什么都没发生"。
 */
export function startChatSyncResyncPump(
  input: StartChatSyncResyncPumpInput,
): ChatSyncResyncPumpHandle {
  const { store } = input
  const schedule = input.schedule ?? ((run: () => void) => queueMicrotask(run))

  /** 本泵生命周期内已处理过的坐标(含失败保留的) —— 防重试风暴 */
  const attempted = new Set<string>()
  let stopped = false
  let running = false
  let scheduled = false

  const freshRequests = (): readonly ChatSyncResyncRequest[] => {
    if (stopped) return []
    return store
      .pendingResyncs()
      .filter((request) => !attempted.has(pumpKeyOf(request.conversationId, request.messageId)))
  }

  const groupByConversation = (
    requests: readonly ChatSyncResyncRequest[],
  ): Map<string, string[]> => {
    const grouped = new Map<string, string[]>()
    for (const request of requests) {
      const list = grouped.get(request.conversationId)
      if (list) list.push(request.messageId)
      else grouped.set(request.conversationId, [request.messageId])
    }
    return grouped
  }

  const drain = async (): Promise<void> => {
    if (stopped || running) return
    running = true
    try {
      for (;;) {
        const fresh = freshRequests()
        if (fresh.length === 0) return
        // 先记账再请求:失败坐标也必须落在"已尝试"里,否则下一轮排空立刻重跑
        for (const request of fresh) attempted.add(pumpKeyOf(request.conversationId, request.messageId))

        for (const [conversationId, messageIds] of groupByConversation(fresh)) {
          if (stopped) return
          const outcome = await resyncChatSyncGaps({
            conversationId,
            messageIds,
            fetchSnapshot: input.fetchSnapshot,
            mergeSnapshot: (snapshot) => {
              const merged = store.mergeResyncSnapshot(snapshot)
              return { merged: merged.applied }
            },
            dropRequest: (c, m) => store.dropResyncRequest(c, m),
            isCancelled: () => stopped,
            ...(input.delay ? { delay: input.delay } : {}),
          })
          input.onOutcome?.({ conversationId, outcome })
        }
      }
    } finally {
      running = false
      // 排空期间 store 又 publish 过(新 gap / 新会话)⇒ 不能丢,续一轮
      if (!stopped && freshRequests().length > 0) kick()
    }
  }

  function kick(): void {
    if (stopped || running || scheduled) return
    scheduled = true
    schedule(() => {
      scheduled = false
      void drain()
    })
  }

  const unsubscribe = store.subscribe(kick)

  return {
    kick,
    stop() {
      if (stopped) return
      stopped = true
      unsubscribe()
    },
    retryFailed() {
      if (stopped) return
      attempted.clear()
      kick()
    },
    pendingCount() {
      return freshRequests().length
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
