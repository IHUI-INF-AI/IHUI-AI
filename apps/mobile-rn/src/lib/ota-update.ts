// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * OTA 更新的**单一状态机**(2026-10-27 立)。
 *
 * 为什么要有这一层:此前 OTA 检查逻辑只活在 components/UpdatePrompt.tsx 的 effect 里,
 * 于是设置页的「检查更新」只能假装 —— 它没有可复用的检查入口,只能弹一句"已是最新版本"
 * (用户点什么都得到同一句话,那是假的)。把状态机提成模块级 store 之后:
 *   - 检查/下载/就绪/重启 只有一份实现(expo-updates 全仓唯一消费点);
 *   - 任何界面都能触发检查(checkOtaUpdate),提示卡(UpdatePrompt)自动跟着状态走,
 *     不需要两处各写一遍、也不需要跨屏传参。
 *
 * 状态口径与 web 端 app-version-gate 的六终态对齐(同一套语义,两端看到的文案同源):
 *   idle → checking → downloading → ready → installing
 *   分支:up-to-date(无更新)/ error(检查或下载失败)/ unsupported(环境不支持 OTA)
 *
 * 降级哲学同 web:失败一律不打扰用户(fail-open),只有用户**主动**检查时才如实回话。
 */

import { Platform } from 'react-native'
import * as Updates from 'expo-updates'
import { useSyncExternalStore } from 'react'

export type OtaUpdateState =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'up-to-date'
  | 'error'
  | 'unsupported'

interface OtaStore {
  state: OtaUpdateState
  /** 提示卡是否被用户关掉;新一轮检查就绪时自动复位。 */
  dismissed: boolean
  /** 最近一次失败原因(仅用于排查,不直接展示给用户)。 */
  lastError: string | null
}

let store: OtaStore = { state: 'idle', dismissed: false, lastError: null }
const listeners = new Set<() => void>()

function patch(next: Partial<OtaStore>): void {
  store = { ...store, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 当前环境是否真的能走 OTA:dev-client 与 web 没有 OTA 通道。 */
export function isOtaSupported(): boolean {
  if (__DEV__) return false
  if (Platform.OS === 'web') return false
  return Updates.isEnabled !== false
}

/**
 * 检查并下载更新(自动/手动共用一个入口 —— 状态机不区分触发来源,
 * 差别只在调用方要不要把结论说给用户听)。
 * @returns 结束时的状态,不抛异常。
 */
export async function checkOtaUpdate(): Promise<OtaUpdateState> {
  if (!isOtaSupported()) {
    patch({ state: 'unsupported', lastError: null })
    return 'unsupported'
  }
  patch({ state: 'checking', lastError: null })
  try {
    const check = await Updates.checkForUpdateAsync()
    if (!check.isAvailable) {
      patch({ state: 'up-to-date' })
      return 'up-to-date'
    }
    patch({ state: 'downloading' })
    await Updates.fetchUpdateAsync()
    // 就绪即复位 dismissed:这是新一轮更新,旧的一次性关闭不该继续压着它
    patch({ state: 'ready', dismissed: false })
    return 'ready'
  } catch (e) {
    patch({ state: 'error', lastError: e instanceof Error ? e.message : String(e) })
    return 'error'
  }
}

/** 立即重启应用生效(调用前应已 ready)。失败回落到 error,卡片保持可见可重试。 */
export async function applyOtaUpdate(): Promise<void> {
  patch({ state: 'installing' })
  try {
    await Updates.reloadAsync()
  } catch (e) {
    patch({ state: 'error', lastError: e instanceof Error ? e.message : String(e) })
  }
}

/** 关掉提示卡(仅本次会话;重启或下一轮更新会再出现)。 */
export function dismissOtaPrompt(): void {
  patch({ dismissed: true })
}

/** 当前状态快照(非 React 环境读取用,如"先查再决策"的调用方与单测)。 */
export function otaSnapshot(): OtaStore {
  return store
}

/** 订阅状态(useSyncExternalStore:多屏共享同一份,无 context 依赖)。 */
export function useOtaUpdate(): OtaStore {
  return useSyncExternalStore(
    subscribe,
    () => store,
    () => store,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
