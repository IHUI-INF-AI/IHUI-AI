import { View, Text, Switch } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getNotificationSettings, updateNotificationSettings } from '@/api'

interface NotificationItem {
  key: string
  title: string
  enabled: boolean
}

export default function NotificationPage() {
  const [list, setList] = useState<NotificationItem[]>([])

  const load = useCallback(async () => {
    try {
      const res = await getNotificationSettings()
      setList(res.list || [])
    } catch (e) {}
  }, [])

  useDidShow(() => { load() })

  const onToggle = useCallback((key: string, value: boolean) => {
    setList(prev => prev.map(item => item.key === key ? { ...item, enabled: value } : item))
    updateNotificationSettings({ [key]: value }).catch(() => {})
  }, [])

  return (
    <View className="min-h-screen bg-[#f7f8fa]">
      <View className="mx-[12px] my-[12px] bg-white rounded-[8px] overflow-hidden">
        {list.map((item, idx) => (
          <View
            key={item.key}
            className={`flex items-center justify-between px-[16px] py-[14px] ${
              idx < list.length - 1 ? 'border-b border-[#f0f0f0]' : ''
            }`}
          >
            <Text className="text-[15px] text-[#333]">{item.title}</Text>
            <Switch
              checked={item.enabled}
              onChange={e => onToggle(item.key, e.detail.value)}
            />
          </View>
        ))}
      </View>
    </View>
  )
}
