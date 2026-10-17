// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { archiveNotification, getNotifications, restoreNotification } from '@ihui/api-client'
import { apiFailureToError } from '@ihui/shared/utils'
import type { NotificationItem, NotificationPartition } from '@ihui/types'
import { NotificationListScreen as SharedNotificationListScreen } from '@ihui/rn-app'
import type { NotificationListItem, NotificationRowStatus } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 后端列表项(契约面)→ 共享屏的展示项;两边字段名不同形,不映射就会静默失真。 */
function toListItem(n: NotificationItem): NotificationListItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    // content 在后端可空、共享卡片按字符串渲:不写 ?? '' 会把 null 渲成 "null"。
    content: n.content ?? '',
    // 后端字段是 isRead,共享类型是 read ⇒ 此前直传整个信封,未读点恒不亮。
    read: n.isRead,
    archivedAt: n.archivedAt ?? null,
    createdAt: n.createdAt,
  }
}

export function NotificationListScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<NotificationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [partition, setPartition] = useState<NotificationPartition>('active')
  const [rowStatus, setRowStatus] = useState<Record<string, NotificationRowStatus | undefined>>({})

  const load = useCallback(async () => {
    setError('')
    try {
      // 后端 GET /notifications 回分页信封(notifications.ts 的列表 handler：
      // success({ list, total, page, pageSize, unread }))，此前本屏把整个信封当数组用
      // ⇒ 通知列表永远空,且没有任何一层会红。
      // D195:分区必须带上 —— 后端缺省 active,不带参数就是"隐藏后仍能在原处看见它"。
      const res = await getNotifications({ page: 1, pageSize: 20, partition })
      if (!res.success) throw apiFailureToError(res)
      setItems((res.data?.list ?? []).map(toListItem))
    } catch {
      setError(t('notificationList.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t, partition])

  useEffect(() => {
    void load()
  }, [load])

  // 换分区即换行集,上一次失败回显不再有意义 ⇒ 整表清掉,不留着串台。
  useEffect(() => {
    setRowStatus({})
  }, [partition])

  const setStatus = (id: string, status: NotificationRowStatus | undefined) => {
    setRowStatus((prev) => ({ ...prev, [id]: status }))
  }

  const move = async (item: NotificationListItem, to: NotificationPartition) => {
    const busyText = t(to === 'archived' ? 'notificationList.hiding' : 'notificationList.restoring')
    setStatus(item.id, { text: busyText, tone: 'muted', pending: true })
    const res =
      to === 'archived' ? await archiveNotification(item.id) : await restoreNotification(item.id)
    if (!res.success) {
      setStatus(item.id, {
        text: t(
          to === 'archived' ? 'notificationList.hideFailed' : 'notificationList.restoreFailed',
        ),
        tone: 'destructive',
      })
      return
    }
    setStatus(item.id, undefined)
    await load()
  }

  return (
    <SharedNotificationListScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
      partition={partition}
      onPartitionChange={setPartition}
      onArchive={(item) => void move(item, 'archived')}
      onRestore={(item) => void move(item, 'active')}
      rowStatus={rowStatus}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
