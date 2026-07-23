import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import { setLanguage } from '@/api'
import { useI18n, type Locale } from '@/i18n'
import './language.css'

const LANGS: Array<{ value: Locale; key: 'zhCN' | 'en' | 'ja' | 'ko' | 'zhTW'; native: string }> = [
  { value: 'zh-CN', key: 'zhCN', native: '简体中文' },
  { value: 'zh-TW', key: 'zhTW', native: '繁體中文' },
  { value: 'en', key: 'en', native: 'English' },
  { value: 'ko', key: 'ko', native: '한국어' },
  { value: 'ja', key: 'ja', native: '日本語' },
]

export default function LanguagePage() {
  const { t, locale, setLocale } = useI18n()
  const [current, setCurrent] = useState<Locale>(locale)
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

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

  return (
    <View className="page">
      <View className="group-title">
        <Text>{tt('setting.language.chooseHint', '选择应用语言')}</Text>
      </View>
      <View className="list">
        {LANGS.map((l) => (
          <View
            key={l.value}
            className={`item${current === l.value ? ' active' : ''}`}
            onClick={() => onSelect(l.value)}
          >
            <View className="lang-info">
              <Text className="lang-native">{tt(`setting.${l.key}`, l.native)}</Text>
              <Text className="lang-value">{l.value}</Text>
            </View>
            {current === l.value && <Text className="check">✓</Text>}
          </View>
        ))}
      </View>
      <View className="tips">
        <Text>{tt('setting.language.tip', '切换语言后将自动保存并生效')}</Text>
      </View>
    </View>
  )
}
