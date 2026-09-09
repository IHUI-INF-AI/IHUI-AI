// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn, type Locale } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { setLanguage } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

type LangItem = {
  value: Locale
  key: 'zhCN' | 'en' | 'ja' | 'ko' | 'zhTW'
  native: string
  english: string
}

const LANGS = (tt: TtFn): LangItem[] => [
  {
    value: 'zh-CN',
    key: 'zhCN',
    native: tt('legal.supportedRegions.languageZhCN', '简体中文'),
    english: 'Simplified Chinese',
  },
  {
    value: 'zh-TW',
    key: 'zhTW',
    native: tt('settingLanguage.d1', '繁體中文'),
    english: 'Traditional Chinese',
  },
  { value: 'en', key: 'en', native: 'English', english: 'English' },
  { value: 'ko', key: 'ko', native: '한국어', english: 'Korean' },
  { value: 'ja', key: 'ja', native: tt('settingLanguage.d2', '日本語'), english: 'Japanese' },
]

const LANG_KEY: Record<string, string> = {
  zhCN: 'setting.zhCN',
  zhTW: 'setting.zhTW',
  en: 'setting.en',
  ko: 'setting.ko',
  ja: 'setting.ja',
}

export default function LanguagePage() {
  const { t, locale, setLocale } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [current, setCurrent] = useState<Locale>(locale)

  useEffect(() => {}, [t])

  useDidShow(() => {
    setCurrent(locale)
  })

  const onSelect = useCallback(
    async (v: Locale) => {
      if (v === current) return
      setCurrent(v)
      setLocale(v)
      try {
        await setLanguage(v)
        Taro.showToast({ title: tt('setting.setSuccess', '设置成功'), icon: 'success' })
      } catch (e) {
        logger.error('setting/language', 'set language', e)
        Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
      }
    },
    [current, setLocale, tt],
  )

  return (
    <ThemeRoot>
      {/* 根容器背景对齐 RN SettingsScreen container(pageBg=surface.bg → --color-background);
          上下留白对齐 body paddingTop 12dp→24rpx / paddingBottom 24dp→48rpx */}
      <View className="min-h-screen bg-background pt-[24rpx] pb-[48rpx]">
        {/* 语言选择对齐 RN SettingsScreen 语言 Section:
            标题对齐 sectionTitle 14dp→28rpx(text.secondary)+ 距卡片 gap 8dp→16rpx;
            列表对齐 sectionCard:圆角 8dp→16rpx + divider(border.light)底 + 行间 2rpx;
            行对齐 plainRow:minHeight 60dp→120rpx / py 14dp→28rpx / px 12dp→24rpx,
            卡面亮色 surface.light→--color-card、暗色 surface.muted→--color-muted(dark:bg-muted) */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="mb-[16rpx] block text-[28rpx] text-muted-foreground">
            {tt('setting.language.chooseHint', '选择应用语言')}
          </Text>
          <View className="flex flex-col gap-[2rpx] overflow-hidden rounded-[16rpx] bg-[color:var(--color-border)]">
            {LANGS(tt).map((l) => (
              <View
                key={l.value}
                className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
                onClick={() => onSelect(l.value)}
                hoverClass="opacity-60">
                <View className="min-w-0 flex-1">
                  {/* rowLabel 对齐 RN: 16dp→32rpx + text.medium 语义映射 muted-foreground */}
                  <Text className="text-[32rpx] text-muted-foreground">
                    {tt(LANG_KEY[l.key] ?? 'setting.zhCN', l.native)}
                  </Text>
                  {/* 副行(英文名)为小程序端补充信息:24rpx + text.tertiary + userMeta gap 2dp→4rpx */}
                  <Text className="mt-[4rpx] block text-[24rpx] text-[color:var(--color-text-tertiary)]">
                    {l.english}
                  </Text>
                </View>
                {/* 选中态对齐 RN SelectRow checkMark: 16dp→32rpx bold + brandAccent→--color-brand-orange;
                    当前语言由选中行呈现,不再渲染 RN 没有的"当前语言"卡片 */}
                {current === l.value ? (
                  <Text className="text-[32rpx] font-bold text-[color:var(--color-brand-orange)]">
                    ✓
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        {/* 底部说明对齐 RN versionText: 12dp→24rpx + text.tertiary;marginTop 4dp→8rpx */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="block text-center text-[24rpx] leading-[1.6] text-[color:var(--color-text-tertiary)]">
            {tt('setting.language.tip', '切换语言后将自动保存并生效')}
          </Text>
          <Text className="mt-[8rpx] block text-center text-[24rpx] leading-[1.6] text-[color:var(--color-text-tertiary)]">
            {tt('setting.language.note', '部分内容可能仍以原文显示,我们正在持续完善多语言支持。')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
