// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import LineIcon, { type IconName } from '@/components/LineIcon'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { setTheme } from '@/api'
import { setThemePreference, THEME_STORAGE_KEY, type ThemePreference } from '@/lib/theme'
import ThemeRoot from '@/components/ThemeRoot'

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
  icon: 'refresh-cw',
  labelKey: 'setting.theme.auto',
  label: tt('settings.themeSystem', '跟随系统'),
  descKey: 'setting.theme.autoDesc',
  desc: tt('settingTheme.d1', '根据系统设置自动切换浅色或深色'),
})

const THEMES = (tt: TtFn): ThemeOption[] => [
  AUTO_THEME(tt),
  {
    value: 'light',
    icon: 'sun',
    labelKey: 'setting.theme.light',
    label: tt('themeToggle.lightMode', '浅色模式'),
    descKey: 'setting.theme.lightDesc',
    desc: tt('settingTheme.d2', '明亮的浅色界面,适合白天使用'),
  },
  {
    value: 'dark',
    icon: 'moon',
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
      {/* 根容器背景对齐 RN SettingsScreen container(pageBg=surface.bg → --color-background);
          上下留白对齐 body paddingTop 12dp→24rpx / paddingBottom 24dp→48rpx */}
      <View className="min-h-screen bg-background pt-[24rpx] pb-[48rpx]">
        {/* 主题选择对齐 RN SettingsScreen 主题 Section(共享 packages/app SettingsScreen):
            标题对齐 sectionTitle 14dp→28rpx(text.secondary→muted-foreground)+ 距卡片 gap 8dp→16rpx;
            列表对齐 sectionCard:圆角 8dp→16rpx + divider(border.light)底 + 行间 hairline(2rpx);
            行对齐 plainRow:minHeight 60dp→120rpx / py 14dp→28rpx / px 12dp→24rpx,
            卡面亮色 surface.light→--color-card、暗色 surface.muted→--color-muted(dark:bg-muted) */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="mb-[16rpx] block text-[28rpx] text-muted-foreground">
            {tt('settings.theme', '主题')}
          </Text>
          <View className="flex flex-col gap-[2rpx] overflow-hidden rounded-[16rpx] bg-[color:var(--color-border)]">
            {THEMES(tt).map((th) => (
              <View
                key={th.value}
                className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
                onClick={() => {
                  if (!submitting) void onSelect(th.value)
                }}
                hoverClass="opacity-60">
                <View className="flex min-w-0 flex-1 flex-row items-center">
                  {/* 主题图标为小程序端补充信息(RN SelectRow 仅 label+✓):40rpx,
                      选中态随 RN brandAccent.DEFAULT→--color-brand-orange */}
                  <LineIcon
                    className="shrink-0"
                    name={th.icon as IconName}
                    size={40}
                    color={
                      current === th.value
                        ? 'var(--color-brand-orange)'
                        : 'var(--color-muted-foreground)'
                    }
                  />
                  <View className="ml-[16rpx] min-w-0 flex-1">
                    {/* rowLabel 对齐 RN: 16dp→32rpx + text.medium 语义映射 muted-foreground */}
                    <Text className="text-[32rpx] text-muted-foreground">
                      {tt(th.labelKey, th.label)}
                    </Text>
                    {/* 副行(说明)为小程序端补充信息:24rpx + text.tertiary + userMeta gap 2dp→4rpx */}
                    <Text className="mt-[4rpx] block text-[24rpx] leading-[1.5] text-[color:var(--color-text-tertiary)]">
                      {tt(th.descKey, th.desc)}
                    </Text>
                  </View>
                </View>
                {/* 选中态对齐 RN SelectRow checkMark: 16dp→32rpx bold + brandAccent→--color-brand-orange;
                    选中项由 ✓ 呈现,不再渲染 RN 没有的 Radio/RadioGroup 展示件 */}
                {current === th.value ? (
                  <Text className="ml-[16rpx] shrink-0 text-[32rpx] font-bold text-[color:var(--color-brand-orange)]">
                    ✓
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        {/* 主题说明对齐 RN versionText: 12dp→24rpx + text.tertiary + 居中;marginTop 4dp→8rpx */}
        <View className="mx-[20rpx] mt-[32rpx]">
          <Text className="block text-center text-[24rpx] leading-[1.6] text-[color:var(--color-text-tertiary)]">
            {tt('setting.theme.hintTitle', '主题说明')}
          </Text>
          <Text className="mt-[8rpx] block text-center text-[24rpx] leading-[1.6] text-[color:var(--color-text-tertiary)]">
            {tt('setting.theme.switchHint', '切换主题后将立即保存并应用到全局界面')}
          </Text>
          <Text className="mt-[8rpx] block text-center text-[24rpx] leading-[1.6] text-[color:var(--color-text-tertiary)]">
            {tt('setting.theme.autoHint', '「跟随系统」将随设备深浅色设置自动变化')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
