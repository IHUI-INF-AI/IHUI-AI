import { logger } from '@/utils/logger'
import { View, Text, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getNotificationSettings, updateNotificationSettings } from '@/api'
import { useI18n } from '@/i18n'
import './notification.css'

interface NotificationSettingItem {
  key: string
  title: string
  enabled: boolean
}

export default function NotificationPage() {
  const { t } = useI18n()
  const [list, setList] = useState<NotificationSettingItem[]>([])
  const [loading, setLoading] = useState(true)
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getNotificationSettings()
      setList(res.list || [])
    } catch (e) {
      logger.error('setting/notification', '获取通知设置', e)
      Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [t, tt])

  useDidShow(() => {
    load()
  })

  const onToggle = useCallback(
    (key: string, value: boolean) => {
      setList((prev) => prev.map((item) => (item.key === key ? { ...item, enabled: value } : item)))
      updateNotificationSettings({ [key]: value }).catch((e) => {
        logger.error('setting/notification', '更新通知设置', e)
        Taro.showToast({ title: tt('setting.operationFailed', '操作失败'), icon: 'none' })
      })
    },
    [tt],
  )

  const onDetail = useCallback(() => {
    Taro.navigateTo({ url: '/pages/message/index' })
  }, [])

  return (
    <View className="page">
      <View className="group-title">
        <Text>{tt('setting.notification.categoryTitle', '通知分类')}</Text>
      </View>
      <View className="card">
        {loading ? (
          <View className="empty">
            <Text>{tt('common.loading', '加载中…')}</Text>
          </View>
        ) : list.length === 0 ? (
          <View className="empty">
            <Text>{tt('setting.notification.empty', '暂无通知设置项')}</Text>
          </View>
        ) : (
          list.map((item, idx) => (
            <View
              key={item.key}
              className={`row${idx === list.length - 1 ? ' last' : ''}`}
            >
              <View className="row-info">
                <Text className="row-title">{item.title}</Text>
              </View>
              <Switch
                checked={item.enabled}
                color="#00b96b"
                onChange={(e) => onToggle(item.key, e.detail.value)}
              />
            </View>
          ))
        )}
      </View>

      <View className="group-title">
        <Text>{tt('setting.notification.moreTitle', '更多')}</Text>
      </View>
      <View className="card">
        <View className="row last" onClick={onDetail}>
          <View className="row-info">
            <Text className="row-title">
              {tt('setting.notification.detail', '通知详情')}
            </Text>
            <Text className="row-desc">
              {tt('setting.notification.detailDesc', '查看历史通知消息')}
            </Text>
          </View>
          <Text className="arrow">›</Text>
        </View>
      </View>
    </View>
  )
}
