// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/user-public/UserPublicScreen.tsx
// 样式对齐 RN 共享 UserPublicScreen:语义档类名与 RN token 同源(px×2=rpx,80px 头像=160rpx 等)。
// 平台侧职责与 RN 薄壳同:GET /api/users/:id、GET /api/follows/:id/status、
// POST/DELETE /api/follows/:id、POST /api/messages/conversations。
import { useCallback, useState } from 'react'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { get, post } from '@/api'
import { followUser, unfollowUser } from '@/api/social'
import { useI18n } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import { EmptyState, ScreenSkeleton } from '@/components/ScreenStates.taro'
import BackChevron from '@/components/BackChevron'

interface PublicUserRow {
  id: string
  nickname: string
  avatar?: string | null
  bio?: string | null
  createdAt?: string | null
}

interface UserStats {
  followingCount: number
  followersCount: number
  favoritesCount: number
}

export default function UserPublicPage() {
  const { t, locale } = useI18n()
  const [user, setUser] = useState<PublicUserRow | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [following, setFollowing] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)

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
    const userId = Taro.getCurrentInstance().router?.params?.userId ?? ''
    if (!userId) return
    setLoading(true)
    setFailed(false)
    try {
      const res = await get<{ user: PublicUserRow; stats: UserStats }>(`/users/${userId}`)
      setUser(res.user ?? null)
      setStats(res.stats ?? null)
      const st = await get<{ following: boolean }>(`/follows/${userId}/status`)
      setFollowing(st.following)
    } catch {
      setFailed(true)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    void load()
  })

  const onToggleFollow = useCallback(async () => {
    const userId = user?.id
    if (!userId || following === null) return
    setPending(true)
    try {
      if (following) await unfollowUser(userId)
      else await followUser(userId)
      setFollowing(!following)
      void load()
    } catch {
      Taro.showToast({ title: t('common.error'), icon: 'none' })
    } finally {
      setPending(false)
    }
  }, [user, following, load, t])

  const onMessage = useCallback(async () => {
    const userId = user?.id
    if (!userId) return
    try {
      const res = await post<{ conversation: { id: string } }>('/messages/conversations', {
        peerId: userId,
      })
      Taro.navigateTo({ url: `/pkg-ai/ai/chat?conversationId=${res.conversation.id}` })
    } catch {
      Taro.showToast({ title: t('userPublic.message'), icon: 'none' })
    }
  }, [user, t])

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background p-4">
        <View className="flex items-center gap-3 py-3">
          <BackChevron />
          <Text className="text-xl font-bold text-foreground">{t('userPublic.title')}</Text>
        </View>

        {loading ? (
          <ScreenSkeleton variant="card" />
        ) : failed ? (
          <View className="py-8 text-center">
            <Text className="text-sm text-muted-foreground">{t('common.loadFailed')}</Text>
            <Button className="mt-3" size="mini" onClick={() => void load()}>
              {t('common.retry')}
            </Button>
          </View>
        ) : !user ? (
          <EmptyState title={t('userPublic.notFound')} />
        ) : (
          <View className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
            <View className="flex items-start gap-4">
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  className="w-[80px] h-[80px] rounded-2xl bg-muted"
                  mode="aspectFill"
                />
              ) : (
                <View className="w-[80px] h-[80px] rounded-2xl bg-muted flex items-center justify-center">
                  <Text className="text-2xl font-bold text-muted-foreground">
                    {(user.nickname ?? '').trim().slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View className="flex-1 min-w-0 space-y-1">
                <Text className="text-xl font-bold text-foreground">{user.nickname}</Text>
                {user.bio ? (
                  <Text className="text-sm text-muted-foreground">{user.bio}</Text>
                ) : null}
                {user.createdAt ? (
                  <Text className="text-xs text-muted-foreground">
                    {t('userPublic.joined')} {fmtDate(user.createdAt)}
                  </Text>
                ) : null}
              </View>
            </View>

            {stats ? (
              <View className="grid grid-cols-3 gap-3">
                <View className="rounded-lg border border-border bg-muted/40 px-3 py-3 flex flex-col items-center gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    {stats.followingCount}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t('userPublic.followingCount')}
                  </Text>
                </View>
                <View className="rounded-lg border border-border bg-muted/40 px-3 py-3 flex flex-col items-center gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    {stats.followersCount}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t('userPublic.followersCount')}
                  </Text>
                </View>
                <View className="rounded-lg border border-border bg-muted/40 px-3 py-3 flex flex-col items-center gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    {stats.favoritesCount}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {t('userPublic.favoritesCount')}
                  </Text>
                </View>
              </View>
            ) : null}

            <View className="flex gap-2 mt-1">
              <Button
                className="flex-1 bg-cta text-cta-foreground rounded-md text-sm font-semibold"
                disabled={pending || following === null}
                onClick={() => void onToggleFollow()}
              >
                {following ? t('userPublic.following') : t('userPublic.follow')}
              </Button>
              <Button
                className="flex-1 bg-muted rounded-md text-sm font-semibold text-foreground"
                onClick={() => void onMessage()}
              >
                {t('userPublic.message')}
              </Button>
            </View>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
