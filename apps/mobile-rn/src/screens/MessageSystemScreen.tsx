// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { buildNoticeDetail, noticeDetailCopyText } from '@ihui/shared/notifications'
import type { NoticeDetailData } from '@ihui/types'
import {
  MessageSystemScreen as SharedMessageSystemScreen,
  NoticeDetailSheet,
  type MessageSystemItem,
} from '@ihui/rn-app'
import Clipboard from '@react-native-clipboard/clipboard'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function MessageSystemScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<MessageSystemItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  /** 系统公告行只有展示时间串,详情需要原始 ISO(与小程序 systemIso 同一条口径) */
  const [times, setTimes] = useState<Record<string, string>>({})
  /** 2026-11-27 三端统一:点系统公告 = 打开全文抽屉,不再拿 announcements id 去猜 edu_messages */
  const [noticeDetail, setNoticeDetail] = useState<NoticeDetailData | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<{
        list: Array<{ id: number; content: string; createdAt?: string | Date }>
      }>('/messages/system-notice/list')
      if (!res.success) throw new Error()
      const list = res.data?.list ?? []
      const isoMap: Record<string, string> = {}
      setItems(
        list.map((row) => {
          const d = row.createdAt ? new Date(row.createdAt) : null
          const iso = d && !Number.isNaN(d.getTime()) ? d.toISOString() : ''
          if (iso) isoMap[String(row.id)] = iso
          return {
            id: String(row.id),
            title: (row.content ?? '').slice(0, 24),
            content: row.content ?? '',
            time: d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : '',
            read: true,
          }
        }),
      )
      setTimes(isoMap)
    } catch {
      setError(t('messageSystem.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <SharedMessageSystemScreen
        t={t}
        items={items}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => {
          setRefreshing(true)
          void load()
        }}
        onPressItem={(item) =>
          setNoticeDetail(
            buildNoticeDetail({
              id: item.id,
              // 标题是端内截断串,交给 shared 用正文首行兜底,避免详情标题只有半句
              title: '',
              content: item.content,
              type: 'system',
              level: 'info',
              createdAt: times[item.id] ?? '',
              read: true,
            }),
          )
        }
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
      />
      <NoticeDetailSheet
        t={t}
        visible={noticeDetail !== null}
        detail={noticeDetail}
        onClose={() => setNoticeDetail(null)}
        onCopy={(detail) => {
          Clipboard.setString(noticeDetailCopyText(detail))
        }}
        colorScheme={resolvedTheme}
      />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
