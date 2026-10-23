// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * UserFansScreen 我的粉丝页(mobile-rn 端)—— 薄壳,渲染真相源在共享层
 * `packages/app/src/features/user-fans/UserFansScreen.tsx`(经 `@ihui/rn-app` 具名导出),
 * 本文件只管平台侧:取数、导航、取词、主题、回关请求与 appAlert 提示、Intl 日期格式化。
 *
 * 端点按 apps/api/src/routes/social.ts 现读:
 *  - GET  /api/follows/followers?page&pageSize ⇒ { list, total, page, pageSize }
 *  - GET  /api/follows/following?pageSize=100  ⇒ { list: { userId, ... }[] }
 *  - POST /api/follows/:userId                 ⇒ 201 { followed, isMutual }
 * 列表实列(followers 的 select)只有 id/userId/nickname/avatar/createdAt,
 * 没有 bio —— web 侧接口声明的 bio 是假字段,共享屏不渲染。
 */
import { useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import { UserFansScreen as SharedUserFansScreen, type UserFansRowView } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20
// 后端 paginationOnlyQuery 的 pageSize 上限为 100(web 侧传 200 会被 400 拒绝),此处取上限。
const FOLLOWING_PAGE_SIZE = 100

interface FanRow {
  id: string
  userId: string
  nickname: string | null
  avatar: string | null
  createdAt: string | null
}

export function UserFansScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [rows, setRows] = useState<FanRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)

  const fmtDate = useCallback(
    (iso: string | null) => {
      if (!iso) return '—'
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const loadFollowing = useCallback(async () => {
    try {
      const res = await fetchApi<{ list: { userId: string }[] }>(
        `/api/follows/following?page=1&pageSize=${FOLLOWING_PAGE_SIZE}`,
      )
      if (res.success) setFollowedIds(new Set((res.data?.list ?? []).map((u) => u.userId)))
    } catch {
      // 关注状态只影响按钮形态,取不到时不阻断粉丝列表
    }
  }, [])

  const loadFans = useCallback(async (targetPage: number, append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setFailed(false)
    try {
      const res = await fetchApi<{ list: FanRow[]; total: number }>(
        `/api/follows/followers?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      )
      if (!res.success) throw new Error(res.error)
      const list = res.data?.list ?? []
      setRows((prev) => (append ? [...prev, ...list] : list))
      setTotal(res.data?.total ?? 0)
    } catch {
      if (!append) {
        setRows([])
        setTotal(0)
      }
      setFailed(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    void loadFollowing()
  }, [loadFollowing])

  useEffect(() => {
    void loadFans(1, false)
  }, [loadFans])

  const onFollowBack = async (userId: string) => {
    setPendingId(userId)
    try {
      const res = await fetchApi(`/api/follows/${userId}`, { method: 'POST' })
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('userFans.actionFailed'))
        return
      }
      setFollowedIds((prev) => new Set(prev).add(userId))
      appAlert(t('common.hint'), t('userFans.followSuccess'))
    } catch {
      appAlert(t('common.error'), t('userFans.actionFailed'))
    } finally {
      setPendingId(null)
    }
  }

  const loadMore = async () => {
    if (loadingMore || rows.length >= total) return
    const next = page + 1
    await loadFans(next, true)
    setPage(next)
  }

  const viewRows: UserFansRowView[] = rows.map((fan) => ({
    id: fan.id,
    userId: fan.userId,
    nickname: fan.nickname ?? t('userFans.anonymous'),
    avatarUrl: fan.avatar,
    followedAtText: fmtDate(fan.createdAt),
    followed: followedIds.has(fan.userId),
  }))

  return (
    <View style={{ flex: 1 }}>
      <SharedUserFansScreen
        t={t}
        colorScheme={resolvedTheme}
        rows={viewRows}
        total={total}
        loading={loading}
        loadingMore={loadingMore}
        failed={failed}
        pendingUserId={pendingId}
        onBack={() => navigation.goBack()}
        onRetry={() => void loadFans(1, false)}
        onLoadMore={() => void loadMore()}
        onFollowBack={(userId: string) => void onFollowBack(userId)}
      />
    </View>
  )
}

export default UserFansScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
