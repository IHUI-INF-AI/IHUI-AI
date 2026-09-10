// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getLiveHistory, type Live } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

interface HistoryItem extends Live {
  watchDuration?: number
  watchTime?: string
  progress?: number
}

type FilterTab = 'today' | 'week' | 'month'

const FILTER_TABS: Array<{ key: FilterTab; i18nKey: string; fb: string }> = [
  { key: 'today', i18nKey: 'live.history.today', fb: '今天' },
  { key: 'week', i18nKey: 'live.history.week', fb: '本周' },
  { key: 'month', i18nKey: 'live.history.month', fb: '本月' },
]

const PAGE_SIZE = 10

const toMs = (v: string | undefined): number => {
  if (!v) return 0
  const n = Date.parse(v)
  return isNaN(n) ? 0 : n
}

export default function LiveHistory() {
  const tt = useTt()

  const [rawList, setRawList] = useState<HistoryItem[]>([])
  const [filter, setFilter] = useState<FilterTab>('today')
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)

  const load = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return
      if (reset) {
        pageRef.current = 1
        hasMoreRef.current = true
        lenRef.current = 0
        setHasMore(true)
        setRawList([])
      }
      if (!reset && !hasMoreRef.current) return
      loadingRef.current = true
      setLoading(true)
      try {
        const res = await getLiveHistory({ page: pageRef.current, pageSize: PAGE_SIZE })
        const more = (res.list || []) as HistoryItem[]
        lenRef.current = reset ? more.length : lenRef.current + more.length
        setRawList((prev) => (reset ? more : [...prev, ...more]))
        const next = lenRef.current < res.total
        hasMoreRef.current = next
        setHasMore(next)
        pageRef.current++
      } catch (e) {
        logger.error('live/history', '获取历史记录', e)
        Taro.showToast({ title: tt('common.failed', '操作失败'), icon: 'none' })
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [tt],
  )

  const displayList = useMemo(() => {
    const now = Date.now()
    return rawList.filter((item) => {
      const ts = toMs(item.watchTime || item.startTime)
      if (!ts) return false
      if (filter === 'today') {
        return new Date(ts).toDateString() === new Date(now).toDateString()
      }
      if (filter === 'week') {
        return ts >= now - 7 * 24 * 3600 * 1000
      }
      const d = new Date(ts)
      const n = new Date(now)
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
    })
  }, [rawList, filter])

  const goDetail = useCallback(
    (id: string | number) => Taro.navigateTo({ url: `/pages/live/detail?id=${id}` }),
    [],
  )

  useReachBottom(() => load())
  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })

  useEffect(() => {
    load(true)
  }, [load])

  const formatDuration = (min?: number) => {
    if (!min || min <= 0) return ''
    if (min < 60) return `${Math.round(min)}${tt('live.history.minutes', '分钟')}`
    const h = Math.floor(min / 60)
    const m = Math.round(min % 60)
    return `${h}${tt('live.history.hour', '时')}${m}${tt('live.history.minutes', '分')}`
  }

  return (
    /* 对齐 RN shared LivePlaybackListScreen:container(tk.surface.bg)+ listBody(padding 10 → 20rpx) */
    <View className="min-h-screen bg-[var(--color-background)] px-[20rpx] pt-[20rpx] pb-[60rpx] box-border">
      <View className="flex gap-[16rpx] mb-[24rpx]">
        {FILTER_TABS.map((tab) => (
          <Text
            key={tab.key}
            className={`flex-1 text-center h-[64rpx] leading-[64rpx] text-[26rpx] text-muted-foreground bg-card border-[2rpx] border-[var(--color-border)] rounded-[12rpx]${filter === tab.key ? ' text-primary border-primary font-semibold' : ''}`}
            onClick={() => setFilter(tab.key)}
          >
            {tt(tab.i18nKey, tab.fb)}
          </Text>
        ))}
      </View>

      {displayList.length > 0 && (
        /* 对齐 RN FlatList separator(height 12 → 24rpx) */
        <View className="flex flex-col gap-[24rpx]">
          {displayList.map((item) => {
            const progress = item.progress ?? 0
            const completed = progress >= 100
            return (
              /* 对齐 RN card:padding 12 → 24rpx,radius 12 → 24rpx,1px border.light → 2rpx var(--color-border),无卡片底色 */
              <ThemeRoot key={item.id}>
                <View
                  className="p-[24rpx] rounded-[24rpx] border-[2rpx] border-[var(--color-border)]"
                  onClick={() => goDetail(item.id)}
                  hoverClass="opacity-60"
                >
                  {/* 对齐 RN cardTitle(16dp → 32rpx semibold,单行截断) */}
                  <Text className="block overflow-hidden whitespace-nowrap text-ellipsis text-[32rpx] font-semibold text-foreground">
                    {item.title}
                  </Text>
                  {/* 对齐 RN cardMeta(marginTop 8 → 16rpx,11dp → 22rpx,text.tertiary) */}
                  {item.anchor && (
                    <Text className="block mt-[16rpx] text-[22rpx] text-[var(--color-text-tertiary)]">
                      {tt('live.history.anchorLabel', '主播')}: {item.anchor}
                    </Text>
                  )}
                  {/* 对齐 RN metaRow(两端对齐,marginTop 8 → 16rpx)+ cardAction(14dp → 28rpx 品牌色 semibold) */}
                  <View className="flex items-center justify-between mt-[16rpx]">
                    <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
                      {item.watchDuration
                        ? `${tt('live.history.watchDuration', '观看')} ${formatDuration(item.watchDuration)}`
                        : item.watchTime || item.startTime || ''}
                    </Text>
                    <Text
                      className="text-[28rpx] font-semibold text-[var(--color-brand-orange)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        goDetail(item.id)
                      }}
                    >
                      {completed
                        ? tt('live.history.rewatch', '重新观看')
                        : tt('live.history.continue', '继续观看')}
                    </Text>
                  </View>
                </View>
              </ThemeRoot>
            )
          })}
        </View>
      )}

      {!loading && displayList.length === 0 && (
        <View className="block text-center text-[28rpx] text-muted-foreground py-[96rpx]">
          <Text>{tt('live.history.empty', '暂无历史直播')}</Text>
        </View>
      )}

      {loading && (
        <View className="block text-center text-[28rpx] text-muted-foreground py-[96rpx]">
          <Text>{tt('live.history.loading', '加载中…')}</Text>
        </View>
      )}

      {!loading && !hasMore && displayList.length > 0 && (
        <View className="block text-center text-[28rpx] text-muted-foreground py-[96rpx]">
          <Text>{tt('common.noMore', '没有更多了')}</Text>
        </View>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
