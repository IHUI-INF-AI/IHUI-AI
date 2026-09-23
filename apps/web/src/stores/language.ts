// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  writeLocaleCookie,
  readLocaleCookie,
  isSupportedLocale,
  type LocaleCode,
} from '@/lib/locale-cookie'

/** 语言码集合以 @/lib/locale-cookie 为唯一定义处(SSR 侧要用同一份) */
export type Language = LocaleCode

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

      setLocale: (locale) => {
        set({ locale })
        // 偏好必须同时落到 cookie,否则 SSR 首帧 lang 永远是 zh-CN(见 @/lib/locale-cookie)
        writeLocaleCookie(locale)
      },
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

// 冷启动播种:本地没有持久化偏好、但 cookie 里有语言(用户清过 localStorage / 换过 profile,
// 而 cookie 是 SSR 唯一读得到的真值)时,以 cookie 为准。否则首帧服务端渲染 en、水合后 store
// 默认 zh-CN 会把语言翻回去,并把 cookie 覆写回 zh-CN ⇒ 偏好静默丢失。
// persist 用同步 localStorage,create 时已完成 rehydrate,此处 setState 不会被覆盖。
if (typeof window !== 'undefined' && window.localStorage.getItem('ihui-language') === null) {
  const seeded = readLocaleCookie()
  if (isSupportedLocale(seeded)) useLanguageStore.getState().setLocale(seeded)
}

// 暴露给 E2E 测试用(window.__IHUI_LANGUAGE_STORE__),仅在非生产环境挂载,
// 避免生产 bundle 多余的全局属性。E2E 通过 useLanguageStore.getState().setLocale()
// 直接更新 locale,无需 reload 等待 zustand persist rehydrate。
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  ;(
    window as unknown as { __IHUI_LANGUAGE_STORE__?: typeof useLanguageStore }
  ).__IHUI_LANGUAGE_STORE__ = useLanguageStore
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
