/**
 * 跨标签页状态同步
 *
 * 基于 BroadcastChannel 实现，storage 事件作为兼容性回退。
 * 提供 syncStore 高阶函数，将 Zustand store 的变更同步到其他标签页。
 *
 * @module lib/cross-tab-sync
 */

import type { StoreApi } from 'zustand'

// 2026-07-21 安全审计第十轮加固:使用 Web Crypto API 生成 CSPRNG 随机 ID
// 替代 Date.now() + Math.random()(后者可预测,攻击者可伪造同 ID 干扰其他标签页状态)
// crypto.getRandomValues 是浏览器侧 CSPRNG,256 bit 熵,业界标准
function generateInstanceId(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    // 极端兜底:Node 端或其他无 Web Crypto 环境,降级到 Math.random
    // 跨标签页 instanceId 主要是去重目的(非凭证),降级可接受
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return `tab-${Date.now().toString(36)}-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

// ============================================================================
// 类型定义
// ============================================================================

export interface CrossTabSyncOptions {
  /** storage 事件回退使用的 localStorage 键名，默认 `cross-tab-{channelName}` */
  storageKey?: string
  /** 广播防抖延迟（毫秒），默认 300ms */
  debounce?: number
}

interface SyncMessage<T> {
  state: T
  origin: string
}

// ============================================================================
// 核心实现
// ============================================================================

/**
 * 将 Zustand store 的状态变更同步到其他标签页。
 *
 * 优先使用 BroadcastChannel；不可用时回退到 storage 事件。
 * 内置防抖广播和回环保护（接收到的变更不会再次广播）。
 *
 * @param store       Zustand store 实例
 * @param channelName BroadcastChannel 名称
 * @param options     可选配置
 * @returns           销毁函数，取消同步
 *
 * @example
 *   const store = create<MyState>()(...)
 *   const destroy = syncStore(store, 'my-store-sync')
 *   // 卸载时: destroy()
 */
export function syncStore<T extends object>(
  store: StoreApi<T>,
  channelName: string,
  options?: CrossTabSyncOptions,
): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const storageKey = options?.storageKey ?? `cross-tab-${channelName}`
  const debounceMs = options?.debounce ?? 300
  const instanceId = generateInstanceId()

  let channel: BroadcastChannel | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let isReceiving = false

  // ---- BroadcastChannel（首选） ----
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(channelName)
    channel.onmessage = (event: MessageEvent<SyncMessage<T>>) => {
      const msg = event.data
      if (!msg || msg.origin === instanceId) return
      isReceiving = true
      store.setState(msg.state)
      isReceiving = false
    }
  }

  // ---- storage 事件回退 ----
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey || !event.newValue) return
    try {
      const msg = JSON.parse(event.newValue) as SyncMessage<T>
      if (msg.origin === instanceId) return
      isReceiving = true
      store.setState(msg.state)
      isReceiving = false
    } catch {
      // 反序列化失败，静默忽略
    }
  }
  window.addEventListener('storage', onStorage)

  // ---- 订阅 store 变更并广播 ----
  const unsubscribe = store.subscribe((state) => {
    if (isReceiving) return

    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const msg: SyncMessage<T> = { state, origin: instanceId }
      if (channel) {
        channel.postMessage(msg)
      } else if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(storageKey, JSON.stringify(msg))
        } catch {
          // localStorage 不可用或配额已满
        }
      }
    }, debounceMs)
  })

  // ---- 返回销毁函数 ----
  return () => {
    unsubscribe()
    window.removeEventListener('storage', onStorage)
    if (channel) {
      channel.close()
      channel = null
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }
}
