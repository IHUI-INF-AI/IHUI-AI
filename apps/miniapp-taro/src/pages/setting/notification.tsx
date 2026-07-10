import { View, Text, Switch } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getNotificationSettings, updateNotificationSettings } from '@/api'
import './notification.css'

interface NotificationItem {
  key: string
  title: string
  enabled: boolean
}

export default function NotificationPage() {
  const [list, setList] = useState<NotificationItem[]>([])
  const [form, setForm] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    try {
      const res = await getNotificationSettings()
      const newList = res.list || []
      setList(newList)
      const newForm: Record<string, boolean> = {}
      newList.forEach(n => { newForm[n.key] = n.enabled })
      setForm(newForm)
    } catch (e) {}
  }, [])

  const onChange = useCallback((key: string, e: { detail: { value: boolean } }) => {
    const value = e.detail.value
    setForm(prev => ({ ...prev, [key]: value }))
    updateNotificationSettings({ [key]: value }).catch(() => {})
  }, [])

  useDidShow(() => load())

  return (
    <View className="page">
      {list.length ? (
        <View className="list">
          {list.map(n => (
            <View key={n.key} className="item">
              <Text className="title">{n.title}</Text>
              <Switch
                checked={form[n.key]}
                color="#007aff"
                onChange={e => onChange(n.key, e)}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
