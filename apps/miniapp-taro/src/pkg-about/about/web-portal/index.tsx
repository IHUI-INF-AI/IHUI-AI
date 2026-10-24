// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 网页版功能门户(小程序端,2026-10-18 立,对等 RN WebPortalScreen)
 *
 * 覆盖移动端未原生实现的全部复杂功能域(91 条 / 13 组,数据源
 * @ihui/shared/constants/web-portal 单一真相源)。点击条目经
 * pages/webview 承载页在内置浏览器打开:
 * - 已登录: 先取一次性 sso_code,改走 <origin>/sso/mobile-auth 消费页,
 *   WebView 内即带 httpOnly auth_token cookie,无需二次登录
 *   (链路与 RN WebViewScreen 现网跑通版同形;redirectUri 同域压站内相对路径,
 *   绝对 URL 会被服务端 400 拒,见 toWebSsoRedirectUri 注释)
 * - 未登录 / 取码失败: 降级直开,由 web 端自行引导登录
 */
// 平台特有:依赖 Taro @tarojs/components + 本端 pages/webview 承载页,不适合共享。
// 条目清单的唯一真相源在 packages/shared/src/constants/web-portal.ts(经 @/constants/web-portal 绑底座),
// 端内不得再抄第二份清单。
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback } from 'react'
import { generateSsoCode } from '@ihui/api-client'
import { SSO_CLIENT_IDS } from '@ihui/shared/constants'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'
import { getToken } from '@/utils/auth'
import { navigateToWebView } from '@/pages/webview/index'
import {
  WEB_PORTAL_SECTIONS,
  buildWebUrl,
  buildWebSsoUrl,
  toSsoRedirectUri,
  type WebPortalEntry,
} from '@/constants/web-portal'

export default function WebPortalPage() {
  const { t } = useI18n()

  // 本地 fallback: t(key) 未命中时返回 fb,保证不裸 key 上屏(与 setting 页同模式)
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  useDidShow(() => {
    // 五语言词包齐备(packages/i18n/messages/miniapp-taro/*),不再挂端内中文兜底串:
    // 旧兜底 '网页版功能' 与词包的「Web 功能门户」已经漂开,留着等于第二份标题真相源。
    Taro.setNavigationBarTitle({ title: t('webViewPortal.title') })
  })

  const openEntry = useCallback(
    async (entry: WebPortalEntry) => {
      const url = buildWebUrl(entry)
      const label = tt(entry.titleKey, entry.fallbackLabel)
      // 未登录: 直开(web 端自行引导登录)
      if (!getToken()) {
        navigateToWebView(url, label)
        return
      }
      try {
        const res = await generateSsoCode(SSO_CLIENT_IDS.MINIAPP_TARO, toSsoRedirectUri(url))
        if (res.success) {
          navigateToWebView(buildWebSsoUrl(url, res.data.code), label)
        } else {
          navigateToWebView(url, label)
        }
      } catch (e) {
        logger.warn('web-portal', 'sso 取码失败,降级直开', String(e))
        navigateToWebView(url, label)
      }
    },
    [tt],
  )

  return (
    <ThemeRoot>
      {/* 根容器 / 分组 / 行视觉对齐 pages/setting(同一设计语言) */}
      <View className="min-h-screen bg-background pb-[48rpx] pt-[24rpx]">
        <View className="mx-[20rpx] mt-[8rpx] rounded-lg bg-muted p-[24rpx]">
          <Text className="text-[length:24rpx] text-muted-foreground">
            {t('webViewPortal.hint')}
          </Text>
        </View>

        {WEB_PORTAL_SECTIONS.map((section) => (
          <View key={section.titleKey} className="mx-[20rpx] mt-[32rpx]">
            <Text className="mb-[16rpx] block text-[length:28rpx] text-muted-foreground">
              {tt(section.titleKey, section.fallbackLabel)}
            </Text>
            <View className="flex flex-col gap-[2rpx] overflow-hidden rounded-lg bg-[color:var(--color-border)]">
              {section.entries.map((entry) => (
                <View
                  key={entry.key}
                  className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
                  onClick={() => void openEntry(entry)}
                  hoverClass="opacity-60"
                >
                  <Text className="text-[length:32rpx] text-muted-foreground">
                    {tt(entry.titleKey, entry.fallbackLabel)}
                  </Text>
                  <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ThemeRoot>
  )
}
