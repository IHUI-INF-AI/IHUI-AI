// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/live-list/LiveListScreen.tsx
import { useTt, useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, {
  usePullDownRefresh,
  useReachBottom,
  useShareAppMessage,
  useShareTimeline,
} from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { get } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
// 屏幕状态四件套的小程序镜像件(对齐 RN 端 packages/app/src/components/ScreenStates.tsx)
import {
  EmptyState,
  ErrorState,
  PressableCard,
  ScreenSkeleton,
} from '@/components/ScreenStates.taro'

/**
 * `GET /live/channels`(apps/api/src/routes/live.ts)的 live_channels 行。
 * 不取 `GET /live/list` 的唯一理由:它的投影只发 id/title/status/anchor/playUrl/watchCount,startTime 被丢掉
 * ⇒ 本页"开始时间"一行永远只能渲染 '—'(键在册而值不产出 = 假绿);两端点行集相同(publishedOnly=true)。
 */
interface LiveChannelRow {
  id: string
  title: string
  lecturerName: string | null
  startTime: string | null
  isLive: boolean
  viewCount: number
}

/** 状态档与后端 deriveLiveStatus 同判据;该端点恒 publishedOnly=true ⇒ upcoming 打不到 ⇒ 预告档已撤 */
type LiveBadge = 'living' | 'ended'
const BADGE_KEY: Record<LiveBadge, string> = { living: 'live.liveNow', ended: 'live.replay' }

/** 开始时间:与错题本同法(Intl),取不到时刻一律空串(空串再落 '—') */
function formatStart(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export default function LiveList() {
  const { t } = useI18n()
  const tt = useTt()
  const [list, setList] = useState<LiveChannelRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [status, setStatus] = useState('')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)
  const statusRef = useRef('')

  const statusText = useCallback((s: LiveBadge) => t(BADGE_KEY[s]), [t])

  const tabs: { key: string; labelKey: string }[] = [
    { key: '', labelKey: 'liveList.all' },
    { key: 'living', labelKey: 'live.liveNow' },
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
      // 全部档不发筛选;'living'/'ended' 走后端真读的 isLive;刻意不发 status=(z.coerce.number().int(),字符串 ⇒ 400 整页报错)
      const tab = statusRef.current
      const res = await get<{ list: LiveChannelRow[]; total: number }>('/live/channels', {
        page: pageRef.current,
        pageSize: 10,
        ...(tab ? { isLive: String(tab === 'living') } : {}),
      })
      const more = res.list || []
      lenRef.current = reset ? more.length : lenRef.current + more.length
      setList((prev) => (reset ? more : [...prev, ...more]))
      hasMoreRef.current = lenRef.current < res.total
      pageRef.current++
      setLoadFailed(false)
    } catch {
      // 对齐 RN:失败但已有内容时保留列表,只在空列表上落错误态(重试取 liveList.retry)
      setLoadFailed(true)
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
    Taro.navigateTo({ url: `/pkg-learn/live/detail?id=${id}` })
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
    path: '/pkg-learn/live/list',
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
        {/* 对齐 RN header 的副标题(标题由小程序原生导航栏承担) */}
        <Text className="block mb-[24rpx] text-[length:26rpx] text-muted-foreground">
          {t('liveList.subtitle')}
        </Text>
        <View className="flex mb-[24rpx] gap-[16rpx]">
          <View
            className="flex-1 bg-primary rounded-xl py-[20rpx] flex items-center justify-center"
            onClick={() => Taro.navigateTo({ url: '/pkg-learn/live/host/index' })}
            hoverClass="opacity-60"
          >
            <Text className="text-sm text-primary-foreground">
              {tt('live.startLiveBtn', '📺 我要开播')}
            </Text>
          </View>
          <View
            className="flex-1 bg-card ui-card rounded-lg py-[20rpx] flex items-center justify-center"
            onClick={() => Taro.navigateTo({ url: '/pkg-learn/live/calendar' })}
            hoverClass="opacity-60"
          >
            <Text className="text-sm text-foreground">{tt('live.calendarBtn', '📅 日历')}</Text>
          </View>
          <View
            className="flex-1 bg-card ui-card rounded-lg py-[20rpx] flex items-center justify-center"
            onClick={() => Taro.navigateTo({ url: '/pkg-learn/live/subscribe' })}
            hoverClass="opacity-60"
          >
            <Text className="text-sm text-foreground">
              {tt('live.mySubscriptionBtn', '🔔 我的订阅')}
            </Text>
          </View>
        </View>
        <View className="flex mb-[24rpx] bg-card ui-card rounded-lg">
          {tabs.map((tab) => (
            <View
              key={tab.key}
              className={`flex-1 text-center py-[20rpx] text-sm ${status === tab.key ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
              onClick={() => switchStatus(tab.key)}
              hoverClass="opacity-60"
            >
              <Text>{t(tab.labelKey)}</Text>
            </View>
          ))}
        </View>

        {loadFailed && list.length === 0 ? (
          <View className="mb-[24rpx]">
            <ErrorState
              message={t('common.failed')}
              onRetry={() => load(true)}
              retryLabel={t('liveList.retry')}
            />
          </View>
        ) : null}

        {list.length > 0 && (
          <View>
            {list.map((item) => (
              <PressableCard
                key={item.id}
                className="rounded-lg border border-[var(--color-border)] p-[28rpx] mb-[24rpx]"
                onClick={() => goDetail(item.id)}
              >
                {/* 对齐 RN titleRow:标题(flex1, numberOfLines 1)+ 状态徽章 */}
                <View className="flex items-center justify-between gap-[16rpx]">
                  <Text className="flex-1 ihui-ellipsis text-[length:32rpx] font-semibold text-foreground">
                    {item.title}
                  </Text>
                  <View
                    className={`px-[20rpx] py-[8rpx] rounded-xl ${
                      item.isLive ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-text-tertiary)]'
                    }`}
                  >
                    <Text className="text-[length:24rpx] text-[var(--color-primary-foreground)]">
                      {statusText(item.isLive ? 'living' : 'ended')}
                    </Text>
                  </View>
                </View>
                {/* 对齐 RN lecturer 行(marginTop 6 → 12rpx, 14px → 28rpx, text.medium) */}
                {item.lecturerName ? (
                  <Text className="block mt-[12rpx] text-[length:28rpx] text-[var(--color-text-medium)]">
                    {t('liveList.lecturer')}: {item.lecturerName}
                  </Text>
                ) : null}
                {/* 对齐 RN metaRow:开始时间 + 观看人数两端对齐(marginTop 8 → 16rpx, 12px → 24rpx, text.tertiary) */}
                <View className="flex items-center justify-between mt-[16rpx]">
                  <Text className="text-[length:24rpx] text-[var(--color-text-tertiary)]">
                    {t('liveList.startAt')}: {formatStart(item.startTime) || '—'}
                  </Text>
                  <Text className="text-[length:24rpx] text-[var(--color-text-tertiary)]">
                    {t('liveList.viewerCount')} {item.viewCount}
                  </Text>
                </View>
              </PressableCard>
            ))}
          </View>
        )}

        {!loading && !loadFailed && list.length === 0 && <EmptyState title={t('live.empty')} />}

        {loading && <ScreenSkeleton variant="list" count={4} />}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
