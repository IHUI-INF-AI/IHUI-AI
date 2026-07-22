import { View, Text, Image } from '@tarojs/components'
import { useReachBottom } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { getDistributionTeam } from '@/api'
import { useI18n } from '@/i18n'

interface TeamMember {
  id: string
  nickname: string
  avatar?: string
  joinTime: string
  level: number
}

const PAGE_SIZE = 20

export default function DistributionTeam() {
  const { t } = useI18n()
  const [list, setList] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setList([])
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getDistributionTeam({ page: pageRef.current, pageSize: PAGE_SIZE })
      const items = (res.list || []).map((u): TeamMember => ({
        id: u.id,
        nickname: u.nickname || u.username,
        avatar: u.avatar ?? undefined,
        joinTime: u.createdAt,
        level: 1,
      }))
      setList((prev) => (reset ? items : [...prev, ...items]))
      hasMoreRef.current = pageRef.current * PAGE_SIZE < res.total
      pageRef.current++
    } catch {
      // ignore
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
  }, [])

  useReachBottom(() => {
    load()
  })

  return (
    <View className="min-h-screen bg-background">
      {list.length > 0 && (
        <View className="p-[12px]">
          {list.map((m) => (
            <View
              key={m.id}
              className="flex items-center bg-card p-[12px] mb-[12px] rounded-[8px]"
            >
              <Image
                className="w-[40px] h-[40px] rounded-md bg-muted"
                src={m.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <View className="flex-1 ml-[12px]">
                <Text className="block text-[14px] text-foreground">{m.nickname}</Text>
                <Text className="block text-[12px] text-muted-foreground mt-[4px]">
                  {t('distribution.team.joinTime', { time: m.joinTime })}
                </Text>
              </View>
              <Text className="text-[14px] text-[#ff6b35] font-semibold">V{m.level}</Text>
            </View>
          ))}
        </View>
      )}
      {list.length === 0 && !loading && (
        <View className="text-center py-[60px] text-muted-foreground">
          <Text>{t('distribution.team.empty')}</Text>
        </View>
      )}
      {loading && (
        <View className="text-center py-[20px] text-muted-foreground">
          <Text>{t('distribution.team.loading')}</Text>
        </View>
      )}
    </View>
  )
}
