// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]: RN conversation-history thin shell (A2 2026-11-05)

/**
 * RN 端「AI 会话历史」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/chat/ConversationHistoryScreen.tsx`（真消费点）。
 *
 * 本文件只做平台侧：取数（与小程序页同一 api-client 出口）、日期分桶取词、
 * 置顶/删除/跳转，以及缺失取词时的中文回落。共享屏本身零平台 API。
 */

import { useCallback, useMemo, useState } from 'react'
import { Alert } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { deleteConversation, fetchApi, setConversationPinned } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { formatDateByTemplate } from '@ihui/shared'
import { togglePinnedItem } from '@ihui/shared/chat/conversation-pin'
import {
  groupConversationByDate,
  resolveConversationTimestamp,
  type ConversationDateGroupKey,
} from '@ihui/shared/chat/conversation-date-group'
import {
  ConversationHistoryScreen as SharedConversationHistoryScreen,
  type ConversationHistoryGroup,
} from '@ihui/rn-app/features/chat/ConversationHistoryScreen'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface ConversationsResponse {
  conversations: Array<{
    id: string
    title: string
    lastMessageAt: string
    messageCount?: number
    pinned?: boolean
  }>
}

interface Row {
  id: string
  title: string
  time: string
  timestamp?: number
  messageCount: number
  pinned: boolean
}

const GROUP_FALLBACK: Record<ConversationDateGroupKey, string> = {
  today: '今天',
  thisWeek: '本周',
  thisMonth: '本月',
  earlier: '更早',
}

export function ConversationHistoryScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [list, setList] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [degraded, setDegraded] = useState(false)

  /** 共享屏的 `t` 契约：RN 语料缺 `ai.historyPage.*` 时落中文，避免露裸键 */
  const tt = useCallback(
    (key: string, fallback: string) => {
      const hit = t(key as never) as unknown as string
      return hit && hit !== key ? hit : fallback
    },
    [t],
  )
  const tShared = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const hit = (t as unknown as (k: string, p?: unknown) => string)(key, params)
      if (hit && hit !== key) return hit
      if (key === 'ai.historyPage.msgCount') return `${params?.n ?? 0} 条消息`
      if (key === 'ai.historyPage.empty') return '暂无对话历史'
      return key
    },
    [t],
  )

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetchApi<ConversationsResponse>('/api/chat/conversations', {
        params: { pageSize: 100 },
      })
      if (!res.success) {
        setDegraded(true)
        return
      }
      setDegraded(false)
      setList(
        (res.data?.conversations ?? []).map((c) => {
          const ts = new Date(c.lastMessageAt).getTime()
          return {
            id: c.id,
            title: c.title,
            time: c.lastMessageAt,
            timestamp: Number.isNaN(ts) ? undefined : ts,
            messageCount: c.messageCount ?? 0,
            pinned: c.pinned === true,
          }
        }),
      )
    } catch {
      setDegraded(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const groups = useMemo<ConversationHistoryGroup[]>(
    () =>
      groupConversationByDate(list, (row) =>
        resolveConversationTimestamp([row.timestamp, row.time]),
      ).map((g) => ({
        key: g.key,
        label: tt(`ai.historyPage.group_${g.key}`, GROUP_FALLBACK[g.key]),
        items: g.items.map((row) => ({
          id: row.id,
          title: row.title,
          timeLabel: formatDateByTemplate(
            row.timestamp ?? new Date(row.time).getTime(),
            'MM-DD HH:mm',
          ),
          messageCount: row.messageCount,
          pinned: row.pinned,
        })),
      })),
    [list, tt],
  )

  const onTogglePin = useCallback(
    async (id: string) => {
      const hit = list.find((x) => x.id === id)
      if (!hit) return
      const next = hit.pinned !== true
      const outcome = await togglePinnedItem(list, id, next, setConversationPinned as never)
      setList(outcome.items as Row[])
    },
    [list],
  )

  const onDelete = useCallback((id: string) => {
    Alert.alert('删除会话', '删除后不可恢复，确定删除？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void deleteConversation(id).then((res: ApiResult<unknown>) => {
            if (res.success) setList((prev) => prev.filter((x) => x.id !== id))
          })
        },
      },
    ])
  }, [])

  return (
    <SharedConversationHistoryScreen
      t={tShared as never}
      tt={tt}
      groups={groups}
      itemCount={list.length}
      loading={loading}
      isFiltered={false}
      keyword=""
      onKeywordChange={() => undefined}
      filters={[]}
      activeFilter="all"
      onFilterChange={() => undefined}
      showClearAll={false}
      onClearAll={() => undefined}
      onImport={() => navigation.navigate('ConversationImport' as never)}
      degraded={degraded}
      onRetry={() => {
        void load(true)
      }}
      canPin
      onOpen={(row) => navigation.navigate('Chat', { conversationId: row.id } as never)}
      onTogglePin={(row) => {
        void onTogglePin(row.id)
      }}
      onLongPress={(row) => onDelete(row.id)}
      hasMore={false}
      loadingMore={false}
      onLoadMore={() => undefined}
      refreshing={refreshing}
      onRefresh={() => {
        void load(true)
      }}
      onStartNew={() => navigation.navigate('Chat', {} as never)}
      colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    />
  )
}
