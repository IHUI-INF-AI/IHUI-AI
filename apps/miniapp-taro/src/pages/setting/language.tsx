import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { setLanguage } from '@/api'
import { useI18n, type Locale } from '@/i18n'

const LANGS: Array<{ value: Locale; key: 'zhCN' | 'en' | 'ja' | 'ko' | 'zhTW' }> = [
  { value: 'zh-CN', key: 'zhCN' },
  { value: 'en', key: 'en' },
  { value: 'ja', key: 'ja' },
  { value: 'ko', key: 'ko' },
  { value: 'zh-TW', key: 'zhTW' },
]

export default function LanguagePage() {
  const { t, locale, setLocale } = useI18n()
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
        Taro.showToast({ title: t('setting.setSuccess'), icon: 'success' })
      } catch (e) {
        logger.error('setting/language', 'set language', e)
        Taro.showToast({ title: t('common.failed'), icon: 'none' })
      }
    },
    [current, setLocale, t],
  )

  return (
    <View className="min-h-screen bg-background">
      <View className="mx-[12px] my-[12px] bg-card rounded-[8px] overflow-hidden">
        {LANGS.map((l, idx) => (
          <View
            key={l.value}
            className={`flex items-center justify-between px-[16px] py-[16px] ${
              idx < LANGS.length - 1 ? 'border-b border-[#f0f0f0]' : ''
            }`}
            onClick={() => onSelect(l.value)}
          >
            <Text className="text-[15px] text-foreground">{t(`setting.${l.key}`)}</Text>
            {current === l.value && <Text className="text-[16px] text-primary">✓</Text>}
          </View>
        ))}
      </View>
    </View>
  )
}
