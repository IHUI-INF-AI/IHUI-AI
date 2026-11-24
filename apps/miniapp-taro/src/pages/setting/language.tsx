// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn, type Locale } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { setLanguage } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import { onToast } from '@/host/on-toast'
import { SettingsLanguageSection } from '@ihui/rn-app/features/settings/SettingsScreen'
import { useAppTheme } from '@/lib/theme'

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
  zhCN: 'legal.supportedRegions.languageZhCN',
  zhTW: 'legal.supportedRegions.languageZhTW',
  en: 'legal.supportedRegions.languageEN',
  ko: 'legal.supportedRegions.languageKO',
  ja: 'legal.supportedRegions.languageJA',
}

export default function LanguagePage() {
  const { t, locale, setLocale } = useI18n()
  const { resolved } = useAppTheme()
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
    async (v: string) => {
      if (v === current) return
      setCurrent(v as Locale)
      setLocale(v as Locale)
      try {
        await setLanguage(v)
        onToast(tt('setting.setSuccess', '设置成功'), { kind: 'success' })
      } catch (e) {
        logger.error('setting/language', 'set language', e)
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      }
    },
    [current, setLocale, tt],
  )

  // 行文案/副行英文名全由本页注入:共享分段只负责 section 形态(标题 + 卡片 + 行 + ✓)
  const items = LANGS(tt).map((l) => ({
    value: l.value,
    label: tt(LANG_KEY[l.key] ?? 'legal.supportedRegions.languageZhCN', l.native),
    description: l.english,
  }))

  return (
    <ThemeRoot>
      {/* 根容器背景对齐 RN SettingsScreen container(pageBg=surface.bg → --color-background);
          上下留白对齐 body paddingTop 12dp→24rpx / paddingBottom 24dp→48rpx */}
      <View className="min-h-screen bg-background pt-[24rpx] pb-[48rpx]">
        {/* 语言分段(标题 + 5 行 + ✓)已抽成共享件:
            packages/app/src/features/settings/SettingsScreen.tsx 的 SettingsLanguageSection,
            RN 大设置页与本页同一段;本页只保留小程序端的副行英文名与底部说明 */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <SettingsLanguageSection
            title={tt('setting.language.chooseHint', '选择应用语言')}
            items={items}
            selected={current}
            onSelect={onSelect}
            colorScheme={resolved}
          />
        </View>

        {/* 底部说明对齐 RN versionText: 12dp→24rpx + text.tertiary;marginTop 4dp→8rpx */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="block text-center text-label leading-[1.6] text-[color:var(--color-text-tertiary)]">
            {tt('setting.language.tip', '切换语言后将自动保存并生效')}
          </Text>
          <Text className="mt-[8rpx] block text-center text-label leading-[1.6] text-[color:var(--color-text-tertiary)]">
            {tt('setting.language.note', '部分内容可能仍以原文显示,我们正在持续完善多语言支持。')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
