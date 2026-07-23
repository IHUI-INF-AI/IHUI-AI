import { logger } from '@/utils/logger'
import { View, Text, RadioGroup, Radio } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { setLanguage } from '@/api'
import { useI18n, type Locale } from '@/i18n'
import './language.css'

type LangItem = { value: Locale; key: 'zhCN' | 'en' | 'ja' | 'ko' | 'zhTW'; native: string; english: string }

const LANGS: LangItem[] = [
  { value: 'zh-CN', key: 'zhCN', native: '简体中文', english: 'Simplified Chinese' },
  { value: 'zh-TW', key: 'zhTW', native: '繁體中文', english: 'Traditional Chinese' },
  { value: 'en', key: 'en', native: 'English', english: 'English' },
  { value: 'ko', key: 'ko', native: '한국어', english: 'Korean' },
  { value: 'ja', key: 'ja', native: '日本語', english: 'Japanese' },
]

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
    <View className="lang-page">
      <View className="lang-current">
        <View className="lang-current-icon">
          <Text className="lang-current-globe">🌐</Text>
        </View>
        <View className="lang-current-info">
          <Text className="lang-current-label">
            {tt('setting.language.currentLabel', '当前语言')}
          </Text>
          <Text className="lang-current-name">{tt(`setting.${currentLang.key}`, currentLang.native)}</Text>
          <Text className="lang-current-sub">{currentLang.english} · {currentLang.value}</Text>
        </View>
      </View>

      <View className="lang-group-title">
        <Text>{tt('setting.language.chooseHint', '选择应用语言')}</Text>
      </View>

      <RadioGroup className="lang-list" onChange={(e) => onSelect(e.detail.value as Locale)}>
        {LANGS.map((l) => (
          <View key={l.value} className={`lang-item${current === l.value ? ' lang-item--active' : ''}`}>
            <View className="lang-item-info">
              <Text className="lang-item-native">{tt(`setting.${l.key}`, l.native)}</Text>
              <Text className="lang-item-en">{l.english}</Text>
            </View>
            <Radio
              value={l.value}
              checked={current === l.value}
              color="var(--color-primary)"
              className="lang-item-radio"
            />
          </View>
        ))}
      </RadioGroup>

      <View className="lang-tips">
        <Text className="lang-tips-text">
          {tt('setting.language.tip', '切换语言后将自动保存并生效')}
        </Text>
        <Text className="lang-tips-note">
          {tt('setting.language.note', '部分内容可能仍以原文显示,我们正在持续完善多语言支持。')}
        </Text>
      </View>
    </View>
  )
}
