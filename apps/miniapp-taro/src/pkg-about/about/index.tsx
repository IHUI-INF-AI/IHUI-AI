// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/about/AboutScreen.tsx
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getAbout } from '@/api'
import LineIcon, { type IconName } from '@/components/LineIcon'
import ThemeRoot from '@/components/ThemeRoot'
import { navigateToWebView } from '@/pages/webview/index'
import { WEB_BASE_URL } from '@/constants/web-portal'
import {
  ABOUT_MENUS,
  ABOUT_PLATFORMS,
  ABOUT_STATS,
  ABOUT_VALUES,
  type AboutFeature,
} from './aboutSections'

/**
 * 小程序端「关于我们」—— 段落顺序与取词照 RN `AboutScreen.tsx`(其上游为 web AboutContent):
 * Hero → 我们的故事 → 4 项价值观 → 6 项平台能力 → 数字见证 → CTA → 合规/帮助入口。
 * 分段数据在 ./aboutSections.ts(为把本页压在 §3 的 250 行上限内)。
 *
 * CTA 落点取本端真实在册出口:注册 → /pages/register/index(app.config.ts 分包在册页);
 * 开放平台 /developer 与本端其他 web 承载页同形,经 pages/webview 承载页打开,不留空按钮。
 * 合规/帮助入口沿用本端既有实装路由与 about.* 取词,改版不删入口。
 */

interface AboutInfo {
  name: string
  version: string
  intro: string
  logo?: string
}

function Chip({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View className="inline-flex items-center gap-[10rpx] px-[20rpx] py-[8rpx] rounded-md bg-brand-accent-light self-start">
      <LineIcon name={icon} size={24} color="var(--color-brand-accent-deep)" />
      <Text className="text-[length:22rpx] font-medium text-brand-accent-deep">{label}</Text>
    </View>
  )
}

function FeatureCard({ feature, title, desc }: { feature: AboutFeature; title: string; desc: string }) {
  return (
    <View className="w-[calc(50%-10rpx)] bg-card rounded-lg p-[24rpx] space-y-[16rpx]">
      <View className="flex items-center gap-[16rpx]">
        <View className="w-[64rpx] h-[64rpx] flex items-center justify-center rounded-lg bg-brand-accent-light">
          <LineIcon name={feature.icon} size={36} color="var(--color-brand-accent-deep)" />
        </View>
        <Text className="flex-1 text-[length:30rpx] font-semibold text-foreground">{title}</Text>
      </View>
      <Text className="block text-[length:24rpx] leading-[38rpx] text-muted-foreground">{desc}</Text>
    </View>
  )
}

export default function AboutIndexPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<AboutInfo>({ name: '', version: '', intro: '' })

  const load = useCallback(async () => {
    try {
      setInfo(await getAbout())
    } catch (e) {
      logger.error('about/index', '获取关于信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

  const goBack = useCallback(() => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/user/index' }) })
  }, [])

  const goRegister = useCallback(() => {
    Taro.navigateTo({ url: '/pages/register/index' })
  }, [])

  const openDeveloper = useCallback(() => {
    navigateToWebView(`${WEB_BASE_URL}/developer`, t('about.ctaSecondary'))
  }, [t])

  useDidShow(() => load())

  return (
    <ThemeRoot>
      {/* 对齐 RN AboutScreen container:bg surface.bg;custom 导航补状态栏 safe-area */}
      <View className="min-h-screen bg-background pt-[calc(env(safe-area-inset-top)+8rpx)]">
        {/* 顶部导航(返回键为页面栈空时回退到「我的」) */}
        <View className="flex items-center gap-[8rpx] px-[20rpx] py-[24rpx]">
          {/* hitSlop 8dp → p 16rpx + 负 margin 抵消,扩大点击区不改视觉间距 */}
          <View className="p-[16rpx] -m-[16rpx]" onClick={goBack} hoverClass="opacity-60">
            <LineIcon name="chevron-left" size={40} color="var(--color-foreground)" />
          </View>
          <Text className="text-[length:40rpx] font-bold text-foreground">{t('setting.aboutUs')}</Text>
        </View>

        <View className="p-[24rpx] pb-[64rpx] space-y-[24rpx]">
          {/* Hero(对齐 RN styles.hero) */}
          <View className="flex flex-col items-center gap-[16rpx] pt-[16rpx]">
            <Chip icon="sparkles" label={t('about.heroBadge')} />
            <Text className="block text-center text-[length:56rpx] font-bold text-foreground">
              {t('about.heroTitle')}
            </Text>
            <Text className="block text-center text-[length:26rpx] leading-[40rpx] text-muted-foreground">
              {t('about.heroSubtitle')}
            </Text>
            {info.version ? (
              <Text className="text-[length:22rpx] text-muted-foreground">
                {t('about.version', { version: info.version })}
              </Text>
            ) : null}
          </View>

          {/* 我们的故事 */}
          <View className="bg-card rounded-lg p-[24rpx] space-y-[16rpx]">
            <Chip icon="book-open" label={t('about.storyBadge')} />
            <Text className="block text-[length:36rpx] font-bold text-foreground">
              {t('about.storyTitle')}
            </Text>
            <Text className="block text-[length:26rpx] leading-[40rpx] text-muted-foreground">
              {t('about.storyP1')}
            </Text>
            <Text className="block text-[length:26rpx] leading-[40rpx] text-muted-foreground">
              {t('about.storyP2')}
            </Text>
          </View>

          {/* 4 项价值观 */}
          <View className="flex flex-wrap gap-[20rpx]">
            {ABOUT_VALUES.map((f) => (
              <FeatureCard key={f.titleKey} feature={f} title={t(f.titleKey)} desc={t(f.descKey)} />
            ))}
          </View>

          {/* 6 项平台能力 */}
          <View className="space-y-[24rpx]">
            <Text className="block text-[length:36rpx] font-bold text-foreground">
              {t('about.platformTitle')}
            </Text>
            <View className="flex flex-wrap gap-[20rpx]">
              {ABOUT_PLATFORMS.map((f) => (
                <FeatureCard
                  key={f.titleKey}
                  feature={f}
                  title={t(f.titleKey)}
                  desc={t(f.descKey)}
                />
              ))}
            </View>
          </View>

          {/* 数字见证 */}
          <View className="bg-card rounded-lg p-[24rpx] space-y-[24rpx]">
            <Text className="block text-center text-[length:36rpx] font-bold text-foreground">
              {t('about.numbersTitle')}
            </Text>
            <View className="flex flex-wrap gap-[20rpx]">
              {ABOUT_STATS.map((s) => (
                <View
                  key={s.valueKey}
                  className="flex-1 basis-[44%] flex flex-col items-center gap-[8rpx]"
                >
                  <Text className="text-[length:48rpx] font-bold text-brand-accent-deep">
                    {t(s.valueKey)}
                  </Text>
                  <Text className="text-center text-[length:26rpx] leading-[40rpx] text-muted-foreground">
                    {t(s.descKey)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* CTA(主按钮走 --color-cta / --color-cta-foreground 同源档) */}
          <View className="bg-card rounded-lg p-[24rpx] pt-[36rpx] pb-[36rpx] flex flex-col items-center gap-[16rpx]">
            <LineIcon name="rocket" size={60} color="var(--color-brand-accent-deep)" />
            <Text className="block text-center text-[length:36rpx] font-bold text-foreground">
              {t('about.ctaTitle')}
            </Text>
            <Text className="block text-center text-[length:26rpx] leading-[40rpx] text-muted-foreground">
              {t('about.ctaDesc')}
            </Text>
            <View
              className="self-stretch mt-[8rpx] bg-cta rounded-sm py-[22rpx] text-center"
              hoverClass="opacity-60"
              onClick={goRegister}
            >
              <Text className="text-[length:28rpx] font-semibold text-cta-foreground">
                {t('about.ctaPrimary')}
              </Text>
            </View>
            <View
              className="self-stretch border border-border rounded-sm py-[22rpx] text-center"
              hoverClass="opacity-60"
              onClick={openDeveloper}
            >
              <Text className="text-[length:28rpx] font-semibold text-foreground">
                {t('about.ctaSecondary')}
              </Text>
            </View>
          </View>

          {/* 合规/帮助入口(本端实装页,改版不删;无边框分隔,行距即分隔) */}
          <View className="space-y-[16rpx]">
            <Text className="block text-[length:36rpx] font-bold text-foreground">
              {t('about.complianceTitle')}
            </Text>
            <View className="bg-card rounded-lg p-[24rpx] space-y-[28rpx]">
              {ABOUT_MENUS.map((m) => (
                <View
                  key={m.key}
                  className="flex items-center justify-between"
                  onClick={() => Taro.navigateTo({ url: m.url })}
                  hoverClass="opacity-60"
                >
                  <Text className="text-[length:30rpx] text-foreground flex-1">
                    {t(m.labelKey)}
                  </Text>
                  <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
                </View>
              ))}
            </View>
          </View>

          <View className="text-center pt-[16rpx]">
            <Text className="text-[length:22rpx] text-muted-foreground">{t('about.copyright')}</Text>
          </View>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
