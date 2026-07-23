import { logger } from '@/utils/logger'
import { View, Text, RadioGroup, Radio } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { setTheme } from '@/api'
import { useI18n } from '@/i18n'
import './theme.css'

const THEME_KEY = 'theme'

interface ThemeOption {
  value: string
  icon: string
  labelKey: string
  label: string
  descKey: string
  desc: string
}

const AUTO_THEME: ThemeOption = {
  value: 'auto',
  icon: '🔄',
  labelKey: 'setting.theme.auto',
  label: '跟随系统',
  descKey: 'setting.theme.autoDesc',
  desc: '根据系统设置自动切换浅色或深色',
}

const THEMES: ThemeOption[] = [
  AUTO_THEME,
  {
    value: 'light',
    icon: '☀️',
    labelKey: 'setting.theme.light',
    label: '浅色模式',
    descKey: 'setting.theme.lightDesc',
    desc: '明亮的浅色界面,适合白天使用',
  },
  {
    value: 'dark',
    icon: '🌙',
    labelKey: 'setting.theme.dark',
    label: '深色模式',
    descKey: 'setting.theme.darkDesc',
    desc: '深色界面,护眼且省电,适合夜间使用',
  },
]

const VALID_VALUES = THEMES.map((th) => th.value)

export default function ThemePage() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])
  const [current, setCurrent] = useState<string>(() => {
    try {
      const saved = Taro.getStorageSync(THEME_KEY)
      return VALID_VALUES.includes(saved) ? saved : 'auto'
    } catch {
      return 'auto'
    }
  })
  const [submitting, setSubmitting] = useState(false)

  useDidShow(() => {
    try {
      const saved = Taro.getStorageSync(THEME_KEY)
      if (VALID_VALUES.includes(saved) && saved !== current) setCurrent(saved)
    } catch {
      // ignore
    }
  })

  const currentOption = THEMES.find((th) => th.value === current) ?? AUTO_THEME

  const onSelect = useCallback(
    async (v: string) => {
      if (!VALID_VALUES.includes(v) || v === current) return
      setCurrent(v)
      try {
        Taro.setStorageSync(THEME_KEY, v)
      } catch {
        // ignore
      }
      setSubmitting(true)
      try {
        await setTheme(v)
        Taro.showToast({ title: tt('setting.setSuccess', '设置成功'), icon: 'success' })
      } catch (e) {
        logger.error('setting/theme', '设置主题', e)
        Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
      } finally {
        setSubmitting(false)
      }
    },
    [current, tt],
  )

  return (
    <View className="theme-page">
      <View className="theme-current">
        <Text className="theme-current-icon">{currentOption.icon}</Text>
        <View className="theme-current-info">
          <Text className="theme-current-name">
            {tt(currentOption.labelKey, currentOption.label)}
          </Text>
          <Text className="theme-current-desc">
            {tt(currentOption.descKey, currentOption.desc)}
          </Text>
        </View>
      </View>

      <RadioGroup className="theme-list">
        {THEMES.map((th) => (
          <View
            key={th.value}
            className={`theme-item${current === th.value ? ' active' : ''}`}
            onClick={() => onSelect(th.value)}
          >
            <Text className="theme-item-icon">{th.icon}</Text>
            <View className="theme-item-info">
              <Text className="theme-item-name">{tt(th.labelKey, th.label)}</Text>
              <Text className="theme-item-desc">{tt(th.descKey, th.desc)}</Text>
            </View>
            <Radio
              className="theme-radio"
              value={th.value}
              checked={current === th.value}
              color="#07c160"
              disabled={submitting}
            />
          </View>
        ))}
      </RadioGroup>

      <View className="theme-hint">
        <Text className="theme-hint-title">
          {tt('setting.theme.hintTitle', '主题说明')}
        </Text>
        <Text className="theme-hint-line">
          {tt('setting.theme.switchHint', '切换主题后将立即保存并应用到全局界面')}
        </Text>
        <Text className="theme-hint-line">
          {tt('setting.theme.autoHint', '「跟随系统」将随设备深浅色设置自动变化')}
        </Text>
      </View>
    </View>
  )
}
