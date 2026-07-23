import { getRequestConfig } from 'next-intl/server'

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

export default getRequestConfig(async () => {
  // A 套壳方案:output:export 不支持 cookies() 动态服务端 API
  // 构建时用默认 locale(zh-CN),客户端 locale 切换通过 NextIntlClientProvider 动态 messages 加载
  // 原 cookies() locale 读取见 commit ce1f12795
  void LOCALES
  const locale = 'zh-CN'
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
