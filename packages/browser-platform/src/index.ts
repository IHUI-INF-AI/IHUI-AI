/**
 * @ihui/browser-platform — 浏览器平台适配层(2026-07-27 立)
 *
 * 抽象 chrome.*(extension)/ window.*(web)/ webContents.*(desktop Tauri)等平台 API,
 * 提供统一接口供 8 端复用,消除 extension 内部 chrome.* 调用散落各处的问题。
 *
 * 设计目标:
 * - 接口纯 TypeScript,无任何平台依赖(chrome/window/webContents 不出现在 index.ts)
 * - 实现层各自适配:chrome-impl.ts(extension)/ web-impl.ts(后续)/ tauri-impl.ts(后续)
 * - 调用方只依赖接口,不依赖具体平台 API,方便跨端迁移
 *
 * 调研依据:93 处 chrome.* 调用点(2026-07-27 审计),识别 5 类平台硬边界 +
 * 11 个可抽象接口。硬边界(sidePanel/contextMenus/action/onInstalled/onStartup)
 * 保留在 apps/extension 内,不进适配层。
 *
 * 调用方:@ihui/extension 的 token.ts / config.ts / message-router.ts /
 * agent-control.ts / background.ts 等
 */

// ===== 共享类型 =====

export interface TabInfo {
  id: number
  url: string
  title: string
}

export interface StorageChange {
  oldValue?: unknown
  newValue?: unknown
}

export type StorageArea = 'local' | 'session'

export interface MessageSender {
  tabId?: number
  frameId?: number
  id?: string
}

// ===== Storage Adapter =====

export interface StorageAdapter {
  localGet<T>(key: string): Promise<T | null>
  localSet<T>(key: string, value: T): Promise<void>
  localRemove(key: string): Promise<void>
  sessionGet<T>(key: string): Promise<T | null>
  sessionSet<T>(key: string, value: T): Promise<void>
  sessionRemove(key: string): Promise<void>
  onStorageChanged(area: StorageArea, handler: (changes: Record<string, StorageChange>) => void): () => void
}

// ===== Tabs Adapter =====

export interface TabsAdapter {
  openTab(url: string): Promise<void>
  queryActiveTab(): Promise<TabInfo | null>
  navigateTab(tabId: number, url: string, timeoutMs?: number): Promise<TabInfo>
  activateTab(tabId: number): Promise<void>
  closeTab(tabId: number): Promise<void>
  listTabs(windowId?: number): Promise<TabInfo[]>
  sendMessageToTab<T = unknown>(tabId: number, message: unknown): Promise<T>
  waitForTabComplete(tabId: number, fallbackUrl: string, timeoutMs: number): Promise<TabInfo>
  captureVisibleTab(): Promise<string>
}

// ===== Messaging Adapter =====

export interface MessagingAdapter {
  sendRuntimeMessage<T = unknown>(message: unknown): Promise<T>
  onRuntimeMessage(handler: (message: unknown, sender: MessageSender) => void | Promise<void>): () => void
}

// ===== Runtime Adapter =====

export interface RuntimeAdapter {
  getRuntimeId(): string
  getRuntimeLastError(): { message?: string } | undefined
}

// ===== Scheduler Adapter =====
// chrome.alarms 是 MV3 硬边界(service worker 禁用 setInterval),
// 但可与 desktop 的 setTimeout / web 的 setInterval 抽象为统一接口

export interface SchedulerAdapter {
  schedulePeriodic(name: string, intervalMs: number, handler: () => void): Promise<void>
  scheduleOnce(name: string, delayMs: number, handler: () => void): Promise<void>
  clearSchedule(name: string): Promise<void>
}

// ===== Browser Platform 聚合接口 =====

export interface BrowserPlatform {
  storage: StorageAdapter
  tabs: TabsAdapter
  messaging: MessagingAdapter
  runtime: RuntimeAdapter
  scheduler: SchedulerAdapter
}

// ===== 工厂函数(由具体实现文件导出) =====

export { createChromePlatform } from './chrome-impl.js'
// createWebPlatform(): BrowserPlatform     — 后续 web 端接入时实现
// createTauriPlatform(): BrowserPlatform   — 后续 desktop 接入时实现
