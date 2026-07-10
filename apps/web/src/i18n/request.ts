import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookie = cookieStore.get('locale')?.value
  const locale = cookie && LOCALES.includes(cookie) ? cookie : 'zh-CN'
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
