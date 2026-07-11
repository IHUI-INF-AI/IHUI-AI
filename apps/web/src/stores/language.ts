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
