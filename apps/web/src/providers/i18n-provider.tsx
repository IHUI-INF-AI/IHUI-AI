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
 * 初始 locale='zh-CN' 与服务端 getLocale() 返回值一致,首屏无 mismatch。
 * 客户端挂载后若 localStorage 持久化了其他 locale,会立即切换(可接受的短暂闪烁)。
 */

import { NextIntlClientProvider } from 'next-intl'
import type { AbstractIntlMessages } from 'next-intl'
import { useEffect } from 'react'
import { mergeMessages } from '@ihui/i18n/loader'
import type { Messages } from '@ihui/i18n/types'
import { useLanguageStore } from '@/stores/language'

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

  const messages = MESSAGES_MAP[locale] ?? MESSAGES_MAP['zh-CN']

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}

export default I18nProvider
