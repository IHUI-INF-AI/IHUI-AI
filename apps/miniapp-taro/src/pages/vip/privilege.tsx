import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getVipPrivilege } from '@/api'
import './privilege.css'

interface Privilege {
  id: string
  title: string
  desc: string
}

export default function PrivilegePage() {
  const [list, setList] = useState<Privilege[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await getVipPrivilege()
      setList(res.list || [])
    } finally { setLoading(false) }
  }, [])

  useDidShow(load)

  return (
    <View className="page">
      {list.length ? (
        <View className="list">
          {list.map(p => (
            <View key={p.id} className="item">
              <View className="item-head">
                <View className="item-icon">★</View>
                <Text className="item-title">{p.title}</Text>
              </View>
              <Text className="item-desc">{p.desc}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {!loading && !list.length ? (
        <View className="empty"><Text>暂无特权信息</Text></View>
      ) : null}
    </View>
  )
}
