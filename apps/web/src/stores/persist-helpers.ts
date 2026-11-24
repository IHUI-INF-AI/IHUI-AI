// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createJSONStorage, type PersistStorage } from 'zustand/middleware'
import { createLocalStorageTransport } from './storage-adapter'

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

// 客户端读写走端工厂单点(createSyncTransport 包装 window.localStorage),不在装配点重抄一份 adapter。
// 触一次 window.localStorage 保改造前的失败时机:隐私模式下取该属性即抛,由 createJSONStorage
// 的 try/catch 把整块降级成「无持久化」,而不是让后续 setState 抛穿到渲染路径。
export const ssrStorage = createJSONStorage(() => {
  if (typeof window === 'undefined' || !window.localStorage) return noopStorage
  return createLocalStorageTransport()
})

export function createPersistConfig<T>(
  name: string,
  partialize?: (state: T) => Partial<T>,
  /** 默认与改造前逐字同值；仅桌面端加密通道需要换掉它（见 lib/chat-persist-crypto.ts） */
  storage: PersistStorage<Partial<T>> = ssrStorage as PersistStorage<Partial<T>>,
  /**
   * rehydrate 完成(或失败)后的回调(2026-11-12 加)。
   *
   * 立因:auth store 的双实例问题实测——盘上快照已经是
   * `{"isAuthenticated":true,"user":{"roleId":1}}`,但内存态停在初始的 false/null,
   * admin/layout 读内存 ⇒ 真管理员被弹 /sso/login。
   * 需要这个钩子在 rehydrate 落定后做一次内存态校正。
   * 其余 store 不传即为 undefined,行为与改造前逐字一致。
   */
  onRehydrateStorage?: () => (state: T | undefined, error: unknown) => void,
  /**
   * 反序列化后的合并钩子(2026-11-15 v4 加)。
   *
   * 立因:外观预设是"多条目用户数据",盘上可能有旧版本/被手改/半写入的坏条目,
   * 需要在进入内存态之前逐条校验 —— 这是 zustand persist 的 merge 唯一能拦住的位置
   * (partialize 只作用于写,不作用于读)。不传即默认浅合并,与改造前一致。
   */
  merge?: (persistedState: unknown, currentState: T) => T,
  /**
   * 跳过自动 rehydrate（2026-11-22 加）。
   *
   * auth store 的异步 hydrate 会晚于 `/auth/refresh` 落定，把刚写入的 token 覆盖成 null。
   * 由 bootstrap 显式 `await persist.rehydrate()` 排在刷新之前，才能保证顺序。
   */
  skipHydration?: boolean,
) {
  return {
    name,
    storage,
    ...(partialize ? { partialize } : {}),
    ...(onRehydrateStorage ? { onRehydrateStorage } : {}),
    ...(merge ? { merge } : {}),
    ...(skipHydration ? { skipHydration: true } : {}),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
