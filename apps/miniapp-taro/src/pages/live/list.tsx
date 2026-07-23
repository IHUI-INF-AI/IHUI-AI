import { View, Text, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getLiveList, type Live } from '@/api'
import { useI18n } from '@/i18n'

const STATUS_KEY: Record<Live['status'], string> = {
  living: 'live.liveNow',
  upcoming: 'live.preview',
  ended: 'live.replay',
}

export default function LiveList() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
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
    <View className="min-h-screen p-3">
      <View className="flex mb-3 gap-2">
        <View
          className="flex-1 bg-card rounded-xl py-2.5 flex items-center justify-center"
          onClick={() => Taro.navigateTo({ url: '/pages/live/calendar' })}
        >
          <Text className="text-sm text-foreground">{tt('live.calendarBtn', '📅 日历')}</Text>
        </View>
        <View
          className="flex-1 bg-card rounded-xl py-2.5 flex items-center justify-center"
          onClick={() => Taro.navigateTo({ url: '/pages/live/subscribe' })}
        >
          <Text className="text-sm text-foreground">{tt('live.mySubscriptionBtn', '🔔 我的订阅')}</Text>
        </View>
      </View>
      <View className="flex mb-3 bg-card rounded-xl">
        {tabs.map((tab) => (
          <View
            key={tab.key}
            className={`flex-1 text-center py-2.5 text-sm ${status === tab.key ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
            onClick={() => switchStatus(tab.key)}
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
              className="bg-card rounded-2xl overflow-hidden mb-3"
              onClick={() => goDetail(item.id)}
            >
              <View className="relative w-full h-[160px]">
                <Image className="w-full h-full" src={item.coverUrl} mode="aspectFill" />
                <View
                  className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-xs ${
                    item.status === 'living'
                      ? 'bg-[#dd524d] text-white'
                      : item.status === 'upcoming'
                        ? 'bg-[#f0ad4e] text-white'
                        : 'bg-black/50 text-white'
                  }`}
                >
                  <Text>{statusText(item.status)}</Text>
                </View>
              </View>
              <View className="p-2.5">
                <Text className="text-base text-foreground font-semibold">{item.title}</Text>
                <View className="flex justify-between mt-1.5">
                  {item.anchor && <Text className="text-xs text-primary">{item.anchor}</Text>}
                  {item.startTime && <Text className="text-xs text-muted-foreground">{item.startTime}</Text>}
                </View>
                {item.watchCount !== undefined && (
                  <Text className="block mt-1 text-xs text-muted-foreground">
                    {t('live.viewers', { n: item.watchCount })}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-muted-foreground text-sm">
          <Text>{t('live.empty')}</Text>
        </View>
      )}

      {loading && (
        <View className="text-center py-16 text-muted-foreground text-sm">
          <Text>{t('common.loading')}</Text>
        </View>
      )}
    </View>
  )
}
