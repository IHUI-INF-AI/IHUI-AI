// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端 OTA 更新提示的**单一状态源**(2026-11-13 立)。
 *
 * 为什么独立成模块:此前小程序端完全没有更新提示 —— `Taro.getUpdateManager()` 从未被接入,
 * 用户永远收不到"有新版本"的信号(更新只在下一次冷启偷偷生效,且失败零反馈)。
 * 这里把"监听更新就绪 + 是否该展示横幅"提成模块级 store,与 RN 的 `lib/ota-update.ts`
 * 同型(都是 useSyncExternalStore + 模块级 listeners),展示卡只负责渲染。
 *
 * 与 RN/Web 的口径对齐(同一套语义,文案同源 appUpdate 命名空间):
 *   - 静默检查 → 静默下载 → 仅当 onUpdateReady(新版本已下载就绪)才打扰用户;
 *   - 顶部下滑横幅 + [更新] 按钮,点按即 applyUpdate() 冷重启生效;
 *   - 关闭 = 仅本次会话(下一次冷启仍会出现),与 RN 的 dismiss 一致。
 *
 * 失败一律 fail-open(对齐多端降级哲学):onUpdateFailed 不弹任何提示,等下次冷启再查;
 * 开发/H5 环境无 getUpdateManager API,init 静默跳过,横幅永远不会出现。
 */

import Taro from '@tarojs/taro'
import { useSyncExternalStore } from 'react'

interface AppUpdateStore {
  /** 新版本已下载就绪,可以展示了。 */
  ready: boolean
  /** 用户是否在本会话手动关掉了横幅(下一轮更新/冷启复位)。 */
  dismissed: boolean
}

let store: AppUpdateStore = { ready: false, dismissed: false }
const listeners = new Set<() => void>()

function patch(next: Partial<AppUpdateStore>): void {
  store = { ...store, ...next }
  for (const listener of listeners) listener()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** 是否应展示横幅:就绪且本次会话未被关闭。client/server 同值,订阅式读。 */
function getSnapshot(): boolean {
  return store.ready && !store.dismissed
}

let initialized = false

/**
 * 在 app 冷启动(useLaunch)里调用一次:挂 getUpdateManager 监听。幂等,重复调用无副作用。
 * H5/开发环境若没有该 API,或任意环节抛错,全部静默吞掉 —— 更新提示是"锦上添花",
 * 绝对不能因为这一段让整包启动链崩掉(初始化链在 app.tsx 里已是 async + try/catch 兜底的)。
 */
export function initAppUpdateManager(): void {
  if (initialized) return
  initialized = true
  try {
    const manager = Taro.getUpdateManager()
    // 新版本下载完成:翻 ready,横幅出现;同时复位 dismissed(新一轮更新不该被旧的一次性关闭压住)
    manager.onUpdateReady(() => patch({ ready: true, dismissed: false }))
    // 下载失败:fail-open,什么都不做,等下次冷启再查
    manager.onUpdateFailed(() => undefined)
  } catch {
    // 环境不支持(开发/H5),静默
  }
}

/** 订阅"是否应展示更新横幅"(渲染期读,变更即重渲染)。 */
export function useAppUpdateReady(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** 用户手动关闭横幅(仅本次会话)。 */
export function dismissAppUpdate(): void {
  patch({ dismissed: true })
}

/** 立即应用更新:小程序会冷重启拉起新版本。失败静默(调用方按钮已给出反馈)。 */
export function applyAppUpdate(): void {
  try {
    Taro.getUpdateManager().applyUpdate()
  } catch {
    // 无 API 时不抛
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
