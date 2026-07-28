import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Language = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko'

interface LanguageState {
  locale: Language
  /** 是否已完成初始化（避免 hydration mismatch） */
  initialized: boolean
  setLocale: (locale: Language) => void
  setInitialized: (v: boolean) => void
}

/** 语言切换 Store，持久化语言偏好（与 next-intl 配合使用） */
export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      locale: 'zh-CN',
      initialized: false,

      setLocale: (locale) => set({ locale }),
      setInitialized: (initialized) => set({ initialized }),
    }),
    {
      name: 'ihui-language',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? window.localStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      ),
    },
  ),
)

// 暴露给 E2E 测试用(window.__IHUI_LANGUAGE_STORE__),仅在非生产环境挂载,
// 避免生产 bundle 多余的全局属性。E2E 通过 useLanguageStore.getState().setLocale()
// 直接更新 locale,无需 reload 等待 zustand persist rehydrate。
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  ;(window as unknown as { __IHUI_LANGUAGE_STORE__?: typeof useLanguageStore }).__IHUI_LANGUAGE_STORE__ =
    useLanguageStore
}
