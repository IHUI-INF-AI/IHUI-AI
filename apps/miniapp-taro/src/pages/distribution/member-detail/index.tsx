import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import './index.css'

export default function MemberDetail() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getSubordinates()) as any
      setList(res?.list || [])
    } catch (e) {
      console.error('加载团队成员失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">团队成员</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>加载中...</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={item.id} className="list-item">
              <Text>{item.nickname || '成员'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">暂无团队成员</Text>
        )}
      </View>
    </View>
  )
}
