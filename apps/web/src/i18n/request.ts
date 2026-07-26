import { getRequestConfig } from 'next-intl/server'
import type { AbstractIntlMessages } from 'next-intl'
import { mergeMessages } from '@ihui/i18n/loader'
import type { Messages } from '@ihui/i18n/types'
// 2026-07-25 i18n 单一来源:翻译文件迁移到 @ihui/i18n/messages/{shared,web}/
// 阶段 2:用 mergeMessages 合并 shared + web(端 key 覆盖 shared,功能无变化)
// shared = 跨端共享 key;web = 端独有 key + 端覆盖 shared 的 key(阶段 3 才删除 web 内 shared key)
// 静态 import 替代动态 import(静态导出模式下 bundle 体积无差异,且避免 webpack 模板字符串解析问题)
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

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

const messages = {
  'zh-CN': mergeMessages(sharedZhCN as Messages, webZhCN as Messages),
  en: mergeMessages(sharedEn as Messages, webEn as Messages),
  ja: mergeMessages(sharedJa as Messages, webJa as Messages),
  ko: mergeMessages(sharedKo as Messages, webKo as Messages),
  'zh-TW': mergeMessages(sharedZhTW as Messages, webZhTW as Messages),
  // next-intl AbstractIntlMessages 类型不接受数组(string[]),但运行时支持;
  // 用 as unknown as 双重断言绕过类型限制(数组在 next-intl 运行时合法)
} as unknown as Record<string, AbstractIntlMessages>

export default getRequestConfig(async () => {
  // A 套壳方案:output:export 不支持 cookies() 动态服务端 API
  // 构建时用默认 locale(zh-CN),客户端 locale 切换通过 NextIntlClientProvider 动态 messages 加载
  // 原 cookies() locale 读取见 commit ce1f12795
  void LOCALES
  const locale = 'zh-CN'
  return {
    locale,
    // next-intl AbstractIntlMessages 类型不接受数组(string[]),但运行时支持;用 as never 绕过类型限制
    messages: (messages[locale] ?? webZhCN) as never,
  }
})
