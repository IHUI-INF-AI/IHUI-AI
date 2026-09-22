// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 客户端 I18n Provider(2026-07-27 立,修复语言切换功能失效)。
 *
 * 背景:
 * 原 layout.tsx 在服务端用 getLocale() 取 locale、getMessages() 取 messages,
 * 但 i18n/request.ts 在 output:export 模式下硬编码 locale='zh-CN',
 * 导致 NextIntlClientProvider 永远拿 zh-CN + 中文 messages,
 * sidebar 切换语言只更新 useLanguageStore,Provider 不响应 → 切换无效。
 *
 * 方案:
 * 用客户端组件包裹 NextIntlClientProvider,从 useLanguageStore 读 locale,
 * 静态导入所有 locale 的 messages(shared + web 合并),按当前 locale 传给 Provider。
 * store.locale 变化 → Provider 自动重新渲染 → 真正切换语言。
 *
 * Hydration 安全:
 * 服务端首帧的 `<html lang>` 取自 `locale` cookie(见 @/lib/locale-cookie + app/layout.tsx),
 * 而消息语言取自本 store;两者由 setLocale 一并写入 ⇒ 正常情况下同源。
 * 只有"cookie 与 localStorage 被人手工改得不一致"这类边缘态会短暂错配,
 * 由 layout 的 suppressHydrationWarning 兜住,并在本 Provider 挂载时把 store 真值镜像回 cookie 收敛。
 */

import { NextIntlClientProvider } from 'next-intl'
import type { AbstractIntlMessages } from 'next-intl'
import { useEffect } from 'react'
import { mergeMessages } from '@ihui/i18n/loader'
import type { Messages } from '@ihui/i18n/types'
import { useLanguageStore } from '@/stores/language'
import { writeLocaleCookie } from '@/lib/locale-cookie'
import { isTauri, setWindowTitle } from '@/lib/tauri-bridge'

// 静态 import 所有 locale 的 messages(shared + web),构建时打包,运行时 O(1) 查找
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import sharedEn from '@ihui/i18n/messages/shared/en.json'
import sharedJa from '@ihui/i18n/messages/shared/ja.json'
import sharedKo from '@ihui/i18n/messages/shared/ko.json'
import sharedZhTW from '@ihui/i18n/messages/shared/zh-TW.json'
import webZhCN from '@ihui/i18n/messages/web/zh-CN.json'
import webEn from '@ihui/i18n/messages/web/en.json'
import webJa from '@ihui/i18n/messages/web/ja.json'
import webKo from '@ihui/i18n/messages/web/ko.json'
import webZhTW from '@ihui/i18n/messages/web/zh-TW.json'

const MESSAGES_MAP: Record<string, AbstractIntlMessages> = {
  'zh-CN': mergeMessages(
    sharedZhCN as Messages,
    webZhCN as Messages,
  ) as unknown as AbstractIntlMessages,
  en: mergeMessages(sharedEn as Messages, webEn as Messages) as unknown as AbstractIntlMessages,
  ja: mergeMessages(sharedJa as Messages, webJa as Messages) as unknown as AbstractIntlMessages,
  ko: mergeMessages(sharedKo as Messages, webKo as Messages) as unknown as AbstractIntlMessages,
  'zh-TW': mergeMessages(
    sharedZhTW as Messages,
    webZhTW as Messages,
  ) as unknown as AbstractIntlMessages,
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useLanguageStore((s) => s.locale)
  const setInitialized = useLanguageStore((s) => s.setInitialized)

  // 标记初始化完成(供需要等待 i18n 就绪的客户端逻辑使用)
  useEffect(() => {
    setInitialized(true)
  }, [setInitialized])

  // 语言切换后同步 <html lang>:app/layout.tsx:219 服务端恒写 'zh-CN'(语言已改为客户端驱动),
  // 而 `document.documentElement.lang` 是 5+ 处取词口径的真值源(number-format.ts:23 与
  // ai-news 4 个组件都读它),不同步则英文界面仍按 zh-CN 格式化数字、AT 也读错语种。
  useEffect(() => {
    document.documentElement.lang = locale
    // 同步补写 cookie:用户清过 cookie 但留着 localStorage 偏好时,只改 DOM 会让下一次
    // SSR 又退回 zh-CN(闪烁一次)。每次挂载都把 store 真值镜像回去,SSR 与客户端才收敛。
    writeLocaleCookie(locale)
  }, [locale])

  // 2026-09-06 产品名本地化(用户决策:中文→智汇AI,其他→IHUI AI)。
  // 仅桌面端(Tauri)同步窗口标题与 document.title;web 端 SEO 标题由 Next metadata 管理,不动。
  // 启动时 Rust 端已按系统 UI 语言设置初始标题(lib.rs localized_app_name),
  // 此处响应应用内语言切换。__TAURI_INTERNALS__ 注入有 100-500ms 延迟,
  // 首次未就绪时由 Rust 端默认标题兜底,不重试(避免与页面标题更新竞争)。
  useEffect(() => {
    if (!isTauri()) return
    const brand = locale.startsWith('zh') ? '智汇AI' : 'IHUI AI'
    document.title = brand
    setWindowTitle(brand).catch(() => {})
  }, [locale])

  const messages = MESSAGES_MAP[locale] ?? MESSAGES_MAP['zh-CN']

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Shanghai">
      {children}
    </NextIntlClientProvider>
  )
}

// 2026-07-31 触发 Turbopack 重新编译(修复 publish.cancel/close JSON 缓存)
export default I18nProvider
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
