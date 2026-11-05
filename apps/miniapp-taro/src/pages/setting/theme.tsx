// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 主题分区:UI 单源 packages/app/src/features/settings/SettingsScreen.tsx 的 SettingsThemeSection
// (与语言分区同款抽段:宿主注入 theme/themeOptions/onSelectTheme/colorScheme,组件零平台假设)。
//
// 本页只留平台事实:偏好读写(@/lib/theme)、服务端同步(POST /settings/theme)、主题说明块。
// 端内原先的图标 + 两行副描述属"小程序端补充信息",随分区收口为 RN 同款 label+✓;
// 不另加"仅某端使用"的槽(如 renderIcon/renderDescription)来保住它们。

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { setTheme } from '@/api'
import { setThemePreference, THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { onToast } from '@/host/on-toast'
import { SettingsThemeSection } from '@ihui/rn-app/features/settings/SettingsScreen'

const VALID_VALUES: readonly string[] = ['auto', 'light', 'dark']

export default function ThemePage() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])
  const [current, setCurrent] = useState<string>(() => {
    try {
      const saved = Taro.getStorageSync(THEME_STORAGE_KEY)
      return VALID_VALUES.includes(saved) ? saved : 'auto'
    } catch {
      return 'auto'
    }
  })
  const [submitting, setSubmitting] = useState(false)

  useDidShow(() => {
    try {
      const saved = Taro.getStorageSync(THEME_STORAGE_KEY)
      if (VALID_VALUES.includes(saved) && saved !== current) setCurrent(saved)
    } catch {
      // ignore
    }
  })

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
        onToast(tt('setting.setSuccess', '设置成功'), { kind: 'success' })
      } catch (e) {
        logger.error('setting/theme', '设置主题', e)
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      } finally {
        setSubmitting(false)
      }
    },
    [current, tt],
  )

  // 提交中不响应,与旧页同一门控;门控留在页内,不进共享分区
  const onSelectTheme = useCallback(
    (v: string) => {
      if (!submitting) void onSelect(v)
    },
    [submitting, onSelect],
  )

  const themeOptions = [
    { value: 'auto', label: tt('settings.themeSystem', '跟随系统') },
    { value: 'light', label: tt('themeToggle.lightMode', '浅色模式') },
    { value: 'dark', label: tt('themeToggle.darkMode', '深色模式') },
  ]

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background pt-[24rpx] pb-[48rpx]">
        <View className="mx-[20rpx] mt-[32rpx]">
          <SettingsThemeSection
            t={t}
            theme={current}
            themeOptions={themeOptions}
            onSelectTheme={onSelectTheme}
            colorScheme={resolvedTheme}
          />
        </View>
        {/* 主题说明为端内文案块:共享分区没有该区,不塞单端槽 */}
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
