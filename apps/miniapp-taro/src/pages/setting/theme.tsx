import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { setTheme } from '@/api'
import { useI18n } from '@/i18n'
import './theme.css'

const THEME_VALUES = ['light', 'dark', 'auto']
const THEME_COLORS = ['#ffffff', '#1a1a1a', 'linear-gradient(135deg, #fff 50%, #1a1a1a 50%)']

export default function ThemePage() {
  const { t } = useI18n()
  const [current, setCurrent] = useState('light')

  const onSelect = useCallback(
    async (v: string) => {
      setCurrent(v)
      try {
        await setTheme(v)
        Taro.showToast({ title: t('setting.setSuccess'), icon: 'success' })
      } catch (e) {
        logger.error('setting/theme', '设置主题', e)
        Taro.showToast({ title: t('setting.operationFailed'), icon: 'none' })
      }
    },
    [t],
  )

  return (
    <View className="page">
      <View className="preview">
        <View className={`phone ${current}`}>
          <View className="status-bar" />
          <View className="content-area" />
        </View>
      </View>

      <View className="list">
        {THEME_VALUES.map((v, i) => (
          <View
            key={v}
            className={`item${current === v ? ' active' : ''}`}
            onClick={() => onSelect(v)}
          >
            <View className="color" style={{ background: THEME_COLORS[i] }} />
            <Text className="name">{t(`setting.theme.${v}`)}</Text>
            {current === v ? <Text className="check">✓</Text> : null}
          </View>
        ))}
      </View>
    </View>
  )
}
