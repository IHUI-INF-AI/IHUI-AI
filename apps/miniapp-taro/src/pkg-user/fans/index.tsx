// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/user-fans/UserFansScreen.tsx
import { useCallback, useEffect, useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import { followUser, getFollowers, getFollowing, type FollowerItem } from '@/api/social'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { formatDateByTemplate } from '@ihui/shared'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'
import { ScreenSkeleton } from '@/components/ScreenStates.taro'

const PAGE_SIZE = 20
// 后端 paginationOnlyQuery 的 pageSize 上限 100(传更大值会被 400 拒),取上限
const FOLLOWING_PAGE_SIZE = 100
const DEFAULT_AVATAR = '/static/default-avatar.png'

/**
 * 我的粉丝(小程序端)。段落与取词键对齐共享屏:标题 → 总数 → 粉丝行
 * (头像/昵称/关注时间/回关按钮) → 加载更多;三态:骨架屏 / 失败重试 / 空态。
 * 端点与 RN 端一致:GET /follows/followers(分页)、GET /follows/following(回关态)、
 * POST /follows/:userId(回关)。
 */
export default function FansPage() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()

  const [rows, setRows] = useState<FollowerItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [pendingId, setPendingId] = useState<string | null>(null)

  const loadFollowing = useCallback(async () => {
    try {
      const res = await getFollowing({ page: 1, pageSize: FOLLOWING_PAGE_SIZE })
      setFollowedIds(new Set((res.list ?? []).map((u) => u.username)))
    } catch (e) {
      // 回关态取不到只影响按钮形态,不阻断粉丝列表
      logger.error('pkg-user/fans', '加载关注态失败', e)
    }
  }, [])

  const loadFans = useCallback(async (targetPage: number, append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setFailed(false)
    try {
      const res = await getFollowers({ page: targetPage, pageSize: PAGE_SIZE })
      const list = res.list ?? []
      setRows((prev) => (append ? [...prev, ...list] : list))
      setTotal(res.total ?? list.length)
      setPage(targetPage)
    } catch (e) {
      logger.error('pkg-user/fans', '加载粉丝列表失败', e)
      setFailed(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (!gate.ready) return
    void loadFollowing()
    void loadFans(1, false)
  }, [gate.ready, loadFans, loadFollowing])

  useDidShow(() => {
    if (gate.ready) void loadFollowing()
  })

  useReachBottom(() => {
    if (loading || loadingMore) return
    if (rows.length >= total) return
    void loadFans(page + 1, true)
  })

  const onFollowBack = useCallback(
    async (userId: string) => {
      if (pendingId) return
      setPendingId(userId)
      try {
        await followUser(userId)
        setFollowedIds((prev) => new Set(prev).add(userId))
        Taro.showToast({ title: t('userFans.followSuccess'), icon: 'none' })
      } catch (e) {
        logger.error('pkg-user/fans', '回关失败', e)
        Taro.showToast({ title: t('userFans.actionFailed'), icon: 'none' })
      } finally {
        setPendingId(null)
      }
    },
    [pendingId, t],
  )

  const goBack = useCallback(() => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/user/index' }) })
  }, [])

  const fmtDate = (iso?: string | null): string => {
    if (!iso) return '—'
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '—' : formatDateByTemplate(iso, 'YYYY-MM-DD')
  }

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background pt-[calc(env(safe-area-inset-top)+8rpx)] pb-[48rpx]">
        <View className="flex items-center gap-[8rpx] px-[20rpx] py-[24rpx]">
          <View className="p-[16rpx] -m-[16rpx]" onClick={goBack} hoverClass="opacity-60">
            <LineIcon name="chevron-left" size={40} color="var(--color-foreground)" />
          </View>
          <Text className="text-[length:40rpx] font-bold text-foreground">
            {t('userFans.title')}
          </Text>
        </View>

        <View className="px-[24rpx] space-y-[16rpx]">
          {loading ? (
            <ScreenSkeleton variant="list" count={4} />
          ) : failed ? (
            <View className="flex flex-col items-center py-[64rpx] space-y-[20rpx]">
              <Text className="text-[length:28rpx] text-[var(--color-destructive)]">
                {t('userFans.loadFailed')}
              </Text>
              <View
                className="px-[32rpx] py-[14rpx] rounded-md border border-border"
                onClick={() => void loadFans(1, false)}
                hoverClass="opacity-60"
              >
                <Text className="text-[length:26rpx] text-foreground">{t('common.retry')}</Text>
              </View>
            </View>
          ) : rows.length === 0 ? (
            <View className="flex flex-col items-center py-[64rpx] space-y-[16rpx]">
              <LineIcon name="users" size={56} color="var(--color-text-tertiary)" />
              <Text className="text-[length:28rpx] text-muted-foreground">
                {t('userFans.empty')}
              </Text>
            </View>
          ) : (
            <>
              <Text className="block text-[length:24rpx] text-muted-foreground">
                {t('userFans.total', { total: String(total) })}
              </Text>
              <ScrollView scrollY className="space-y-[12rpx]">
                {rows.map((fan) => (
                  <View
                    key={fan.id}
                    className="flex flex-row items-center rounded-lg border border-border bg-card p-[24rpx]"
                  >
                    <Image
                      className="w-[88rpx] h-[88rpx] rounded-2xl flex-shrink-0"
                      src={fan.avatar || DEFAULT_AVATAR}
                      mode="aspectFill"
                    />
                    <View className="flex-1 ml-[20rpx] mr-[16rpx] min-w-0">
                      <Text className="block text-[length:30rpx] font-semibold text-foreground truncate">
                        {fan.nickname ?? t('userFans.anonymous')}
                      </Text>
                      <Text className="block text-[length:22rpx] text-[var(--color-text-tertiary)] mt-[12rpx]">
                        {`${t('userFans.followedAt')} ${fmtDate(fan.createdAt)}`}
                      </Text>
                    </View>
                    {followedIds.has(fan.userId) ? (
                      <View className="flex flex-row items-center gap-[6rpx] px-[16rpx] py-[6rpx] rounded-md bg-[var(--color-success-light)]">
                        <LineIcon name="check" size={24} color="var(--color-success)" />
                        <Text className="text-[length:22rpx] text-[var(--color-success)]">
                          {t('userFans.followed')}
                        </Text>
                      </View>
                    ) : (
                      <View
                        className={`flex flex-row items-center gap-[6rpx] px-[20rpx] py-[10rpx] rounded-md bg-cta ${pendingId ? 'opacity-50' : ''}`}
                        onClick={() => void onFollowBack(fan.userId)}
                        hoverClass="opacity-60"
                      >
                        <LineIcon name="plus" size={24} color="var(--color-cta-foreground)" />
                        <Text className="text-[length:24rpx] text-[var(--color-cta-foreground)]">
                          {t('userFans.follow')}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
              {rows.length < total ? (
                <View
                  className="flex items-center justify-center py-[24rpx]"
                  onClick={() => void loadFans(page + 1, true)}
                  hoverClass="opacity-60"
                >
                  <Text className="text-[length:26rpx] text-[var(--color-text-tertiary)]">
                    {loadingMore
                      ? t('common.loading')
                      : t('userFans.loadMore', {
                          loaded: String(rows.length),
                          total: String(total),
                        })}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
