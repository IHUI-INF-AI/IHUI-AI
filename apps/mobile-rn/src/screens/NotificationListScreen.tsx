// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  archiveNotification,
  deleteNotification,
  getNotifications,
  markNotificationRead,
  restoreNotification,
} from '@ihui/api-client'
import { apiFailureToError } from '@ihui/shared/utils'
import {
  buildNoticeDetail,
  noticeDetailCopyText,
  readNoticeSessionId,
} from '@ihui/shared/notifications'
import type { NoticeDetailData, NotificationItem, NotificationPartition } from '@ihui/types'
import {
  NotificationListScreen as SharedNotificationListScreen,
  NoticeDetailSheet,
} from '@ihui/rn-app'
import type { NotificationListItem, NotificationRowStatus } from '@ihui/rn-app'
import Clipboard from '@react-native-clipboard/clipboard'
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
    // G2 深链 id 与 Web 消息页同一读取口径(payload 来自 WS / data 来自 REST)
    sessionId: readNoticeSessionId(n.payload ?? n.data) ?? undefined,
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
  /** 2026-11-27 三端统一:点通知行 = 打开全文抽屉(与消息中心/Web 同一份 NoticeDetailSheet) */
  const [noticeDetail, setNoticeDetail] = useState<NoticeDetailData | null>(null)

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

  /** 详情抽屉内的删除:物理删除后关抽屉并重取列表,失败保留抽屉并显式标红。 */
  const removeNotice = async (id: string) => {
    setStatus(id, { text: t('notificationList.deleting'), tone: 'muted', pending: true })
    const res = await deleteNotification(id)
    if (!res.success) {
      setStatus(id, {
        text: t('notificationList.deleteFailed'),
        tone: 'destructive',
      })
      return
    }
    setNoticeDetail(null)
    setStatus(id, undefined)
    await load()
  }

  // 点击通知行 = 打开全文抽屉 + 未读标已读(2026-11-27 三端统一口径;
  // 此前已读行点下去完全没有反馈,用户以为列表卡死)。
  const handlePressItem = async (item: NotificationListItem) => {
    setNoticeDetail(
      buildNoticeDetail({
        id: item.id,
        title: item.title,
        content: item.content,
        type: item.type,
        level: 'info',
        createdAt: item.createdAt,
        read: true,
        sessionId: item.sessionId ?? null,
      }),
    )
    if (item.read) return
    const res = await markNotificationRead(item.id)
    if (!res.success) {
      setError(res.error || t('notificationList.loadFailed'))
      return
    }
    await load()
  }

  return (
    <>
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
        onPressItem={(item) => void handlePressItem(item)}
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
        partition={partition}
        onPartitionChange={setPartition}
        onArchive={(item) => void move(item, 'archived')}
        onRestore={(item) => void move(item, 'active')}
        rowStatus={rowStatus}
      />
      <NoticeDetailSheet
        t={t}
        visible={noticeDetail !== null}
        detail={noticeDetail}
        onClose={() => setNoticeDetail(null)}
        onDelete={(detail) => void removeNotice(detail.id)}
        onCopy={(detail) => {
          Clipboard.setString(noticeDetailCopyText(detail))
        }}
        onOpenSession={(sessionId) => {
          setNoticeDetail(null)
          navigation.navigate('Chat', { conversationId: sessionId })
        }}
        colorScheme={resolvedTheme}
      />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
