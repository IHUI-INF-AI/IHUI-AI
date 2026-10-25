// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { LOCALE_STORAGE_KEY } from '@ihui/shared/constants'
import { mergeMessages, translate, getValueByPath } from '@ihui/i18n/loader'
import { DEFAULT_LOCALE, type Locale, type Messages } from '@ihui/i18n/types'
import { createAsyncStorageTransport } from '../stores/storage-adapter'
// shared 通用 + mobile-rn 端 override,mergeMessages 深合并修复浅 spread bug
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import sharedEn from '@ihui/i18n/messages/shared/en.json'
import sharedJa from '@ihui/i18n/messages/shared/ja.json'
import sharedKo from '@ihui/i18n/messages/shared/ko.json'
import sharedZhTW from '@ihui/i18n/messages/shared/zh-TW.json'
import zhCN from '@ihui/i18n/messages/mobile-rn/zh-CN.json'
import en from '@ihui/i18n/messages/mobile-rn/en.json'
import ja from '@ihui/i18n/messages/mobile-rn/ja.json'
import ko from '@ihui/i18n/messages/mobile-rn/ko.json'
import zhTW from '@ihui/i18n/messages/mobile-rn/zh-TW.json'
export type { Locale }

const STORAGE_KEY_LEGACY = 'ihui_locale'

// 单例 transport(零运行时开销,AsyncStorage 静态绑定)
const transport = createAsyncStorageTransport()

// ja/ko/zh-TW 保留 zhCN 兜底深合并(原浅 spread 升级为深合并,修复嵌套 namespace 翻译丢失)
const messages: Record<Locale, Messages> = {
  'zh-CN': mergeMessages(sharedZhCN as Messages, zhCN as Messages),
  en: mergeMessages(sharedEn as Messages, en as Messages),
  ja: mergeMessages(sharedJa as Messages, mergeMessages(zhCN as Messages, ja as Messages)),
  ko: mergeMessages(sharedKo as Messages, mergeMessages(zhCN as Messages, ko as Messages)),
  'zh-TW': mergeMessages(sharedZhTW as Messages, mergeMessages(zhCN as Messages, zhTW as Messages)),
}

export { messages, getValueByPath }

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => Promise<void>
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

/**
 * 组件树外的 locale 切换入口(2026-09-21 立,供 AI 操控桥调用)。
 *
 * 不能只写 storage:那要等下一次挂载才读得到,当前界面纹丝不动 —— 对调用方就是"报成功但
 * 用户什么都没看见"的假成功。真生效必须走 Provider 里那个会 setState 的 setLocale,而它在
 * React 内部,所以由 Provider 挂载时注册进来、卸载时摘掉;拿不到 setter 时调用方须如实失败。
 */
let localeSetter: ((locale: Locale) => void) | null = null

export function registerLocaleSetter(setter: ((locale: Locale) => void) | null): void {
  localeSetter = setter
}

/** 返回 false = 没有挂载中的 I18nProvider(冷启竞态 / 未挂 Provider)。 */
export function requestLocaleChange(locale: Locale): boolean {
  if (!localeSetter) return false
  localeSetter(locale)
  return true
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    void (async () => {
      // 迁移旧下划线 key 到新连字符 key
      const legacyValue = await transport.getItem(STORAGE_KEY_LEGACY)
      if (legacyValue !== null) {
        const newValue = await transport.getItem(LOCALE_STORAGE_KEY)
        if (newValue === null) {
          await transport.setItem(LOCALE_STORAGE_KEY, legacyValue)
        }
        await transport.removeItem(STORAGE_KEY_LEGACY)
      }
      const stored = await transport.getItem(LOCALE_STORAGE_KEY)
      if (stored && stored in messages) {
        setLocaleState(stored as Locale)
      }
    })()
  }, [])

  // 2026-10-25 定身:以下三个身份都必须只在「真正会变的东西」变化时才换新。
  // 母型缺陷原形:setLocale / t 是渲染期新建的箭头函数,value 又是渲染期新建的字面量,
  // 于是 Provider 每渲染一次整个 context 就换一次身份 —— 任何把 `t` 写进 effect 依赖的
  // 真实页面都会跟着重跑(实测形状 = 钱包页 [load] 重跑、getBalance 被真调第二次)。
  // 依赖数组里只放会改变行为的量:transport/messages 是模块级,setLocaleState 是 useState
  // 自带的稳定 setter,都不进依赖;t 唯一会变的原因是 locale。回归锁见
  // tests/i18n-provider-value-identity.test.tsx(改前后红绿成对钉死)。
  const setLocale = useCallback(async (next: Locale): Promise<void> => {
    await transport.setItem(LOCALE_STORAGE_KEY, next)
    setLocaleState(next)
  }, [])

  // 组件树外的 locale 切换入口按稳定身份注册(成因见 registerLocaleSetter 的头注);
  // setLocale 自身已稳定,不再需要 useRef 兜一层。
  useEffect(() => {
    registerLocaleSetter(setLocale)
    return () => registerLocaleSetter(null)
  }, [setLocale])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const resolvedKey = key === 'course.pay' ? 'courseDetail.pay' : key
      return translate(messages[locale], resolvedKey, {
        fallback: messages[DEFAULT_LOCALE],
        params,
      })
    },
    [locale],
  )

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
