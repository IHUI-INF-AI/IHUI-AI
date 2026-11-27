// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// i18n-content-exempt-file: 多语言常量数据定义(label/title/description等选项值,内容体系定为中文单语,产品决策2026-11-15) until 2027-05-31

import { useCallback, useEffect, useMemo, useState } from 'react'
import { appAlert } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  deleteConversation,
  fetchApi,
  markNotificationRead,
  setConversationPinned,
} from '@ihui/api-client'
import { togglePinnedItem } from '@ihui/shared/chat/conversation-pin'
import {
  buildNoticeDetail,
  noticeDetailCopyText,
  readNoticeSessionId,
} from '@ihui/shared/notifications'
import { MessageCenterScreen as SharedMessageCenterScreen } from '@ihui/rn-app/features/message-center/MessageCenterScreen'
import { NoticeDetailSheet } from '@ihui/rn-app/features/message-center/NoticeDetailSheet'
import type {
  MessageCenterItem,
  MessageConversationItem,
  MessageTab,
  NoticeDetailData,
} from '@ihui/types'
import Clipboard from '@react-native-clipboard/clipboard'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useRefreshOnFocus } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useHostPorts } from '../host/use-host-ports'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface MessagePage {
  list: NotificationRow[]
  total: number
}

/** GET /api/notifications 的行,与 Web 消息页 NotificationItem 同形。 */
interface NotificationRow {
  id: string
  title?: string | null
  content?: string | null
  type?: string
  isRead?: boolean
  createdAt?: string
  /** notifications.data / WS payload 透传(读 G2 深链 sessionId) */
  payload?: unknown
  data?: unknown
}

/** GET /api/messages/list 的行,与 Web 私信页同一投影。 */
interface ConversationListRow {
  id: string
  title?: string
  peerName?: string
  lastMessage?: string
  lastTime?: string
  updatedAt?: string
  unread?: number
  pinned?: boolean
  messages?: Array<{ content?: string }>
}

/** 与 Web messages/[type] PageClient 的 PAGE_SIZE 同一档 */
const PAGE_SIZE = 10

/**
 * Web 侧栏 /messages/{notice,comment,fans} 的查询类型。
 * like / favorite 在 Web 页被显式跳过(通知 enum 没有这两类,页面当空态,不发请求)。
 * private-letter 不走通知接口。
 */
const NOTIFICATION_API_TYPE: Record<string, string> = {
  notice: 'system',
  comment: 'comment',
  fans: 'follow',
}

function toCenterItem(row: NotificationRow, fallback: MessageTab): MessageCenterItem {
  const title = (row.title && row.title.trim()) || (row.content ?? '').slice(0, 40)
  return {
    id: row.id,
    type: (row.type || fallback) as MessageTab,
    title,
    content: row.content ?? '',
    read: row.isRead === true,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
    sessionId: readNoticeSessionId(row.payload ?? row.data) ?? undefined,
  }
}

function notificationsUrl(tab: string, page: number): string | null {
  const apiType = NOTIFICATION_API_TYPE[tab]
  if (!apiType) return null
  const qs = new URLSearchParams({
    type: apiType,
    page: String(page),
    pageSize: String(PAGE_SIZE),
  })
  return `/api/notifications?${qs.toString()}`
}

/**
 * 对齐 Uniapp pagesA/message/index.vue(消息):
 * - 标题「消息」:Uniapp navigation-bars title 按行为规格(shared 默认「消息中心」)
 * - 单导航栏:移除 wrapper 层 NavBar,消除与 shared header 的双标题栏
 *   (Uniapp 仅一层 navigation-bars;推送通知面板已由 RootNavigator 全局挂载,
 *   此处不再重复渲染局部 NotificationPanel)
 */
/** 时间格式化(当天 HH:mm,跨天月-日;展示用,不参与排序) */
function formatConversationTime(input: string | undefined): string {
  if (!input) return ''
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}-${d.getDate()}`
}

export function MessageCenterScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<MessageCenterItem[]>([])
  const [activeTab, setActiveTab] = useState<MessageTab>('notice')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  // 会话列表(对齐 Uniapp message 页聊天列表 chatList,数据源 listConversations)
  const [conversations, setConversations] = useState<MessageConversationItem[]>([])
  // 搜索关键词(对齐 Uniapp message/index.vue L23-41 搜索栏 searchKeyword)
  const [searchKeyword, setSearchKeyword] = useState('')
  /** 2026-11-27 三端统一:点消息卡片 = 打开全文抽屉(不再把通知 id 丢给站内信详情页) */
  const [noticeDetail, setNoticeDetail] = useState<NoticeDetailData | null>(null)
  // 站内消息分页(GET /api/messages 返回 { list, total },page/pageSize 已由 schema 声明)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const tabs = useMemo(
    () => [
      { key: 'notice', label: t('menu.notificationList') },
      { key: 'comment', label: t('tagsPage.groupComment') },
      { key: 'fans', label: t('follow.fans') },
      { key: 'private-letter', label: t('messageDirect.title') },
    ],
    [t],
  )

  const load = useCallback(async () => {
    setError('')
    const noteUrl = notificationsUrl(activeTab, 1)
    try {
      const [msgRes, convRes] = await Promise.all([
        noteUrl ? fetchApi<MessagePage>(noteUrl) : Promise.resolve(null),
        fetchApi<{ list: ConversationListRow[] }>(
          `/api/messages/list?page=1&pageSize=${PAGE_SIZE}`,
        ),
      ])
      if (noteUrl) {
        if (!msgRes || !msgRes.success) throw new Error()
        setItems((msgRes.data.list ?? []).map((row) => toCenterItem(row, activeTab)))
        setTotal(msgRes.data.total ?? 0)
      } else {
        setItems([])
        setTotal(0)
      }
      setPage(1)
      // 会话列表与 Web /messages/private-letter 同源:GET /api/messages/list
      if (convRes.success && convRes.data) {
        const convList: ConversationListRow[] = Array.isArray(convRes.data.list)
          ? convRes.data.list
          : []
        setConversations(
          convList.map((c) => ({
            id: c.id,
            name: c.peerName || c.title || t('messageCenter.conversationFallback'),
            lastMessage: c.lastMessage || c.messages?.[0]?.content,
            time:
              c.lastTime || c.updatedAt
                ? formatConversationTime(c.lastTime ?? c.updatedAt)
                : undefined,
            unread: typeof c.unread === 'number' ? c.unread : undefined,
            pinned: c.pinned === true,
          })),
        )
      }
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab, t])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新;首次挂载由上面的 useEffect 负责)
  useRefreshOnFocus(load)

  const onSelectTab = (tab: MessageTab) => {
    if (tab !== activeTab) setActiveTab(tab)
  }

  // 点击消息卡片 → 全文抽屉(共享 NoticeDetailSheet)。此前 navigate('MessageDetail',{id})
  // 拿的是通知 id,详情页却查 edu_messages,两套 id 不同源 ⇒ 必然空/失败(2026-11-27 修复)。

  /**
   * 会话置顶/取消置顶(D20 G-11 端内接线):
   * 网络出口唯一 = @ihui/api-client setConversationPinned(PATCH /api/chat/conversations/:id,
   * requireAuth + 属主校验在先);成功 → 复用共享 sortPinnedFirst 的置顶优先稳定重排
   * (packages/shared/src/chat/conversation-pin,排序实现只有 conversation-org 一份);
   * 失败 → Alert 显式喊出,不得静默。文案键 messageCenter.pin/unpin/pinFailed/unpinFailed
   * 待主会话在 packages/i18n/messages/mobile-rn 登记(缺键暂时回显 key,已列入交付报告)。
   */
  const handleTogglePin = useCallback(
    async (conv: MessageConversationItem) => {
      const next = conv.pinned !== true
      const outcome = await togglePinnedItem(conversations, conv.id, next, setConversationPinned)
      if (outcome.ok) {
        setConversations(outcome.items)
      } else {
        appAlert(
          t('messageCenter.title'),
          t(next ? 'messageCenter.pinFailed' : 'messageCenter.unpinFailed'),
        )
      }
    },
    [conversations, t],
  )

  // 搜索过滤(对齐 Uniapp message 页搜索:按名称/内容包含匹配,过滤当前会话与消息列表)
  const keyword = searchKeyword.trim().toLowerCase()
  const filteredConversations = keyword
    ? conversations.filter(
        (c) =>
          c.name.toLowerCase().includes(keyword) ||
          (c.lastMessage ?? '').toLowerCase().includes(keyword),
      )
    : conversations
  const filteredItems = keyword
    ? items.filter(
        (it) =>
          it.title.toLowerCase().includes(keyword) || it.content.toLowerCase().includes(keyword),
      )
    : items

  /**
   * 标记单条通知已读:与 Web 消息页同一出口 PATCH /api/notifications/:id/read。
   */
  const handleMarkRead = useCallback(
    async (item: MessageCenterItem) => {
      try {
        const res = await markNotificationRead(item.id)
        if (!res.success) throw new Error()
        setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, read: true } : it)))
      } catch {
        appAlert(t('messageCenter.title'), t('common.failed'))
      }
    },
    [t],
  )

  /**
   * 打开消息全文(2026-11-27 三端统一口径):
   * 未读先走同一已读出口,再投影成共享详情数据;不再 navigate('MessageDetail')。
   */
  const onPressItem = useCallback(
    (item: MessageCenterItem) => {
      if (!item.read) void handleMarkRead(item)
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
    },
    [handleMarkRead],
  )

  /**
   * 删除会话:数据源就是 listConversations(chat_conversations),删除出口同源 =
   * @ihui/api-client deleteConversation(DELETE /api/chat/conversations/:id,级联删消息)。
   * 破坏性动作先经 appAlert(端内自绘确认层,非原生弹窗)二次确认,失败显式喊出。
   */
  const handleDeleteConversation = useCallback(
    (conv: MessageConversationItem) => {
      appAlert(t('messageCenter.title'), t('messageCenter.deleteConv'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const res = await deleteConversation(conv.id)
                if (!res.success) throw new Error()
                setConversations((prev) => prev.filter((c) => c.id !== conv.id))
              } catch {
                appAlert(t('messageCenter.title'), t('common.failed'))
              }
            })()
          },
        },
      ])
    },
    [t],
  )

  /**
   * 加载下一页通知:GET /api/notifications(与 Web 消息页同一查询)。
   * 私信 tab 没有通知分页。
   */
  const handleLoadMore = useCallback(async () => {
    if (loadingMore) return
    const noteUrl = notificationsUrl(activeTab, page + 1)
    if (!noteUrl) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const res = await fetchApi<MessagePage>(noteUrl)
      if (!res.success) throw new Error()
      const incoming = (res.data.list ?? []).map((row) => toCenterItem(row, activeTab))
      setItems((prev) => {
        const seen = new Set(prev.map((it) => it.id))
        return [...prev, ...incoming.filter((it) => !seen.has(it.id))]
      })
      setTotal(res.data.total ?? 0)
      setPage(nextPage)
    } catch {
      appAlert(t('messageCenter.title'), t('common.loadFailed'))
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, page, activeTab, t])

  const hasMore = total > 0 && items.length < total

  const { onToast } = useHostPorts()

  return (
    <>
      <SharedMessageCenterScreen
        t={t}
        items={filteredItems}
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={() => {
          setRefreshing(true)
          void load()
        }}
        onPressItem={onPressItem}
        conversations={filteredConversations}
        onPressConversation={(conv) =>
          navigation.navigate('Chat', { conversationId: conv.id, title: conv.name })
        }
        onTogglePin={(conv) => void handleTogglePin(conv)}
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
        tabs={tabs}
        conversationsTab="private-letter"
        search={{
          value: searchKeyword,
          placeholder: t('messageCenter.searchPh'),
          onChangeText: setSearchKeyword,
        }}
        onPressSettings={() => navigation.navigate('NotificationSettings')}
        onMarkRead={(item) => void handleMarkRead(item)}
        onDeleteConversation={handleDeleteConversation}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={() => void handleLoadMore()}
        emptyText={
          keyword
            ? t('messageCenter.notFound')
            : activeTab === 'private-letter'
              ? t('messageDirect.empty')
              : undefined
        }
        onToast={onToast}
      />
      {/* 全文抽屉三端同源:RN 与小程序共用 packages/app 的 NoticeDetailSheet */}
      <NoticeDetailSheet
        t={t}
        visible={noticeDetail !== null}
        detail={noticeDetail}
        onClose={() => setNoticeDetail(null)}
        onCopy={(detail) => {
          Clipboard.setString(noticeDetailCopyText(detail))
        }}
        // G2 深链与 Web「查看会话」同义:关闭抽屉后进对应会话(无 sessionId 时不渲染该按钮)
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
