import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getMemberBenefits } from '@/api'

interface Benefit {
  id: string
  title: string
  desc: string
  icon?: string
}

export default function BenefitsPage() {
  const [list, setList] = useState<Benefit[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMemberBenefits()
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => load())

  return (
    <View className="min-h-screen bg-background p-[12px]">
      {list.length ? (
        <View className="grid grid-cols-2 gap-[12px]">
          {list.map(b => (
            <View key={b.id} className="bg-card rounded-[8px] p-[16px]">
              <Text className="block text-[48px] text-center">{b.icon || '★'}</Text>
              <Text className="block text-[30px] text-foreground font-semibold text-center mt-[12px]">{b.title}</Text>
              <Text className="block text-[24px] text-muted-foreground text-center mt-[8px]">{b.desc}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {!loading && !list.length ? (
        <View className="text-center py-[120px] text-muted-foreground">
          <Text>暂无权益</Text>
        </View>
      ) : null}
    </View>
  )
}
