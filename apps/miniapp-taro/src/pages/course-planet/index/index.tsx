import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import './index.css'

export default function CoursePlanet() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getCoursePlanet()) as any
      setData(res)
    } catch (e) {
      console.error('加载课程星球失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const list = (data && (data.list || (Array.isArray(data) ? data : []))) || []

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">课程星球</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>加载中...</Text>
        ) : list.length ? (
          list.map((item: Record<string, unknown>, idx: number) => (
            <View key={item.id || idx} className="list-item">
              <Text>{item.title || item.name || '课程'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">暂无课程</Text>
        )}
      </View>
    </View>
  )
}
