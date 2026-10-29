// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useState } from 'react'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  ChatWorkbenchScreen as SharedChatWorkbenchScreen,
  type ChatWorkbenchConversationItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** GET /api/chat/conversations 的响应(与 web 工作台 use-workbench-conversations 同出口、同 pageSize=100 档) */
interface ConversationsResponse {
  conversations: Array<{
    id: string
    title: string
    model?: string
    lastMessageAt: string
    messageCount?: number
    pinned?: boolean
  }>
}

/**
 * RN 端「聊天工作台」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/chat-workbench/ChatWorkbenchScreen.tsx`,本文件只管平台侧:
 * 取数(GET /api/chat/conversations?pageSize=100,与 web 工作台同一出口)、
 * 选会话与新建都跳既有 Chat 屏(移动端对话本体由 ChatScreen 承载,不是本屏)。
 *
 * 刻意不接:web 侧的分屏窗格与大屏模式 —— 前者是 DOM 指针手势 + 端内 zustand,
 * 后者是 localStorage 偏好 + documentElement 属性,移动端都没有对应承载体。
 */
export function ChatWorkbenchScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [conversations, setConversations] = useState<ChatWorkbenchConversationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetchApi<ConversationsResponse>('/api/chat/conversations', {
        params: { pageSize: 100 },
      })
      if (!res.success) {
        setError(t('chat.loadFailed'))
        return
      }
      setConversations(
        (res.data?.conversations ?? []).map((c) => ({
          id: c.id,
          title: c.title,
          model: c.model,
          lastMessageAt: c.lastMessageAt,
          messageCount: c.messageCount,
          pinned: c.pinned,
        })),
      )
    } catch {
      setError(t('chat.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  return (
    <SharedChatWorkbenchScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      conversations={conversations}
      loading={loading}
      error={error}
      keyword={keyword}
      onKeywordChange={setKeyword}
      onSelectConversation={(conversationId) => navigation.navigate('Chat', { conversationId })}
      onNewConversation={() => navigation.navigate('Chat', {})}
      onRefresh={() => void load()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
