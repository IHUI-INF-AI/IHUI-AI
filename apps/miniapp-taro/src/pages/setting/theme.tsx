import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { setTheme } from '@/api'
import { useI18n } from '@/i18n'
import './theme.css'

const THEME_VALUES = ['light', 'dark', 'auto']
const THEME_COLORS = ['#ffffff', '#1a1a1a', 'linear-gradient(135deg, #fff 50%, #1a1a1a 50%)']
const THEME_LABELS: Record<string, string> = {
  light: '浅色',
  dark: '深色',
  auto: '跟随系统',
}
const THEME_KEY = 'theme'

export default function ThemePage() {
  const { t } = useI18n()
  // 本地 fallback:setting.theme.<key> 待主 agent 补 i18n,未命中时返回 fb
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  // 初始值从本地 storage 读取,修复原固定 'light' 导致已选主题不回显的 bug
  const [current, setCurrent] = useState<string>(() => {
    try {
      const saved = Taro.getStorageSync(THEME_KEY)
      return THEME_VALUES.includes(saved) ? saved : 'light'
    } catch {
      return 'light'
    }
  })

  useDidShow(() => {
    // 同步本地值:其他页面可能改过主题
    try {
      const saved = Taro.getStorageSync(THEME_KEY)
      if (THEME_VALUES.includes(saved) && saved !== current) setCurrent(saved)
    } catch {
      // ignore
    }
  })

  const onSelect = useCallback(
    async (v: string) => {
      setCurrent(v)
      try {
        Taro.setStorageSync(THEME_KEY, v)
      } catch {
        // ignore
      }
      try {
        await setTheme(v)
        Taro.showToast({ title: tt('setting.setSuccess', '设置成功'), icon: 'success' })
      } catch (e) {
        logger.error('setting/theme', '设置主题', e)
        Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
      }
    },
    [tt],
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
            <Text className="name">{tt(`setting.theme.${v}`, THEME_LABELS[v] || v)}</Text>
            {current === v ? <Text className="check">✓</Text> : null}
          </View>
        ))}
      </View>
    </View>
  )
}
