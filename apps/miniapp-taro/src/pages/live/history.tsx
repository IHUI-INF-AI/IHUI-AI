import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getLiveHistory, type Live } from '@/api'
import { useI18n } from '@/i18n'
import './history.css'

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
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  const [rawList, setRawList] = useState<HistoryItem[]>([])
  const [filter, setFilter] = useState<FilterTab>('today')
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const lenRef = useRef(0)

  const load = useCallback(async (reset = false) => {
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
  }, [tt])

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
    <View className="hist-page">
      <View className="hist-tabs">
        {FILTER_TABS.map((tab) => (
          <Text
            key={tab.key}
            className={`hist-tab${filter === tab.key ? ' hist-tab-active' : ''}`}
            onClick={() => setFilter(tab.key)}
          >
            {tt(tab.i18nKey, tab.fb)}
          </Text>
        ))}
      </View>

      {displayList.length > 0 && (
        <View className="hist-list">
          {displayList.map((item) => {
            const progress = item.progress ?? 0
            const completed = progress >= 100
            return (
              <View key={item.id} className="hist-card" onClick={() => goDetail(item.id)}>
                <Image className="hist-card-cover" src={item.coverUrl} mode="aspectFill" />
                <View className="hist-card-body">
                  <Text className="hist-card-title">{item.title}</Text>
                  {item.anchor && (
                    <Text className="hist-card-meta">
                      {tt('live.history.anchorLabel', '主播')}: {item.anchor}
                    </Text>
                  )}
                  <View className="hist-progress">
                    <View
                      className="hist-progress-bar"
                      style={`width: ${Math.min(progress, 100)}%`}
                    />
                  </View>
                  <View className="hist-card-bottom">
                    <Text className="hist-progress-text">
                      {item.watchDuration
                        ? `${tt('live.history.watchDuration', '观看')} ${formatDuration(item.watchDuration)}`
                        : item.watchTime || item.startTime || ''}
                    </Text>
                    <Text
                      className="hist-action-btn"
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
              </View>
            )
          })}
        </View>
      )}

      {!loading && displayList.length === 0 && (
        <View className="hist-empty">
          <Text>{tt('live.history.empty', '暂无历史直播')}</Text>
        </View>
      )}

      {loading && (
        <View className="hist-loading">
          <Text>{tt('live.history.loading', '加载中…')}</Text>
        </View>
      )}

      {!loading && !hasMore && displayList.length > 0 && (
        <View className="hist-no-more">
          <Text>{tt('common.noMore', '没有更多了')}</Text>
        </View>
      )}
    </View>
  )
}
