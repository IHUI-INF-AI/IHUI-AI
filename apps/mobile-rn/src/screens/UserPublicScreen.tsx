// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 他人主页页(mobile-rn 端)—— 薄壳,渲染真相源在共享层
 * `packages/app/src/features/user-public/UserPublicScreen.tsx`(经 `@ihui/rn-app` 具名导出)。
 * 本文件只管平台侧:取数、导航、取词、主题、关注请求与 appAlert 提示、Intl 日期格式化。
 *
 * 端点按 web 基准(apps/web/app/(main)/user/[id]/PageClient.tsx)现读:
 *  - GET    /api/users/:id                 ⇒ { user, stats }
 *  - GET    /api/follows/:id/status        ⇒ { following }
 *  - POST   /api/follows/:id               ⇒ 关注
 *  - DELETE /api/follows/:id               ⇒ 取关
 *  - POST   /api/messages/conversations    ⇒ { conversation: { id } }
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { UserPublicScreen as SharedUserPublicScreen } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type UserPublicRoute = RouteProp<RootStackParamList, 'UserPublic'>

interface PublicUserRow {
  id: string
  nickname: string
  avatar?: string | null
  bio?: string | null
  createdAt?: string | null
}

interface UserResponse {
  user: PublicUserRow
  stats: { followingCount: number; followersCount: number; favoritesCount: number }
}

export function UserPublicScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<UserPublicRoute>()
  const userId = route.params?.userId ?? ''
  const { user: currentUser } = useAuth()

  const [user, setUser] = useState<PublicUserRow | null>(null)
  const [stats, setStats] = useState<UserResponse['stats'] | null>(null)
  const [following, setFollowing] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [followPending, setFollowPending] = useState(false)

  const fmtDate = useCallback(
    (iso: string | null) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return ''
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<UserResponse>(`/api/users/${userId}`)
      if (!res.success || !res.data?.user) throw new Error(res.error || 'load failed')
      setUser(res.data.user)
      setStats(res.data.stats ?? null)
      const st = await fetchApi<{ following: boolean }>(`/api/follows/${userId}/status`)
      if (st.success && st.data) setFollowing(st.data.following)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const onToggleFollow = useCallback(async () => {
    if (following === null) return
    setFollowPending(true)
    try {
      const res = await fetchApi(`/api/follows/${userId}`, {
        method: following ? 'DELETE' : 'POST',
      })
      if (!res.success) throw new Error(res.error)
      setFollowing(!following)
      void load()
    } catch (e) {
      void appAlert(t('common.error'), e instanceof Error ? e.message : t('common.retry'))
    } finally {
      setFollowPending(false)
    }
  }, [following, userId, load, t])

  const onMessage = useCallback(async () => {
    try {
      const res = await fetchApi<{ conversation: { id: string } }>('/api/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({ peerId: userId }),
      })
      if (!res.success || !res.data?.conversation?.id) throw new Error(res.error)
      navigation.navigate('Chat', { conversationId: res.data.conversation.id })
    } catch (e) {
      void appAlert(t('common.error'), e instanceof Error ? e.message : t('userPublic.message'))
    }
  }, [userId, navigation, t])

  return (
    <SharedUserPublicScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      user={user}
      stats={stats}
      following={following}
      followPending={followPending}
      isSelf={currentUser?.id === userId}
      onRetry={() => void load()}
      onToggleFollow={() => void onToggleFollow()}
      onMessage={() => void onMessage()}
      formatDate={fmtDate}
    />
  )
}

export default UserPublicScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
