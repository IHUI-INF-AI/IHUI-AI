import { View, Text, Image } from '@tarojs/components'
import Taro, { useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getLiveHistory, type Live } from '@/api'
import { useI18n } from '@/i18n'

export default function LiveHistory() {
  const { t } = useI18n()
  const [list, setList] = useState<Live[]>([])
  const [loading, setLoading] = useState(false)
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
      setList([])
    }
    if (!reset && !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getLiveHistory({ page: pageRef.current, pageSize: 10 })
      const more = res.list || []
      lenRef.current = reset ? more.length : lenRef.current + more.length
      setList((prev) => (reset ? more : [...prev, ...more]))
      hasMoreRef.current = lenRef.current < res.total
      pageRef.current++
    } catch {
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [t])

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/live/detail?id=${id}` })
  }, [])

  useReachBottom(() => load())

  usePullDownRefresh(() => {
    load(true).finally(() => Taro.stopPullDownRefresh())
  })

  useEffect(() => {
    load(true)
  }, [load])

  return (
    <View className="min-h-screen bg-background">
      {list.length > 0 && (
        <View className="p-3">
          {list.map((l) => (
            <View
              key={l.id}
              className="flex bg-card rounded-2xl overflow-hidden mb-3"
              onClick={() => goDetail(l.id)}
            >
              <Image
                className="w-[120px] h-[80px] flex-shrink-0 bg-muted"
                src={l.coverUrl}
                mode="aspectFill"
              />
              <View className="flex-1 p-2.5 flex flex-col justify-between">
                <Text className="text-sm text-foreground font-semibold">{l.title}</Text>
                {l.anchor && (
                  <Text className="text-xs text-muted-foreground">
                    {t('live.history.anchor', { name: l.anchor })}
                  </Text>
                )}
                <View className="flex justify-between">
                  <Text className="text-xs text-muted-foreground">{l.startTime}</Text>
                  <Text className="text-xs text-primary">{t('live.history.replay')}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {!loading && list.length === 0 && (
        <View className="text-center py-16 text-muted-foreground text-sm">
          <Text>{t('live.history.empty')}</Text>
        </View>
      )}

      {loading && (
        <View className="text-center py-16 text-muted-foreground text-sm">
          <Text>{t('live.history.loading')}</Text>
        </View>
      )}
    </View>
  )
}
