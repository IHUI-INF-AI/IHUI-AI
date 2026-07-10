import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { setLanguage } from '@/api'
import './language.css'

const LANGS = [
  { value: 'zh-CN', name: '简体中文' },
  { value: 'zh-TW', name: '繁體中文' },
  { value: 'en', name: 'English' },
  { value: 'ja', name: '日本語' },
]

export default function LanguagePage() {
  const [current, setCurrent] = useState('zh-CN')

  const onSelect = useCallback(async (v: string) => {
    setCurrent(v)
    try {
      await setLanguage(v)
      Taro.showToast({ title: '设置成功', icon: 'success' })
    } catch (e) {}
  }, [])

  return (
    <View className="page">
      <View className="list">
        {LANGS.map(l => (
          <View
            key={l.value}
            className={`item${current === l.value ? ' active' : ''}`}
            onClick={() => onSelect(l.value)}
          >
            <Text className="name">{l.name}</Text>
            {current === l.value ? <Text className="check">✓</Text> : null}
          </View>
        ))}
      </View>
    </View>
  )
}
