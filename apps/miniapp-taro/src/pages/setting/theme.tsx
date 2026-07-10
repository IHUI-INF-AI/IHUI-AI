import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { setTheme } from '@/api'
import './theme.css'

const THEMES = [
  { value: 'light', name: '浅色模式', color: '#ffffff' },
  { value: 'dark', name: '深色模式', color: '#1a1a1a' },
  { value: 'auto', name: '跟随系统', color: 'linear-gradient(135deg, #fff 50%, #1a1a1a 50%)' },
]

export default function ThemePage() {
  const [current, setCurrent] = useState('light')

  const onSelect = useCallback(async (v: string) => {
    setCurrent(v)
    try {
      await setTheme(v)
      Taro.showToast({ title: '设置成功', icon: 'success' })
    } catch {}
  }, [])

  return (
    <View className="page">
      <View className="preview">
        <View className={`phone ${current}`}>
          <View className="status-bar" />
          <View className="content-area" />
        </View>
      </View>

      <View className="list">
        {THEMES.map(t => (
          <View
            key={t.value}
            className={`item${current === t.value ? ' active' : ''}`}
            onClick={() => onSelect(t.value)}
          >
            <View className="color" style={{ background: t.color }} />
            <Text className="name">{t.name}</Text>
            {current === t.value ? <Text className="check">✓</Text> : null}
          </View>
        ))}
      </View>
    </View>
  )
}
