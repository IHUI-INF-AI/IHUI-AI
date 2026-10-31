// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/live-detail/LiveDetailScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text, Video } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { get, subscribeLive } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'
import { ErrorState, ScreenSkeleton } from '@/components/ScreenStates.taro'
import { formatDate } from '@/utils/time'
import { LiveIntro, projectChannel, type LiveChannelRow, type LiveDetail } from './detail-sections'

export default function LiveDetail() {
  const { t } = useI18n()
  const router = useRouter()
  const [live, setLive] = useState<LiveDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  const loadDetail = useCallback(
    async (id: string | number) => {
      setLoading(true)
      setError('')
      try {
        const res = await get<{ channel: LiveChannelRow }>(`/live/channels/${id}`)
        setLive(projectChannel(res.channel))
      } catch {
        // 对齐 RN:错误态统一由 ErrorState 呈现(message 取 error,缺省落 liveDetail.empty)
        setError(t('live.detail.loadFailed'))
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    const id = router.params.id || ''
    if (!id) {
      setLoading(false)
      return
    }
    loadDetail(id)
  }, [router.params.id, loadDetail])

  useShareAppMessage(() => ({
    title: live ? t('share.liveTitle', { title: live.title }) : t('share.appTitle'),
    path: router.path ? `${router.path}?id=${router.params.id || ''}` : '/pkg-learn/live/detail',
    imageUrl: live?.coverUrl || '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: live ? t('share.liveTitle', { title: live.title }) : t('share.timelineTitle'),
    query: `id=${router.params.id || ''}`,
  }))

  const enterLive = useCallback(() => {
    if (!live) return
    if (live.status === 'upcoming') {
      Taro.showToast({ title: t('live.detail.notStarted'), icon: 'none' })
      return
    }
    if (live.status === 'ended') {
      Taro.showToast({ title: t('live.detail.ended'), icon: 'none' })
      return
    }
    Taro.showToast({ title: t('live.detail.connecting'), icon: 'loading' })
  }, [live, t])

  const handleSubscribe = useCallback(async () => {
    if (!live || subscribed || subscribing) return
    setSubscribing(true)
    try {
      await subscribeLive(live.id)
      setSubscribed(true)
      Taro.showToast({ title: t('live.subscribe.subscribeSuccess'), icon: 'success' })
    } catch {
      Taro.showToast({ title: t('live.subscribe.loadFailed'), icon: 'none' })
    } finally {
      setSubscribing(false)
    }
  }, [live, subscribed, subscribing, t])

  if (!live) {
    return (
      <ThemeRoot>
        <View className="min-h-screen bg-[var(--color-background)]">
          {loading ? (
            <ScreenSkeleton variant="list" count={4} />
          ) : (
            <ErrorState
              message={error || t('liveDetail.empty')}
              onRetry={() => {
                const id = router.params.id || ''
                if (id) loadDetail(id)
              }}
              retryLabel={t('common.retry')}
            />
          )}
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
      {/* 对齐 RN shared LiveDetailScreen container(tk.surface.bg → var(--color-background)) */}
      <View className="min-h-screen bg-[var(--color-background)]">
        {/* 对齐 RN header:标题(22dp → 44rpx semibold)+ 徽章行(gap 8 → 16rpx)
            注:RN header paddingTop 48 为补偿 RN 端 NavBar,小程序原生导航栏已占位,不再重复 */}
        <View className="px-[20rpx] pt-[16rpx] pb-[16rpx]">
          <Text className="mt-[16rpx] text-[length:44rpx] font-semibold text-foreground">
            {live.title}
          </Text>
          <View className="flex flex-wrap gap-[16rpx] mt-[16rpx]">
            <View
              className={`px-[16rpx] py-[4rpx] rounded-xl ${
                live.status === 'living'
                  ? 'bg-[var(--color-danger)]'
                  : live.status === 'upcoming'
                    ? 'bg-[var(--color-warning-amber)]'
                    : 'bg-[var(--color-text-tertiary)]'
              }`}
            >
              <Text className="text-caption text-[var(--color-primary-foreground)]">
                {live.status === 'living'
                  ? t('liveDetail.ongoing')
                  : live.status === 'upcoming'
                    ? t('liveDetail.upcoming')
                    : t('live.detail.ended')}
              </Text>
            </View>
            {live.anchor && (
              <View className="px-[16rpx] py-[4rpx] ui-chip rounded-md bg-[var(--color-card)]">
                <Text className="text-caption text-muted-foreground">
                  {t('liveDetail.lecturer')}:{live.anchor}
                </Text>
              </View>
            )}
            {live.watchCount !== undefined ? (
              <View className="px-[16rpx] py-[4rpx] ui-chip rounded-md bg-[var(--color-card)]">
                <Text className="text-caption text-muted-foreground">
                  {t('liveDetail.viewerCount', { count: live.watchCount })}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* 对齐 RN videoArea:16:9 纯黑底 + 居中播放图标(750rpx 宽的 16:9 = 422rpx 高) */}
        <View className="w-full h-[422rpx] bg-[var(--color-black)]">
          {live.playUrl ? (
            <Video
              className="w-full h-full"
              src={live.playUrl}
              autoplay
              controls
              objectFit="contain"
            />
          ) : (
            <View
              className="relative w-full h-full flex flex-col items-center justify-center"
              onClick={enterLive}
              hoverClass="opacity-60"
            >
              <LineIcon name="play" size={56} color="var(--color-surface-light)" />
              {live.status === 'living' && (
                <View className="mt-[24rpx] px-[20rpx] py-[20rpx] rounded-xl bg-primary flex items-center justify-center">
                  <Text className="text-[length:32rpx] font-semibold text-[var(--color-primary-foreground)]">
                    {t('live.detail.enter')}
                  </Text>
                </View>
              )}
              {live.status === 'ended' && (
                <View className="mt-[24rpx] flex flex-col items-center">
                  <Text className="text-body text-[var(--color-surface-light)]">
                    {t('live.detail.ended')}
                  </Text>
                </View>
              )}
              {live.status === 'upcoming' && (
                <View className="mt-[24rpx] flex flex-col items-center">
                  <Text className="text-body text-[var(--color-surface-light)]">
                    {t('live.detail.notStarted')}
                  </Text>
                  {live.startTime && (
                    <Text className="mt-[16rpx] text-label text-[var(--color-surface-light)] opacity-80">
                      {formatDate(live.startTime)}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* 对齐 RN subscribeSection:paddingHorizontal 10 → 20rpx,paddingVertical 12 → 24rpx */}
        <View className="px-[20rpx] py-[24rpx]">
          {subscribed ? (
            <View className="p-[24rpx] rounded-xl bg-[var(--color-success-lighter)]">
              <View className="flex items-center">
                {/* 已订阅勾选:原勾字符 → LineIcon。取值即该字符实际渲染档位:
                    原类名 text-[length:28rpx] → size 28,text-[var(--color-success-deep-text)]
                    → color 同 token;line-height 对 mask 载体无效故不保留。 */}
                <LineIcon name="check" size={28} color="var(--color-success-deep-text)" />
                <Text className="ml-[8rpx] text-body text-[var(--color-success-deep-text)]">
                  {t('liveDetail.subscribed')}
                </Text>
              </View>
            </View>
          ) : live.status === 'upcoming' ? (
            <View
              className={`px-[20rpx] py-[20rpx] rounded-xl bg-primary flex items-center justify-center ${
                subscribing ? 'opacity-50' : ''
              }`}
              onClick={handleSubscribe}
              hoverClass="opacity-60"
            >
              <Text className="text-[length:32rpx] font-semibold text-[var(--color-primary-foreground)]">
                {subscribing ? t('liveDetail.subscribing') : t('liveDetail.subscribe')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 对齐 RN introSection(介绍区;互动区聊天腿已按假绿纪律下线,见 ./detail-sections 头注) */}
        <LiveIntro intro={live.intro} />
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
