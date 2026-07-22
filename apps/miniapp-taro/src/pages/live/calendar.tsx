import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getLiveCalendar, type Live } from '@/api'
import { useI18n } from '@/i18n'

interface DayGroup {
  date: string
  lives: Live[]
}

const STATUS_KEY: Record<string, string> = {
  upcoming: 'live.preview',
  living: 'live.liveNow',
  ended: 'live.ended',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  upcoming: { bg: 'bg-[#f59e0b]/10', color: 'text-[#f59e0b]' },
  living: { bg: 'bg-destructive/10', color: 'text-destructive' },
  ended: { bg: 'bg-muted', color: 'text-muted-foreground' },
}

export default function LiveCalendar() {
  const { t } = useI18n()
  const [list, setList] = useState<DayGroup[]>([])

  const load = useCallback(async () => {
    try {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const res = await getLiveCalendar({ month })
      setList(res.list || [])
    } catch (e) {
      logger.error('live/calendar', '获取直播日历', e)
      Taro.showToast({ title: t('live.calendar.loadFailed'), icon: 'none' })
    }
  }, [t])

  useDidShow(() => {
    load()
  })

  const goDetail = useCallback((id: string | number) => {
    Taro.navigateTo({ url: `/pages/live/detail?id=${id}` })
  }, [])

  const statusText = (s: string) => (STATUS_KEY[s] ? t(STATUS_KEY[s]) : t('live.ended'))

  return (
    <View className="min-h-screen bg-background">
      <View className="px-[12px] py-[12px]">
        <Text className="text-[16px] text-foreground font-semibold">
          {t('live.calendar.title', { n: new Date().getMonth() + 1 })}
        </Text>
      </View>
      {list.map((group) => (
        <View key={group.date} className="mb-[12px]">
          <View className="px-[12px] py-[8px]">
            <Text className="text-[14px] text-foreground font-semibold">{group.date}</Text>
          </View>
          {group.lives.map((l) => {
            const st = STATUS_STYLE[l.status] || { bg: 'bg-muted', color: 'text-muted-foreground' }
            return (
              <View
                key={l.id}
                className="mx-[12px] mb-[12px] bg-card rounded-[8px] p-[12px]"
                onClick={() => goDetail(l.id)}
              >
                <Image
                  className="w-full h-[120px] rounded-[8px] bg-muted"
                  src={l.coverUrl}
                  mode="aspectFill"
                />
                <View className="mt-[8px] flex items-center justify-between">
                  <Text className="text-[15px] text-foreground font-semibold flex-1">{l.title}</Text>
                  <View className={`ml-[8px] px-[8px] py-[2px] rounded-[4px] ${st.bg}`}>
                    <Text className={`text-[12px] ${st.color}`}>{statusText(l.status)}</Text>
                  </View>
                </View>
                <View className="mt-[6px] flex items-center justify-between">
                  {l.anchor && <Text className="text-[13px] text-muted-foreground">{l.anchor}</Text>}
                  {l.startTime && <Text className="text-[12px] text-muted-foreground">{l.startTime}</Text>}
                </View>
              </View>
            )
          })}
        </View>
      ))}
      {list.length === 0 && (
        <View className="text-center py-[64px]">
          <Text className="text-[14px] text-muted-foreground">{t('live.calendar.empty')}</Text>
        </View>
      )}
    </View>
  )
}
