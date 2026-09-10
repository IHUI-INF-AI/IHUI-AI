// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, {
  usePullDownRefresh,
  useReachBottom,
  useShareAppMessage,
  useShareTimeline,
} from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getLiveList, type Live } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

const STATUS_KEY: Record<Live['status'], string> = {
  living: 'live.liveNow',
  upcoming: 'live.preview',
  ended: 'live.replay',
}

export default function LiveList() {
  const { t } = useI18n()
  const tt = useTt()
  const [list, setList] = useState<Live[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)
  const statusRef = useRef('')

  const statusText = useCallback((s: Live['status']) => t(STATUS_KEY[s]), [t])

  const tabs = [
    { key: '', labelKey: 'live.all' },
    { key: 'living', labelKey: 'live.liveNow' },
    { key: 'upcoming', labelKey: 'live.preview' },
    { key: 'ended', labelKey: 'live.replay' },
  ]

  const load = useCallback(async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      lenRef.current = 0
      setList([])
    }
    if (!reset && !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getLiveList({
        page: pageRef.current,
        pageSize: 10,
        status: statusRef.current,
      })
      const more = res.list || []
      lenRef.current = reset ? more.length : lenRef.current + more.length
      setList((prev) => (reset ? more : [...prev, ...more]))
      hasMoreRef.current = lenRef.current < res.total
      pageRef.current++
    } catch {
      // 统一提示
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  const switchStatus = useCallback(
    (s: string) => {
      statusRef.current = s
      setStatus(s)
      load(true)
    },
    [load],
  )

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/live/detail?id=${id}` })
  }, [])

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })
  useReachBottom(() => load())

  useEffect(() => {
    load(true)
  }, [load])

  useShareAppMessage(() => ({
    title: t('share.appTitle'),
    path: '/pages/live/list',
    imageUrl: '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: t('share.timelineTitle'),
    query: '',
  }))

  return (
    <ThemeRoot>
      {/* 对齐 RN LiveScreen container(tk.surface.bg → var(--color-background))
          + listBody(paddingHorizontal 10 → 20rpx, paddingVertical 16 → 32rpx) */}
      <View className="min-h-screen bg-[var(--color-background)] px-[20rpx] pt-[32rpx] pb-[32rpx]">
        <View className="flex mb-[24rpx] gap-[16rpx]">
          <View
            className="flex-1 bg-primary rounded-xl py-2.5 flex items-center justify-center"
            onClick={() => Taro.navigateTo({ url: '/pages/live/host/index' })}
            hoverClass="opacity-60"
          >
            <Text className="text-sm text-primary-foreground">
              {tt('live.startLiveBtn', '📺 我要开播')}
            </Text>
          </View>
          <View
            className="flex-1 bg-card rounded-xl py-2.5 flex items-center justify-center"
            onClick={() => Taro.navigateTo({ url: '/pages/live/calendar' })}
            hoverClass="opacity-60"
          >
            <Text className="text-sm text-foreground">{tt('live.calendarBtn', '📅 日历')}</Text>
          </View>
          <View
            className="flex-1 bg-card rounded-xl py-2.5 flex items-center justify-center"
            onClick={() => Taro.navigateTo({ url: '/pages/live/subscribe' })}
            hoverClass="opacity-60"
          >
            <Text className="text-sm text-foreground">
              {tt('live.mySubscriptionBtn', '🔔 我的订阅')}
            </Text>
          </View>
        </View>
        <View className="flex mb-[24rpx] bg-card rounded-xl">
          {tabs.map((tab) => (
            <View
              key={tab.key}
              className={`flex-1 text-center py-2.5 text-sm ${status === tab.key ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
              onClick={() => switchStatus(tab.key)}
              hoverClass="opacity-60"
            >
              <Text>{t(tab.labelKey)}</Text>
            </View>
          ))}
        </View>

        {list.length > 0 && (
          <View>
            {list.map((item) => (
              <View
                key={item.id}
                className="rounded-[12rpx] border border-[var(--color-border)] p-[28rpx] mb-[24rpx]"
                onClick={() => goDetail(item.id)}
                hoverClass="opacity-60"
              >
                {/* 对齐 RN titleRow:标题(flex1, numberOfLines 1)+ 状态徽章 */}
                <View className="flex items-center justify-between gap-[16rpx]">
                  <Text className="flex-1 text-ellipsis text-[32rpx] font-semibold text-foreground">
                    {item.title}
                  </Text>
                  <View
                    className={`px-[20rpx] py-[8rpx] rounded-[24rpx] ${
                      item.status === 'living'
                        ? 'bg-[var(--color-danger)]'
                        : item.status === 'upcoming'
                          ? 'bg-[var(--color-warning-amber)]'
                          : 'bg-[var(--color-text-tertiary)]'
                    }`}
                  >
                    <Text className="text-[24rpx] text-[var(--color-primary-foreground)]">
                      {statusText(item.status)}
                    </Text>
                  </View>
                </View>
                {/* 对齐 RN lecturer 行(marginTop 6 → 12rpx, 14px → 28rpx, text.medium) */}
                {item.anchor ? (
                  <Text className="block mt-[12rpx] text-[28rpx] text-[var(--color-text-medium)]">
                    {item.anchor}
                  </Text>
                ) : null}
                {/* 对齐 RN metaRow:开始时间 + 观看人数两端对齐(marginTop 8 → 16rpx, 12px → 24rpx, text.tertiary) */}
                <View className="flex items-center justify-between mt-[16rpx]">
                  {item.startTime ? (
                    <Text className="text-[24rpx] text-[var(--color-text-tertiary)]">
                      {item.startTime}
                    </Text>
                  ) : (
                    <Text />
                  )}
                  {item.watchCount !== undefined && (
                    <Text className="text-[24rpx] text-[var(--color-text-tertiary)]">
                      {t('live.viewers', { n: item.watchCount })}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {!loading && list.length === 0 && (
          <View className="flex flex-col items-center py-[96rpx]">
            <Text className="text-[28rpx] text-muted-foreground">{t('live.empty')}</Text>
          </View>
        )}

        {loading && (
          <View className="flex flex-col items-center py-[96rpx]">
            <Text className="text-[28rpx] text-muted-foreground">{t('common.loading')}</Text>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
