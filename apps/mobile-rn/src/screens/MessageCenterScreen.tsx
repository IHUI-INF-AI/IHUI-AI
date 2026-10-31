// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { appAlert } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  deleteConversation,
  fetchApi,
  listConversations,
  markMessageRead,
  setConversationPinned,
} from '@ihui/api-client'
import { togglePinnedItem } from '@ihui/shared/chat/conversation-pin'
import { MessageCenterScreen as SharedMessageCenterScreen } from '@ihui/rn-app'
import type { MessageCenterItem, MessageConversationItem, MessageTab } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useRefreshOnFocus } from '../hooks'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface MessagePage {
  list: MessageCenterItem[]
  total: number
}

/** 与 load / handleLoadMore 共用同一页大小;后端默认 20,显式下发避免两处口径漂移 */
const PAGE_SIZE = 20

/**
 * 对齐 Uniapp pagesA/message/index.vue(消息):
 * - 标题「消息」:Uniapp navigation-bars title 逐字对齐(shared 默认「消息中心」)
 * - 单导航栏:移除 wrapper 层 NavBar,消除与 shared header 的双标题栏
 *   (Uniapp 仅一层 navigation-bars;推送通知面板已由 RootNavigator 全局挂载,
 *   此处不再重复渲染局部 NotificationPanel)
 */
const UNIAPP_TEXT: Record<string, string> = {
  'messageCenter.title': '消息',
  'messageCenter.empty': '暂无消息',
}

/** listConversations 返回项(对齐 @ihui/api-client ConversationDetail 字段) */
interface ConversationItem {
  id: string
  title: string
  lastMessage?: string
  lastMessageAt?: string
  updatedAt?: string
  /** 未读数(对齐 Uniapp message 页 chat-item unreadCount;后端返回时透传,shared 据此渲染未读徽章) */
  unread?: number
  /** 是否置顶(chat_conversations.pinned;列表接口本就按置顶优先排序返回) */
  pinned?: boolean
}

/** 时间格式化(对齐 Uniapp formatDateHistory 的 HH:mm 展示,跨天显示日期) */
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
  const [activeTab, setActiveTab] = useState<MessageTab>('system')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  // 会话列表(对齐 Uniapp message 页聊天列表 chatList,数据源 listConversations)
  const [conversations, setConversations] = useState<MessageConversationItem[]>([])
  // 搜索关键词(对齐 Uniapp message/index.vue L23-41 搜索栏 searchKeyword)
  const [searchKeyword, setSearchKeyword] = useState('')
  // 站内消息分页(GET /api/messages 返回 { list, total },page/pageSize 已由 schema 声明)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  // t 包装:Uniapp 对齐文案优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) => UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      const [msgRes, convRes] = await Promise.all([
        fetchApi<MessagePage>(`/api/messages?type=${activeTab}&page=1&pageSize=${PAGE_SIZE}`),
        listConversations({ page: 1, pageSize: 20 }),
      ])
      if (!msgRes.success) throw new Error()
      setItems(msgRes.data.list ?? [])
      // total 是「加载更多」的唯一判据(后端 findEduMessages 同时回 list 与 total)
      setTotal(msgRes.data.total ?? 0)
      setPage(1)
      // 会话列表(listConversations 返回 { conversations },字段 title/lastMessageAt/updatedAt)
      if (convRes.success && convRes.data) {
        const convList: ConversationItem[] = Array.isArray(convRes.data.conversations)
          ? (convRes.data.conversations as unknown as ConversationItem[])
          : []
        setConversations(
          convList.map((c) => ({
            id: c.id,
            name: c.title || t('messageCenter.conversationFallback'),
            lastMessage: c.lastMessage,
            time:
              (c.lastMessageAt ?? c.updatedAt)
                ? formatConversationTime(c.lastMessageAt ?? c.updatedAt)
                : undefined,
            // 未读数透传(对齐 Uniapp L198 unread-badge:unreadCount>0 显示红点;shared convUnread 渲染 99+ 截断)
            unread: c.unread,
            // 置顶态透传(D20 G-11):排序出口见 handleTogglePin
            pinned: c.pinned === true,
          })),
        )
      }
    } catch {
      setError(uniappT('messageCenter.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab, uniappT, t])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  // 回屏即重取(对齐小程序 useDidShow 的每次显示刷新;首次挂载由上面的 useEffect 负责)
  useRefreshOnFocus(load)

  const onSelectTab = (tab: MessageTab) => {
    if (tab !== activeTab) setActiveTab(tab)
  }

  // 点击消息卡片 → 消息详情(MessageDetail 路由在 RootStack,React Navigation 自动向上搜索)
  const onPressItem = (item: MessageCenterItem) => {
    navigation.navigate('MessageDetail', { id: item.id })
  }

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
          uniappT('messageCenter.title'),
          t(next ? 'messageCenter.pinFailed' : 'messageCenter.unpinFailed'),
        )
      }
    },
    [conversations, uniappT, t],
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
   * 标记单条站内消息已读:网络出口 = @ihui/api-client markMessageRead
   * (PUT /api/messages/:id/read,后端按 memberId 校验属主);成功后只回写真行,
   * 失败 appAlert 显式喊出,不做「先翻 UI 再补请求」的假成功。
   */
  const handleMarkRead = useCallback(
    async (item: MessageCenterItem) => {
      try {
        const res = await markMessageRead(item.id)
        if (!res.success) throw new Error()
        setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, read: true } : it)))
      } catch {
        appAlert(uniappT('messageCenter.title'), t('common.failed'))
      }
    },
    [t, uniappT],
  )

  /**
   * 删除会话:数据源就是 listConversations(chat_conversations),删除出口同源 =
   * @ihui/api-client deleteConversation(DELETE /api/chat/conversations/:id,级联删消息)。
   * 破坏性动作先经 appAlert(端内自绘确认层,非原生弹窗)二次确认,失败显式喊出。
   */
  const handleDeleteConversation = useCallback(
    (conv: MessageConversationItem) => {
      appAlert(uniappT('messageCenter.title'), t('messageCenter.deleteConv'), [
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
                appAlert(uniappT('messageCenter.title'), t('common.failed'))
              }
            })()
          },
        },
      ])
    },
    [t, uniappT],
  )

  /**
   * 加载下一页站内消息:GET /api/messages 本就分页(page/pageSize/total 均在 schema 内),
   * 以 items.length < total 作 hasMore;按 id 去重防重入追加;失败喊出而不是静默吞掉。
   */
  const handleLoadMore = useCallback(async () => {
    if (loadingMore) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const res = await fetchApi<MessagePage>(
        `/api/messages?type=${activeTab}&page=${nextPage}&pageSize=${PAGE_SIZE}`,
      )
      if (!res.success) throw new Error()
      const incoming = res.data.list ?? []
      setItems((prev) => {
        const seen = new Set(prev.map((it) => it.id))
        return [...prev, ...incoming.filter((it) => !seen.has(it.id))]
      })
      setTotal(res.data.total ?? 0)
      setPage(nextPage)
    } catch {
      appAlert(uniappT('messageCenter.title'), t('messageCenter.loadFailed'))
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, page, activeTab, t, uniappT])

  const hasMore = total > 0 && items.length < total

  return (
    <SharedMessageCenterScreen
      t={uniappT}
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
        navigation.navigate('MessageChat', { peerId: conv.id, name: conv.name })
      }
      onTogglePin={(conv) => void handleTogglePin(conv)}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
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
      emptyText={keyword ? t('messageCenter.notFound') : undefined}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
