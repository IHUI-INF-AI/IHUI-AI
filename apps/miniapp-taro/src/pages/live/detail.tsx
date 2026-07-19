import { View, Text, Image, Video } from '@tarojs/components'
import Taro, { useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { getLiveDetail, subscribeLive, type Live } from '@/api'
import { useI18n } from '@/i18n'

export default function LiveDetail() {
  const { t } = useI18n()
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
      <View className="flex items-center justify-center h-screen text-[#999]">
        <Text>{t('live.detail.loading')}</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen">
      {/* 播放区 */}
      <View className="w-full h-[210px] bg-black">
        {live.playUrl ? (
          <Video
            className="w-full h-full"
            src={live.playUrl}
            autoplay
            controls
            objectFit="contain"
          />
        ) : (
          <View className="relative w-full h-full">
            <Image className="w-full h-full opacity-60" src={live.coverUrl} mode="aspectFill" />
            {live.status === 'living' && (
              <View className="absolute inset-0 flex items-center justify-center">
                <View
                  className="px-7 py-2.5 bg-[#dd524d] text-white rounded-md text-sm"
                  onClick={enterLive}
                >
                  <Text>{t('live.detail.enter')}</Text>
                </View>
              </View>
            )}
            {live.status === 'ended' && (
              <View className="absolute inset-0 flex flex-col items-center justify-center text-white text-sm">
                <Text>{t('live.detail.ended')}</Text>
              </View>
            )}
            {live.status === 'upcoming' && (
              <View className="absolute inset-0 flex flex-col items-center justify-center text-white text-sm">
                <Text>{t('live.detail.notStarted')}</Text>
                {live.startTime && (
                  <Text className="mt-2 text-xs opacity-80">{live.startTime}</Text>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* 直播信息 */}
      <View className="p-3">
        <Text className="text-lg text-[#333] font-semibold">{live.title}</Text>
        <View className="flex justify-between items-center mt-2">
          {live.anchor && (
            <Text className="text-sm text-[#07c160]">
              {t('live.detail.anchor', { name: live.anchor })}
            </Text>
          )}
          {live.watchCount !== undefined ? (
            <Text className="text-sm text-[#999]">{t('live.viewers', { n: live.watchCount })}</Text>
          ) : null}
        </View>
        {live.status === 'upcoming' ? (
          <View
            className={`mt-3 h-9 leading-9 text-center text-white text-sm rounded-md ${
              subscribed ? 'bg-[#999]' : 'bg-[#07c160]'
            }`}
            onClick={handleSubscribe}
          >
            <Text>{subscribed ? t('live.subscribe.subscribed') : t('live.subscribe.subscribe')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
