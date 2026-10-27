// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  deletePrivateLetter,
  getPrivateLetterList,
  normalizeLetterRow,
  sendPrivateLetter,
} from '@ihui/api-client'
import { LetterChatScreen as SharedLetterChatScreen, type LetterChatMessageRow } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { formatLetterTime } from '../utils/letter-time'
import type { RootStackParamList } from '../navigation/RootNavigator'

/** 本票路由由 manifest 交集成方统一注册(禁改 RootNavigator),本地交叉类型补齐。 */
type ShellParams = RootStackParamList & {
  LetterChat: { memberId: string; memberName: string }
}
type NavigationProp = NativeStackNavigationProp<ShellParams>
type ChatRoute = RouteProp<ShellParams, 'LetterChat'>

/** 与 web ChatWindow 同参(page=1、pageSize=50、id=0 游标,ChatWindow.tsx:48-53) */
const FIRST_PAGE_SIZE = 50

/**
 * RN 端「私信会话内容」薄壳 —— 承载 web /letters 右栏 ChatWindow。渲染全部委托共享屏,
 * 本文件只管:取数(GET /api/private-letters/list)、发送(POST,清草稿+重取)、删除确认
 * (appAlert,与 CartScreen 同款先例;web 为 ConfirmDialog)、逐条删除(DELETE { id })。
 */
export function LetterChatScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<ChatRoute>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const memberId = route.params?.memberId ?? ''
  const memberName = route.params?.memberName ?? ''

  const [messages, setMessages] = useState<LetterChatMessageRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!user || !memberId) return
    setLoading(true)
    try {
      const res = await getPrivateLetterList({
        page: 1,
        pageSize: FIRST_PAGE_SIZE,
        senderId: memberId,
        id: 0,
      })
      if (!res.success || !res.data) {
        setError(res.error ?? t('lettersPage.error'))
        return
      }
      const currentUserId = res.data.currentUserId ?? ''
      setError(null)
      // 后端按 id 降序;inverted FlatList 取 data[0] 在底部 ⇒ 直接喂降序
      setMessages(
        (res.data.list ?? []).map((raw) => {
          const m = normalizeLetterRow(raw)
          return {
            id: m.id,
            content: m.content,
            timeText: formatLetterTime(m.createdAt),
            mine: m.senderId === currentUserId,
          }
        }),
      )
    } catch {
      setError(t('lettersPage.error'))
    } finally {
      setLoading(false)
    }
  }, [user, memberId, t])

  useEffect(() => {
    void load()
  }, [load])

  const send = useCallback(async () => {
    const content = draft.trim()
    if (!content || sending || !memberId) return
    setSending(true)
    setSendError(null)
    try {
      const res = await sendPrivateLetter({ receiverId: memberId, content })
      if (!res.success) {
        setSendError(res.error ?? t('lettersPage.error'))
        return
      }
      setDraft('')
      await load()
    } catch (e) {
      setSendError(e instanceof Error ? e.message : t('lettersPage.error'))
    } finally {
      setSending(false)
    }
  }, [draft, sending, memberId, load, t])

  const doDelete = useCallback(
    async (id: number) => {
      setDeletingId(id)
      try {
        const res = await deletePrivateLetter(id)
        if (!res.success) {
          setSendError(res.error ?? t('lettersPage.error'))
          return
        }
        // 本地移除该条(与 web setQueryData 过滤同口径)
        setMessages((prev) => prev.filter((m) => m.id !== id))
      } catch {
        setSendError(t('lettersPage.error'))
      } finally {
        setDeletingId(null)
      }
    },
    [t],
  )

  const requestDelete = useCallback(
    (message: LetterChatMessageRow) => {
      // 与 web ConfirmDialog 同文案(deleteConfirm/confirm/cancel),确认腿走 appAlert
      appAlert(t('lettersPage.delete'), t('lettersPage.deleteConfirm'), [
        { text: t('lettersPage.cancel'), style: 'cancel' },
        {
          text: t('lettersPage.confirm'),
          style: 'destructive',
          onPress: () => void doDelete(message.id),
        },
      ])
    },
    [t, doDelete],
  )

  return (
    <SharedLetterChatScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      memberName={memberName}
      loading={loading}
      error={error}
      messages={messages}
      draft={draft}
      onDraftChange={setDraft}
      sending={sending}
      sendError={sendError}
      deletingId={deletingId}
      onSend={() => void send()}
      onRequestDelete={requestDelete}
    />
  )
}

export default LetterChatScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
