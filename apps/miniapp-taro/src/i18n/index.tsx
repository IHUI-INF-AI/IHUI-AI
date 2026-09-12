// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { mergeMessages, translate, resolveList } from '@ihui/i18n/loader'
import type { Locale, Messages } from '@ihui/i18n/types'
import { LOCALE_KEY } from '@/constants/storage'
// 2026-07-25 i18n 单一来源:翻译文件迁移到 @ihui/i18n/messages/{shared,miniapp-taro}/
// 2026-07-26 loader.getValueByPath 扩展为返回 unknown,resolveList 支持 fallback,
// 删除本地 mergeDict/resolveRaw,完全复用 @ihui/i18n/loader
// 2026-09-12 体积优化:非中文 4 语言包改为离线 gzip+base64 内联(见 generated/remote-locales.gen.ts),
// 运行时经 fflate 惰性解压,主包不再静态打包这 8 个 JSON(净省约 540KB),功能零损失。
import { gunzipSync, strFromU8 } from 'fflate'
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import miniappZhCN from '@ihui/i18n/messages/miniapp-taro/zh-CN.json'
import { REMOTE_LOCALE_B64, type RemoteLocale } from './generated/remote-locales.gen'

// 纯 JS base64 → Uint8Array 查表解码:小程序真机 JSCore 未必提供 atob,不依赖任何运行时 API
const B64_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_LOOKUP = new Uint8Array(256)
for (let i = 0; i < B64_TABLE.length; i++) B64_LOOKUP[B64_TABLE.charCodeAt(i)] = i

function b64ToBytes(b64: string): Uint8Array {
  const len = b64.length
  let pad = 0
  if (len > 0 && b64[len - 1] === '=') pad++
  if (len > 1 && b64[len - 2] === '=') pad++
  const out = new Uint8Array((len / 4) * 3 - pad)
  for (let i = 0, o = 0; i < len; i += 4) {
    const n =
      ((B64_LOOKUP[b64.charCodeAt(i)] ?? 0) << 18) |
      ((B64_LOOKUP[b64.charCodeAt(i + 1)] ?? 0) << 12) |
      ((B64_LOOKUP[b64.charCodeAt(i + 2)] ?? 0) << 6) |
      (B64_LOOKUP[b64.charCodeAt(i + 3)] ?? 0)
    if (o < out.length) out[o++] = (n >> 16) & 0xff
    if (o < out.length) out[o++] = (n >> 8) & 0xff
    if (o < out.length) out[o++] = n & 0xff
  }
  return out
}

export type { Locale }

interface I18nContextValue {
  locale: Locale
  t: (key: string, params?: Record<string, string | number>) => string
  tList: (key: string) => string[]
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'zh-CN',
  t: (key) => key,
  tList: () => [],
  setLocale: () => {},
})

// 各 locale 的合并 messages:shared 作 base,miniapp-taro 覆盖(端 key 优先)。
// zh-CN 仍静态打包(中文为默认语言,无体积大头);非中文 4 语言运行时惰性解压。
const zhCNMessages: Messages = mergeMessages(sharedZhCN as Messages, miniappZhCN as Messages)

// 非中文语言包惰性解压缓存:首次访问某 locale 时解压并缓存,后续复用同一引用
const remoteCache = new Map<Locale, Messages>()
export function getMessages(locale: Locale): Messages {
  if (locale === 'zh-CN') return zhCNMessages
  const hit = remoteCache.get(locale)
  if (hit) return hit
  const merged = JSON.parse(
    strFromU8(gunzipSync(b64ToBytes(REMOTE_LOCALE_B64[locale as RemoteLocale]))),
  ) as Messages
  remoteCache.set(locale, merged)
  return merged
}

const LOCALES: Locale[] = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

// 模块级当前 locale(供非组件代码使用,如 utils/platform 中的 Taro.showToast 提示文案)
// I18nProvider 挂载时从 storage 同步,setLocale 时同步更新
let currentLocale: Locale = 'zh-CN'

/**
 * 全局 t 函数(供非组件代码使用,如 utils/pay.ts、platform/pay.ts 等)
 * - 组件内优先用 useI18n() 获取响应式 t
 * - utils/platform 等非组件代码用本函数
 * - locale 切换由 I18nProvider 同步到 currentLocale
 */
export function t(key: string, params?: Record<string, string | number>): string {
  return translate(getMessages(currentLocale), key, { fallback: zhCNMessages, params })
}

/** 带回退的翻译函数类型(供模块级数据工厂函数注入,避免在数据常量里调用 hook) */
export type TtFn = (k: string, fb: string, params?: Record<string, string | number>) => string

/**
 * 原生 tabBar 文案本地化(app.json 的 text 为静态配置,不支持 i18n,
 * 通过 setTabBarItem 在运行时按当前 locale 覆盖;失败静默,如非 tab 页环境)
 */
const TAB_BAR_ITEMS: ReadonlyArray<{ index: number; key: string; fb: string }> = [
  { index: 0, key: 'tabBar.community', fb: '智汇社区' },
  { index: 1, key: 'tabBar.agent', fb: 'AI agent' },
  { index: 2, key: 'tabBar.square', fb: '广场' },
  { index: 3, key: 'tabBar.user', fb: '我的' },
  { index: 4, key: 'tabBar.share', fb: '分享星球' },
]

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = Taro.getStorageSync(LOCALE_KEY)
    currentLocale = LOCALES.includes(stored) ? (stored as Locale) : 'zh-CN'
    return currentLocale
  })

  const setLocale = useCallback((l: Locale) => {
    currentLocale = l
    setLocaleState(l)
    Taro.setStorageSync(LOCALE_KEY, l)
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translate(getMessages(locale), key, { fallback: zhCNMessages, params })
    },
    [locale],
  )

  const tList = useCallback(
    (key: string) => resolveList(getMessages(locale), key, zhCNMessages),
    [locale],
  )

  // locale 变化/初始化时同步原生 tabBar 文案
  useEffect(() => {
    for (const item of TAB_BAR_ITEMS) {
      const text = t(item.key)
      if (text === item.key) continue // 词典缺失时保留静态默认文案
      Taro.setTabBarItem({ index: item.index, text }).catch(() => {})
    }
  }, [locale, t])

  return (
    <I18nContext.Provider value={{ locale, t, tList, setLocale }}>{children}</I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

/**
 * 带回退的翻译 hook(替代各页面/组件内联的 tt 函数)
 *
 * - 若 key 存在翻译,返回翻译值(支持 {placeholder} 参数替换)
 * - 若 key 不存在,返回 fb 回退文案(支持 {placeholder} 参数替换)
 *
 * 用 useCallback 包装避免每次渲染重建,消除 react-hooks/exhaustive-deps 警告
 */
export function useTt() {
  const { t } = useI18n()
  return useCallback(
    (k: string, fb: string, params?: Record<string, string | number>) => {
      const v = params ? t(k, params) : t(k)
      if (v !== k) return v
      if (!params) return fb
      return fb.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
    },
    [t],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
