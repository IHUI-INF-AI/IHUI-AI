import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { setLanguage } from '@/api'

const LANGS = [
  { value: 'zh-CN', name: '简体中文' },
  { value: 'zh-TW', name: '繁體中文' },
  { value: 'en', name: 'English' },
  { value: 'ja', name: '日本語' },
  { value: 'ko', name: '한국어' },
]

export default function LanguagePage() {
  const [current, setCurrent] = useState('zh-CN')

  useDidShow(() => {
    const lang = Taro.getStorageSync('lang')
    if (lang) setCurrent(lang)
  })

  const onSelect = useCallback(async (v: string) => {
    setCurrent(v)
    try {
      await setLanguage(v)
      Taro.setStorageSync('lang', v)
      Taro.showToast({ title: '设置成功', icon: 'success' })
    } catch (e) {
      console.error('[setting/language] 设置语言 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] my-[12px] bg-white rounded-[8px] overflow-hidden">
        {LANGS.map((l, idx) => (
          <View
            key={l.value}
            className={`flex items-center justify-between px-[16px] py-[16px] ${
              idx < LANGS.length - 1 ? 'border-b border-[#f0f0f0]' : ''
            }`}
            onClick={() => onSelect(l.value)}
          >
            <Text className="text-[15px] text-[#333]">{l.name}</Text>
            {current === l.value && <Text className="text-[16px] text-[#07c160]">✓</Text>}
          </View>
        ))}
      </View>
    </View>
  )
}
