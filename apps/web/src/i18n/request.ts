import { getRequestConfig } from 'next-intl/server'
import type { AbstractIntlMessages } from 'next-intl'
// 2026-07-25 i18n 单一来源:翻译文件迁移到 @ihui/i18n/messages/web/
// 静态 import 替代动态 import(静态导出模式下 bundle 体积无差异,且避免 webpack 模板字符串解析问题)
import zhCN from '@ihui/i18n/messages/web/zh-CN.json'
import en from '@ihui/i18n/messages/web/en.json'
import ja from '@ihui/i18n/messages/web/ja.json'
import ko from '@ihui/i18n/messages/web/ko.json'
import zhTW from '@ihui/i18n/messages/web/zh-TW.json'

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

const messages = {
  'zh-CN': zhCN,
  en,
  ja,
  ko,
  'zh-TW': zhTW,
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
    messages: (messages[locale] ?? zhCN) as never,
  }
})
