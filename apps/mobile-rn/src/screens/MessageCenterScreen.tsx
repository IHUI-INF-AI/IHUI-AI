import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, listConversations } from '@ihui/api-client'
import { MessageCenterScreen as SharedMessageCenterScreen } from '@ihui/rn-app'
import type { MessageCenterItem, MessageConversationItem, MessageTab } from '@ihui/rn-app'
import { SearchInput } from '../components/SearchInput'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface MessagePage {
  list: MessageCenterItem[]
  total: number
}

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

/** 搜索栏样式(对齐 Uniapp message/index.vue L23-41 搜索栏:胶囊容器 + 内部 SearchInput) */
const searchStyles = StyleSheet.create({
  bar: {
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(16),
  },
})

/** listConversations 返回项(对齐 @ihui/api-client ConversationDetail 字段) */
interface ConversationItem {
  id: string
  title: string
  lastMessage?: string
  lastMessageAt?: string
  updatedAt?: string
  /** 未读数(对齐 Uniapp message 页 chat-item unreadCount;后端返回时透传,shared 据此渲染未读徽章) */
  unread?: number
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

  // t 包装:Uniapp 对齐文案优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) => UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      const [msgRes, convRes] = await Promise.all([
        fetchApi<MessagePage>(`/api/messages?type=${activeTab}`),
        listConversations({ page: 1, pageSize: 20 }),
      ])
      if (!msgRes.success) throw new Error()
      setItems(msgRes.data.list ?? [])
      // 会话列表(listConversations 返回 { conversations },字段 title/lastMessageAt/updatedAt)
      if (convRes.success && convRes.data) {
        const convList: ConversationItem[] = Array.isArray(convRes.data.conversations)
          ? (convRes.data.conversations as unknown as ConversationItem[])
          : []
        setConversations(
          convList.map((c) => ({
            id: c.id,
            name: c.title || '对话',
            lastMessage: c.lastMessage,
            time: (c.lastMessageAt ?? c.updatedAt)
              ? formatConversationTime(c.lastMessageAt ?? c.updatedAt)
              : undefined,
            // 未读数透传(对齐 Uniapp L198 unread-badge:unreadCount>0 显示红点;shared convUnread 渲染 99+ 截断)
            unread: c.unread,
          })),
        )
      }
    } catch {
      setError(uniappT('messageCenter.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab, uniappT])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const onSelectTab = (tab: MessageTab) => {
    if (tab !== activeTab) setActiveTab(tab)
  }

  // 点击消息卡片 → 消息详情(MessageDetail 路由在 RootStack,React Navigation 自动向上搜索)
  const onPressItem = (item: MessageCenterItem) => {
    navigation.navigate('MessageDetail', { id: item.id })
  }

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
          it.title.toLowerCase().includes(keyword) ||
          it.content.toLowerCase().includes(keyword),
      )
    : items

  return (
    <View style={{ flex: 1 }}>
      {/* 顶部搜索框(对齐 Uniapp message L23-41 搜索栏,placeholder 同原 L38;
          shared 屏组件无搜索插槽,wrapper 层渲染并过滤列表;原页无语音入口故 voiceEnabled 关闭) */}
      <View style={searchStyles.bar}>
        <SearchInput
          value={searchKeyword}
          onChangeText={setSearchKeyword}
          placeholder="搜索聊天记录/联系人/服务号"
          voiceEnabled={false}
        />
      </View>
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
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
      />
    </View>
  )
}
