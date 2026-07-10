import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getMemberBenefits } from '@/api'
import './benefits.css'

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
    try { setList((await getMemberBenefits()).list || []) } finally { setLoading(false) }
  }, [])

  useDidShow(load)

  return (
    <View className="page">
      {list.length ? (
        <View className="list">
          {list.map(b => (
            <View key={b.id} className="item">
              <View className="item-icon">{b.icon || '★'}</View>
              <View className="item-body">
                <Text className="item-title">{b.title}</Text>
                <Text className="item-desc">{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {!loading && !list.length ? (
        <View className="empty"><Text>暂无权益</Text></View>
      ) : null}
    </View>
  )
}
