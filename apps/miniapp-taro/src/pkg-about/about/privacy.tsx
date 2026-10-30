// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 镜像 packages/app/src/features/privacy/PrivacyScreen.tsx

// 对齐目标(RN 共享屏): packages/app/src/features/privacy/PrivacyScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback } from 'react'
import ThemeRoot from '@/components/ThemeRoot'
import { buildOverviewParagraphs } from './privacyOverview'
import { buildSectionsA } from './privacySectionsA'
import { buildSectionsB } from './privacySectionsB'

export default function PrivacyPage() {
  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: tt('about.privacy.title', '隐私政策') })
  })
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const overviewParagraphs = buildOverviewParagraphs(tt)
  const sections = [...buildSectionsA(tt), ...buildSectionsB(tt)]

  // 要点摘要:与共享屏 PrivacyScreen(LegalDocScreen)的 sections 三组 {title, body} 逐一对齐。
  const highlightSections = [
    {
      title: tt('privacy.sectionData', '数据收集'),
      body: tt(
        'privacy.sectionDataBody',
        '我们收集您在使用本平台过程中主动提供的信息,包括账号信息、学习记录、互动内容等,用于为您提供个性化服务和改进产品体验。',
      ),
    },
    {
      title: tt('privacy.sectionCookie', 'Cookie 使用'),
      body: tt(
        'privacy.sectionCookieBody',
        '我们使用 Cookie 来记住您的偏好和登录状态,以提供更好的浏览体验。您可以在浏览器设置中禁用 Cookie,但部分功能可能无法正常使用。',
      ),
    },
    {
      title: tt('privacy.sectionThirdParty', '第三方共享'),
      body: tt(
        'privacy.sectionThirdPartyBody',
        '我们不会出售您的个人信息。在法律要求或为您提供服务所必需的情况下,我们可能与可信合作伙伴共享必要的信息,但我们会确保其遵守同等严格的数据保护标准。',
      ),
    },
  ]

  return (
    <ThemeRoot>
      <ScrollView className="h-screen bg-background" scrollY>
        <View className="px-[28rpx] pt-[28rpx] pb-[64rpx]">
          <View className="bg-card rounded-lg border border-border p-[28rpx] mb-[24rpx]">
            <Text className="block text-[length:32rpx] font-semibold text-foreground mb-[8rpx]">
              {tt('about.privacy.mainTitle', '隐私政策')}
            </Text>
            {/* 副标题(对齐 RN LegalDocScreen subtitle:标题下方一句政策基调) */}
            <Text className="block text-[length:26rpx] text-[var(--color-text-medium)] mb-[16rpx]">
              {tt('privacy.subtitle', '我们重视您的隐私')}
            </Text>
            <Text className="block text-[length:22rpx] text-[var(--color-text-tertiary)] mb-[8rpx]">
              {tt('about.privacy.updateDate', '更新日期: 2025年06月21日')}
            </Text>
            <Text className="block text-[length:22rpx] text-[var(--color-text-tertiary)]">
              {tt('about.privacy.effectiveDate', '生效日期: 2025年06月21日')}
            </Text>
            {overviewParagraphs.map((p, idx) => (
              <View key={idx} className="mt-[16rpx]">
                {p.title ? (
                  <Text className="block text-[length:28rpx] font-semibold text-foreground mb-[8rpx]">
                    {p.title}
                  </Text>
                ) : null}
                <Text className="block text-[length:28rpx] text-[var(--color-text-medium)] leading-[36rpx] text-justify">
                  {p.text}
                </Text>
              </View>
            ))}
          </View>

          <View className="bg-card rounded-lg border border-border p-[28rpx] mb-[24rpx]">
            {highlightSections.map((h, hIdx) => (
              <View key={hIdx} className={hIdx === 0 ? '' : 'mt-[16rpx]'}>
                <Text className="block text-[length:28rpx] font-semibold text-foreground mb-[8rpx]">
                  {h.title}
                </Text>
                <Text className="block text-[length:28rpx] text-[var(--color-text-medium)] leading-[36rpx] text-justify">
                  {h.body}
                </Text>
              </View>
            ))}
          </View>

          {sections.map((section, sIdx) => (
            <View
              key={sIdx}
              className="bg-card rounded-lg border border-border p-[28rpx] mb-[24rpx]"
            >
              <Text className="block text-[length:32rpx] font-semibold text-foreground mb-[8rpx]">
                {section.subtitle}
              </Text>
              {section.paragraphs.map((p, pIdx) => (
                <View key={pIdx} className="mt-[16rpx]">
                  {p.title ? (
                    <Text className="block text-[length:28rpx] font-semibold text-foreground mb-[8rpx]">
                      {p.title}
                    </Text>
                  ) : null}
                  <Text className="block text-[length:28rpx] text-[var(--color-text-medium)] leading-[36rpx] text-justify">
                    {p.text}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
