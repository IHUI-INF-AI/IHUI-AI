// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { setTheme } from '@/api'
import {
  setThemePreference,
  THEME_STORAGE_KEY,
  useAppTheme,
  type ThemePreference,
} from '@/lib/theme'
import ThemeRoot from '@/components/ThemeRoot'
import { onToast } from '@/host/on-toast'
import { SettingsThemeSection } from '@ihui/rn-app/features/settings/SettingsScreen'

const THEME_KEY = THEME_STORAGE_KEY

interface ThemeOption {
  value: string
  labelKey: string
  label: string
  descKey: string
  desc: string
}

const AUTO_THEME = (tt: TtFn): ThemeOption => ({
  value: 'auto',
  labelKey: 'settings.themeSystem',
  label: tt('settings.themeSystem', '跟随系统'),
  descKey: 'settingTheme.d1',
  desc: tt('settingTheme.d1', '根据系统设置自动切换浅色或深色'),
})

const THEMES = (tt: TtFn): ThemeOption[] => [
  AUTO_THEME(tt),
  {
    value: 'light',
    labelKey: 'themeToggle.lightMode',
    label: tt('themeToggle.lightMode', '浅色模式'),
    descKey: 'settingTheme.d2',
    desc: tt('settingTheme.d2', '明亮的浅色界面,适合白天使用'),
  },
  {
    value: 'dark',
    labelKey: 'themeToggle.darkMode',
    label: tt('themeToggle.darkMode', '深色模式'),
    descKey: 'settingTheme.d3',
    desc: tt('settingTheme.d3', '深色界面,护眼且省电,适合夜间使用'),
  },
]

const VALID_VALUES: readonly string[] = ['auto', 'light', 'dark']

export default function ThemePage() {
  const { t } = useI18n()
  const { resolved } = useAppTheme()
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

  const onSelect = useCallback(
    async (v: string) => {
      if (!VALID_VALUES.includes(v) || v === current || submitting) return
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
        onToast(tt('setting.setSuccess', '设置成功'), { kind: 'success' })
      } catch (e) {
        logger.error('setting/theme', '设置主题', e)
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      } finally {
        setSubmitting(false)
      }
    },
    [current, submitting, tt],
  )

  // 行文案/副行说明/行首字形全由本页注入:共享分段只负责 section 形态(标题 + 卡片 + 行 + ✓)
  const items = THEMES(tt).map((th) => ({
    value: th.value,
    label: tt(th.labelKey, th.label),
    description: tt(th.descKey, th.desc),
    icon: th.value as 'auto' | 'light' | 'dark',
  }))

  return (
    <ThemeRoot>
      {/* 根容器背景对齐 RN SettingsScreen container(pageBg=surface.bg → --color-background);
          上下留白对齐 body paddingTop 12dp→24rpx / paddingBottom 24dp→48rpx */}
      <View className="min-h-screen bg-background pt-[24rpx] pb-[48rpx]">
        {/* 主题分段(标题 + 3 行 + 行首字形 + 副行 + ✓)已抽成共享件:
            packages/app/src/features/settings/SettingsScreen.tsx 的 SettingsThemeSection,
            RN 大设置页与本页同一段;图标/副行为小程序端补充信息,底部三行说明 RN 无同构 ⇒ 留页内 */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <SettingsThemeSection
            title={tt('settings.theme', '主题')}
            items={items}
            selected={current}
            onSelect={onSelect}
            colorScheme={resolved}
          />
        </View>

        {/* 主题说明对齐 RN versionText: 12dp→24rpx + text.tertiary + 居中;marginTop 4dp→8rpx */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="block text-center text-label leading-[1.6] text-[color:var(--color-text-tertiary)]">
            {tt('setting.theme.hintTitle', '主题说明')}
          </Text>
          <Text className="mt-[8rpx] block text-center text-label leading-[1.6] text-[color:var(--color-text-tertiary)]">
            {tt('setting.theme.switchHint', '切换主题后将立即保存并应用到全局界面')}
          </Text>
          <Text className="mt-[8rpx] block text-center text-label leading-[1.6] text-[color:var(--color-text-tertiary)]">
            {tt('setting.theme.autoHint', '「跟随系统」将随设备深浅色设置自动变化')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
