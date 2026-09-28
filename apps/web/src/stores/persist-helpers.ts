// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { createJSONStorage, type PersistStorage } from 'zustand/middleware'

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

export const ssrStorage = createJSONStorage(() =>
  typeof window !== 'undefined' ? window.localStorage : noopStorage,
)

export function createPersistConfig<T>(
  name: string,
  partialize?: (state: T) => Partial<T>,
  /** 默认与改造前逐字同值；仅桌面端加密通道需要换掉它（见 lib/chat-persist-crypto.ts） */
  storage: PersistStorage<Partial<T>> = ssrStorage as PersistStorage<Partial<T>>,
) {
  return {
    name,
    storage,
    ...(partialize ? { partialize } : {}),
  }
}
