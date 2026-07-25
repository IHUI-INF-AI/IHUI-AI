import { logger } from '@/utils/logger'
import { View, Text, RadioGroup, Radio } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { setLanguage } from '@/api'
import { useI18n, type Locale } from '@/i18n'

type LangItem = { value: Locale; key: 'zhCN' | 'en' | 'ja' | 'ko' | 'zhTW'; native: string; english: string }

const LANGS: LangItem[] = [
  { value: 'zh-CN', key: 'zhCN', native: '简体中文', english: 'Simplified Chinese' },
  { value: 'zh-TW', key: 'zhTW', native: '繁體中文', english: 'Traditional Chinese' },
  { value: 'en', key: 'en', native: 'English', english: 'English' },
  { value: 'ko', key: 'ko', native: '한국어', english: 'Korean' },
  { value: 'ja', key: 'ja', native: '日本語', english: 'Japanese' },
]

const LANG_KEY: Record<string, string> = {
  zhCN: 'setting.zhCN',
  zhTW: 'setting.zhTW',
  en: 'setting.en',
  ko: 'setting.ko',
  ja: 'setting.ja',
}

const DEFAULT_LANG: LangItem = { value: 'zh-CN', key: 'zhCN', native: '简体中文', english: 'Simplified Chinese' }

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

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: t('setting.languageTitle') })
  }, [t])

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

  const currentLang = LANGS.find((l) => l.value === current) ?? DEFAULT_LANG

  return (
    <View className="min-h-screen bg-background p-[24rpx] pb-[80rpx]">
      <View className="flex items-center p-[32rpx] bg-card rounded-[16rpx] gap-[24rpx]">
        <View className="w-[88rpx] h-[88rpx] rounded-[12rpx] bg-[rgba(0,242,255,0.1)] flex items-center justify-center flex-shrink-0">
          <Text className="text-[44rpx] leading-none">🌐</Text>
        </View>
        <View className="flex-1">
          <Text className="block text-[24rpx] text-muted-foreground">
            {tt('setting.language.currentLabel', '当前语言')}
          </Text>
          <Text className="block text-[32rpx] font-semibold text-foreground mt-[8rpx]">{tt(LANG_KEY[currentLang.key] ?? 'setting.zhCN', currentLang.native)}</Text>
          <Text className="block text-[22rpx] text-muted-foreground mt-[6rpx]">{currentLang.english} · {currentLang.value}</Text>
        </View>
      </View>

      <View className="pt-[32rpx] px-[8rpx] pb-[16rpx]">
        <Text className="text-[24rpx] text-muted-foreground">{tt('setting.language.chooseHint', '选择应用语言')}</Text>
      </View>

      <RadioGroup className="flex flex-col gap-[16rpx]" onChange={(e) => onSelect(e.detail.value as Locale)}>
        {LANGS.map((l) => (
          <View key={l.value} className={`flex items-center justify-between py-[28rpx] px-[32rpx] bg-card rounded-[16rpx] gap-[24rpx]${current === l.value ? ' bg-[rgba(0,242,255,0.08)]' : ''}`}>
            <View className="flex-1">
              <Text className="text-[30rpx] text-foreground">{tt(LANG_KEY[l.key] ?? 'setting.zhCN', l.native)}</Text>
              <Text className="block text-[22rpx] text-muted-foreground mt-[6rpx]">{l.english}</Text>
            </View>
            <Radio
              value={l.value}
              checked={current === l.value}
              color="var(--color-primary)"
              className="flex-shrink-0"
            />
          </View>
        ))}
      </RadioGroup>

      <View className="py-[32rpx] px-[8rpx]">
        <Text className="block text-[22rpx] text-muted-foreground leading-[1.6]">
          {tt('setting.language.tip', '切换语言后将自动保存并生效')}
        </Text>
        <Text className="block text-[22rpx] text-muted-foreground leading-[1.6] mt-[8rpx] opacity-80">
          {tt('setting.language.note', '部分内容可能仍以原文显示,我们正在持续完善多语言支持。')}
        </Text>
      </View>
    </View>
  )
}
