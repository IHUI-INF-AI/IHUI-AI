// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, useTt } from '@/i18n'
import { View, Text, Video } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getLiveDetail, subscribeLive, type Live } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

const STATUS_KEY: Record<Live['status'], { key: string; fb: string }> = {
  living: { key: 'live.liveNow', fb: '直播中' },
  upcoming: { key: 'live.preview', fb: '预告' },
  ended: { key: 'live.ended', fb: '已结束' },
}

export default function LiveDetail() {
  const { t } = useI18n()
  const tt = useTt()
  const router = useRouter()
  const [live, setLive] = useState<Live | null>(null)
  const [subscribed, setSubscribed] = useState(false)

  const loadDetail = useCallback(
    async (id: string | number) => {
      try {
        const res = await getLiveDetail(id)
        setLive(res)
      } catch {
        Taro.showToast({ title: t('live.detail.loadFailed'), icon: 'none' })
      }
    },
    [t],
  )

  useEffect(() => {
    const id = router.params.id || ''
    if (id) loadDetail(id)
  }, [router.params.id, loadDetail])

  useShareAppMessage(() => ({
    title: live ? t('share.liveTitle', { title: live.title }) : t('share.appTitle'),
    path: router.path ? `${router.path}?id=${router.params.id || ''}` : '/pages/live/detail',
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
    if (!live || subscribed) return
    try {
      await subscribeLive(live.id)
      setSubscribed(true)
      Taro.showToast({ title: t('live.subscribe.subscribeSuccess'), icon: 'success' })
    } catch {
      Taro.showToast({ title: t('live.subscribe.loadFailed'), icon: 'none' })
    }
  }, [live, subscribed, t])

  if (!live) {
    return (
      <ThemeRoot>
        <View className="flex items-center justify-center h-screen p-[32rpx] text-muted-foreground">
          <Text>{t('live.detail.loading')}</Text>
        </View>
      </ThemeRoot>
    )
  }

  const statusCfg = STATUS_KEY[live.status]

  return (
    <ThemeRoot>
      {/* 对齐 RN shared LiveDetailScreen container(tk.surface.bg → var(--color-background)) */}
      <View className="min-h-screen bg-[var(--color-background)]">
        {/* 对齐 RN header:标题(22dp → 44rpx semibold)+ 徽章行(gap 8 → 16rpx)
            注:RN header paddingTop 48 为补偿 RN 端 NavBar,小程序原生导航栏已占位,不再重复 */}
        <View className="px-[20rpx] pt-[16rpx] pb-[16rpx]">
          <Text className="mt-[16rpx] text-[44rpx] font-semibold text-foreground">
            {live.title}
          </Text>
          <View className="flex flex-wrap gap-[16rpx] mt-[16rpx]">
            <View
              className={`px-[16rpx] py-[4rpx] rounded-[24rpx] ${
                live.status === 'living'
                  ? 'bg-[var(--color-danger)]'
                  : live.status === 'upcoming'
                    ? 'bg-[var(--color-warning-amber)]'
                    : 'bg-[var(--color-text-tertiary)]'
              }`}
            >
              <Text className="text-[22rpx] text-[var(--color-primary-foreground)]">
                {tt(statusCfg.key, statusCfg.fb)}
              </Text>
            </View>
            {live.anchor && (
              <View className="px-[16rpx] py-[4rpx] rounded-[24rpx] bg-[var(--color-card)]">
                <Text className="text-[22rpx] text-muted-foreground">
                  {t('live.detail.anchor', { name: live.anchor })}
                </Text>
              </View>
            )}
            {live.watchCount !== undefined ? (
              <View className="px-[16rpx] py-[4rpx] rounded-[24rpx] bg-[var(--color-card)]">
                <Text className="text-[22rpx] text-muted-foreground">
                  {t('live.viewers', { n: live.watchCount })}
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
              <Text className="text-[48rpx] leading-none text-[var(--color-surface-light)]">▶</Text>
              {live.status === 'living' && (
                <View className="mt-[24rpx] px-[20rpx] py-[20rpx] rounded-[24rpx] bg-primary flex items-center justify-center">
                  <Text className="text-[32rpx] font-semibold text-[var(--color-primary-foreground)]">
                    {t('live.detail.enter')}
                  </Text>
                </View>
              )}
              {live.status === 'ended' && (
                <View className="mt-[24rpx] flex flex-col items-center">
                  <Text className="text-[28rpx] text-[var(--color-surface-light)]">
                    {t('live.detail.ended')}
                  </Text>
                </View>
              )}
              {live.status === 'upcoming' && (
                <View className="mt-[24rpx] flex flex-col items-center">
                  <Text className="text-[28rpx] text-[var(--color-surface-light)]">
                    {t('live.detail.notStarted')}
                  </Text>
                  {live.startTime && (
                    <Text className="mt-[16rpx] text-[24rpx] text-[var(--color-surface-light)] opacity-80">
                      {live.startTime}
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
            <View className="p-[24rpx] rounded-[24rpx] bg-[var(--color-success-lighter)]">
              <View className="flex items-center">
                <Text className="text-[28rpx] leading-none text-[var(--color-success-deep-text)]">
                  ✓
                </Text>
                <Text className="ml-[8rpx] text-[28rpx] text-[var(--color-success-deep-text)]">
                  {t('live.subscribe.subscribed')}
                </Text>
              </View>
            </View>
          ) : live.status === 'upcoming' ? (
            <View
              className="px-[20rpx] py-[20rpx] rounded-[24rpx] bg-primary flex items-center justify-center"
              onClick={handleSubscribe}
              hoverClass="opacity-60"
            >
              <Text className="text-[32rpx] font-semibold text-[var(--color-primary-foreground)]">
                {t('live.subscribe.subscribe')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
