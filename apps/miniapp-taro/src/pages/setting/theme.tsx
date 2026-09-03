// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, RadioGroup, Radio, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { setTheme } from '@/api'
import { setThemePreference, THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme'
import ThemeRoot from '@/components/ThemeRoot'
import './theme.css'

const THEME_KEY = THEME_STORAGE_KEY

interface ThemeOption {
  value: string
  icon: string
  labelKey: string
  label: string
  descKey: string
  desc: string
}

const AUTO_THEME = (tt: TtFn): ThemeOption => ({
  value: 'auto',
  icon: '/static/images/icons/refresh-cw.svg',
  labelKey: 'setting.theme.auto',
  label: tt('settings.themeSystem', '跟随系统'),
  descKey: 'setting.theme.autoDesc',
  desc: tt('settingTheme.d1', '根据系统设置自动切换浅色或深色'),
})

const THEMES = (tt: TtFn): ThemeOption[] => [
  AUTO_THEME(tt),
  {
    value: 'light',
    icon: '/static/images/icons/sun.svg',
    labelKey: 'setting.theme.light',
    label: tt('themeToggle.lightMode', '浅色模式'),
    descKey: 'setting.theme.lightDesc',
    desc: tt('settingTheme.d2', '明亮的浅色界面,适合白天使用'),
  },
  {
    value: 'dark',
    icon: '/static/images/icons/moon.svg',
    labelKey: 'setting.theme.dark',
    label: tt('themeToggle.darkMode', '深色模式'),
    descKey: 'setting.theme.darkDesc',
    desc: tt('settingTheme.d3', '深色界面,护眼且省电,适合夜间使用'),
  },
]

const VALID_VALUES: readonly string[] = ['auto', 'light', 'dark']

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

  const currentOption = THEMES(tt).find((th) => th.value === current) ?? AUTO_THEME(tt)

  const onSelect = useCallback(
    async (v: string) => {
      if (!VALID_VALUES.includes(v) || v === current) return
      setCurrent(v)
      try {
        // 写入本地存储 + 同步原生导航栏/tabBar 配色 + 广播主题变更事件
        setThemePreference(v as ThemePreference)
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
    <ThemeRoot>
      <View className="theme-page">
        <View className="theme-current">
          <Image
            className="theme-current-icon"
            style={{ width: '64rpx', height: '64rpx' }}
            src={currentOption.icon}
            mode="aspectFit"
          />
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
          {THEMES(tt).map((th) => (
            <View
              key={th.value}
              className={`theme-item${current === th.value ? ' active' : ''}`}
              onClick={() => onSelect(th.value)}
            >
              <Image
                className="theme-item-icon"
                style={{ width: '44rpx', height: '44rpx' }}
                src={th.icon}
                mode="aspectFit"
              />
              <View className="theme-item-info">
                <Text className="theme-item-name">{tt(th.labelKey, th.label)}</Text>
                <Text className="theme-item-desc">{tt(th.descKey, th.desc)}</Text>
              </View>

              <Radio
                className="theme-radio"
                value={th.value}
                checked={current === th.value}
                color="var(--color-wechat-green)"
                disabled={submitting}
              />
            </View>
          ))}
        </RadioGroup>

        <View className="theme-hint">
          <Text className="theme-hint-title">{tt('setting.theme.hintTitle', '主题说明')}</Text>
          <Text className="theme-hint-line">
            {tt('setting.theme.switchHint', '切换主题后将立即保存并应用到全局界面')}
          </Text>
          <Text className="theme-hint-line">
            {tt('setting.theme.autoHint', '「跟随系统」将随设备深浅色设置自动变化')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
