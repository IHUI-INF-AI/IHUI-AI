// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getPrivateLetterMembers, normalizeLetterMemberRow } from '@ihui/api-client'
import { LettersScreen as SharedLettersScreen, type LetterConversationRow } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { formatLetterTime } from '../utils/letter-time'
import type { RootStackParamList } from '../navigation/RootNavigator'

/** 本票路由由 manifest 交集成方统一注册(禁改 RootNavigator),本地交叉类型补齐(与 Wave2 edu-ai 壳同款)。 */
type ShellParams = RootStackParamList & {
  LetterChat: { memberId: string; memberName: string }
}
type NavigationProp = NativeStackNavigationProp<ShellParams>

/** 与 web 同参:pageSize=100、会话列表 15s 自动刷新(letters/page.tsx:22/53) */
const PAGE_SIZE = 100
const REFRESH_INTERVAL_MS = 15_000

/**
 * RN 端「私信」会话列表薄壳 —— 承载 web /letters 左栏。渲染全部委托共享屏,本文件只管:
 * 取数(GET /api/private-letters/members,昵称关键词 300ms 防抖 + 15s 轮询,与 web 同参)、
 * 登录门(与 web useAuthGate 同口径)、点会话 push LetterChat(web 双栏在移动端拆两屏)。
 */
export function LettersScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [keyword, setKeyword] = useState('')
  const [debounced, setDebounced] = useState('')
  const [rows, setRows] = useState<LetterConversationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 与 web 同款 300ms 防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword), 300)
    return () => clearTimeout(timer)
  }, [keyword])

  useEffect(() => {
    if (!user) return
    let alive = true
    const load = async (showLoading: boolean) => {
      if (showLoading) setLoading(true)
      try {
        const res = await getPrivateLetterMembers({
          page: 1,
          pageSize: PAGE_SIZE,
          memberNameKeyword: debounced || undefined,
        })
        if (!alive) return
        if (!res.success || !res.data) {
          setError(res.error ?? t('lettersPage.error'))
          return
        }
        setError(null)
        setRows(
          (res.data.list ?? []).map((raw) => {
            const m = normalizeLetterMemberRow(raw)
            return {
              counterpartId: m.counterpartId,
              counterpartName: m.counterpartName,
              preview: m.letter.content,
              timeText: formatLetterTime(m.letter.createdAt),
              // 未读:该条未读且是对方发来的(web isUnread 同口径)
              unread: !m.letter.isRead && m.letter.senderId === m.counterpartId,
            }
          }),
        )
      } catch {
        if (alive) setError(t('lettersPage.error'))
      } finally {
        if (alive && showLoading) setLoading(false)
      }
    }
    void load(true)
    // 15s 自动刷新(web refetchInterval: 15000)
    const interval = setInterval(() => void load(false), REFRESH_INTERVAL_MS)
    return () => {
      alive = false
      clearInterval(interval)
    }
  }, [user, debounced, t])

  const onPressConversation = useCallback(
    (counterpartId: string, counterpartName: string) => {
      navigation.push('LetterChat', { memberId: counterpartId, memberName: counterpartName })
    },
    [navigation],
  )

  return (
    <SharedLettersScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t('lettersPage.loginRequired')}
      keyword={keyword}
      onKeywordChange={setKeyword}
      loading={!user ? false : loading}
      error={error}
      rows={rows}
      onPressConversation={onPressConversation}
    />
  )
}

export default LettersScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
