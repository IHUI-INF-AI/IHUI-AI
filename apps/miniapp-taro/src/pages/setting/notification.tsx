import { logger } from '@/utils/logger'
import { View, Text, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getNotificationSettings, updateNotificationSettings } from '@/api'
import { useI18n } from '@/i18n'

/**
 * 通知设置项(用户在设置页开关的通知类别)。
 * 与 @ihui/types 的 NotificationItem(通知列表项:id/type/title/content/isRead/createdAt)语义不同 ——
 * 此处是设置项,含 key / title / enabled 字段,非通知数据本身。
 * 命名为 NotificationSettingItem 避免与 @ihui/types NotificationItem 命名冲突。
 */
interface NotificationSettingItem {
  key: string
  title: string
  enabled: boolean
}

export default function NotificationPage() {
  const { t } = useI18n()
  const [list, setList] = useState<NotificationSettingItem[]>([])

  const load = useCallback(async () => {
    try {
      const res = await getNotificationSettings()
      setList(res.list || [])
    } catch (e) {
      logger.error('setting/notification', '获取通知设置', e)
      Taro.showToast({ title: t('setting.operationFailed'), icon: 'none' })
    }
  }, [t])

  useDidShow(() => {
    load()
  })

  const onToggle = useCallback((key: string, value: boolean) => {
    setList((prev) => prev.map((item) => (item.key === key ? { ...item, enabled: value } : item)))
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
            <Switch checked={item.enabled} onChange={(e) => onToggle(item.key, e.detail.value)} />
          </View>
        ))}
      </View>
    </View>
  )
}
