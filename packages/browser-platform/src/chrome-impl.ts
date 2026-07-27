/**
 * @ihui/browser-platform chrome.* 实现(2026-07-27 立)
 *
 * 适配 Chrome MV3 扩展平台,实现 BrowserPlatform 接口。
 * 依赖全局 chrome 对象(@types/chrome 提供类型),仅在 extension 环境可用。
 *
 * 调用方:apps/extension 的 token.ts / config.ts / message-router.ts /
 * agent-control.ts / background.ts 等
 *
 * 设计说明:
 * - chrome.storage.session 是 MV3 可选 API,用 ?. 防御
 * - chrome.alarms 最小周期 1 分钟(MV3 限制),intervalMs < 60000 自动 clamp
 * - chrome.tabs.sendMessage 用 callback 包装为 Promise,保留 lastError 语义
 * - waitForTabComplete 复用 agent-control.ts 原实现(已验证稳定)
 */
import type {
  BrowserPlatform,
  StorageAdapter,
  TabsAdapter,
  MessagingAdapter,
  RuntimeAdapter,
  SchedulerAdapter,
  TabInfo,
  StorageChange,
  StorageArea,
  MessageSender,
} from './index.js'

// ===== Storage Adapter =====

const chromeStorage: StorageAdapter = {
  async localGet<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key)
    return (result[key] as T | undefined) ?? null
  },

  async localSet<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  },

  async localRemove(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  },

  async sessionGet<T>(key: string): Promise<T | null> {
    if (!chrome.storage.session) return null
    const result = await chrome.storage.session.get(key)
    return (result[key] as T | undefined) ?? null
  },

  async sessionSet<T>(key: string, value: T): Promise<void> {
    if (!chrome.storage.session) return
    await chrome.storage.session.set({ [key]: value })
  },

  async sessionRemove(key: string): Promise<void> {
    if (!chrome.storage.session) return
    await chrome.storage.session.remove(key)
  },

  onStorageChanged(
    area: StorageArea,
    handler: (changes: Record<string, StorageChange>) => void,
  ): () => void {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== area) return
      const transformed: Record<string, StorageChange> = {}
      for (const [k, v] of Object.entries(changes)) {
        transformed[k] = { oldValue: v.oldValue, newValue: v.newValue }
      }
      handler(transformed)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  },
}

// ===== Tabs Adapter =====

function waitForTabComplete(
  tabId: number,
  fallbackUrl: string,
  timeoutMs: number,
): Promise<TabInfo> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      resolve({ id: tabId, url: fallbackUrl, title: '' })
    }, timeoutMs)
    const listener = (id: number, info: { status?: string }, tab: chrome.tabs.Tab) => {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer)
        chrome.tabs.onUpdated.removeListener(listener)
        resolve({ id: tabId, url: tab.url || fallbackUrl, title: tab.title || '' })
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

const chromeTabs: TabsAdapter = {
  async openTab(url: string): Promise<void> {
    await chrome.tabs.create({ url })
  },

  async queryActiveTab(): Promise<TabInfo | null> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tab = tabs[0]
    if (!tab || typeof tab.id !== 'number') return null
    return { id: tab.id, url: tab.url || '', title: tab.title || '' }
  },

  async navigateTab(tabId: number, url: string, timeoutMs = 30000): Promise<TabInfo> {
    await chrome.tabs.update(tabId, { url })
    return waitForTabComplete(tabId, url, timeoutMs)
  },

  async activateTab(tabId: number): Promise<void> {
    await chrome.tabs.update(tabId, { active: true })
  },

  async closeTab(tabId: number): Promise<void> {
    await chrome.tabs.remove(tabId)
  },

  async listTabs(windowId?: number): Promise<TabInfo[]> {
    const query = windowId !== undefined ? { windowId } : { currentWindow: true }
    const tabs = await chrome.tabs.query(query)
    return tabs
      .filter((t): t is chrome.tabs.Tab & { id: number } => typeof t.id === 'number')
      .map((t) => ({ id: t.id, url: t.url || '', title: t.title || '' }))
  },

  sendMessageToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response: T) => {
        const lastErr = chrome.runtime.lastError
        if (lastErr) {
          reject(new Error(lastErr.message))
          return
        }
        resolve(response)
      })
    })
  },

  waitForTabComplete(tabId: number, fallbackUrl: string, timeoutMs: number): Promise<TabInfo> {
    return waitForTabComplete(tabId, fallbackUrl, timeoutMs)
  },

  async captureVisibleTab(): Promise<string> {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' })
    return dataUrl.replace(/^data:image\/png;base64,/, '')
  },
}

// ===== Messaging Adapter =====

const chromeMessaging: MessagingAdapter = {
  sendRuntimeMessage<T = unknown>(message: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response: T) => {
        const lastErr = chrome.runtime.lastError
        if (lastErr) {
          reject(new Error(lastErr.message))
          return
        }
        resolve(response)
      })
    })
  },

  onRuntimeMessage(
    handler: (message: unknown, sender: MessageSender) => void | Promise<void>,
  ): () => void {
    const listener = (message: unknown, sender: chrome.runtime.MessageSender) => {
      const mappedSender: MessageSender = {
        tabId: sender.tab?.id,
        frameId: sender.frameId,
        id: sender.id,
      }
      void handler(message, mappedSender)
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  },
}

// ===== Runtime Adapter =====

const chromeRuntime: RuntimeAdapter = {
  getRuntimeId(): string {
    return chrome.runtime.id
  },

  getRuntimeLastError(): { message?: string } | undefined {
    const err = chrome.runtime.lastError
    return err ? { message: err.message } : undefined
  },
}

// ===== Scheduler Adapter =====
// chrome.alarms 最小周期 1 分钟(MV3 限制),intervalMs/delayMs 自动 clamp 到 60000ms
// alarmListeners 存储 handler 引用,clearSchedule 时移除

const alarmListeners = new Map<string, (alarm: chrome.alarms.Alarm) => void>()

function clampToMinutes(ms: number): number {
  return Math.max(Math.ceil(ms / 60000), 1)
}

const chromeScheduler: SchedulerAdapter = {
  async schedulePeriodic(name: string, intervalMs: number, handler: () => void): Promise<void> {
    const periodInMinutes = clampToMinutes(intervalMs)
    chrome.alarms.create(name, { periodInMinutes })
    const listener = (alarm: chrome.alarms.Alarm) => {
      if (alarm.name === name) handler()
    }
    chrome.alarms.onAlarm.addListener(listener)
    // 同名 alarm 覆盖时,先清理旧 listener 避免泄漏
    const oldListener = alarmListeners.get(name)
    if (oldListener) {
      chrome.alarms.onAlarm.removeListener(oldListener)
    }
    alarmListeners.set(name, listener)
  },

  async scheduleOnce(name: string, delayMs: number, handler: () => void): Promise<void> {
    const delayInMinutes = clampToMinutes(delayMs)
    chrome.alarms.create(name, { delayInMinutes })
    const listener = (alarm: chrome.alarms.Alarm) => {
      if (alarm.name === name) {
        handler()
        // 一次性任务触发后自动清理
        chrome.alarms.onAlarm.removeListener(listener)
        alarmListeners.delete(name)
      }
    }
    chrome.alarms.onAlarm.addListener(listener)
    const oldListener = alarmListeners.get(name)
    if (oldListener) {
      chrome.alarms.onAlarm.removeListener(oldListener)
    }
    alarmListeners.set(name, listener)
  },

  async clearSchedule(name: string): Promise<void> {
    const listener = alarmListeners.get(name)
    if (listener) {
      chrome.alarms.onAlarm.removeListener(listener)
      alarmListeners.delete(name)
    }
    await chrome.alarms.clear(name)
  },
}

// ===== 工厂函数 =====

export function createChromePlatform(): BrowserPlatform {
  return {
    storage: chromeStorage,
    tabs: chromeTabs,
    messaging: chromeMessaging,
    runtime: chromeRuntime,
    scheduler: chromeScheduler,
  }
}
