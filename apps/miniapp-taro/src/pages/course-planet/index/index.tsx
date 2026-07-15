import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import './index.css'

export default function CoursePlanet() {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getCoursePlanet()) as Record<string, unknown>
      setData(res)
    } catch (e) {
      logger.error('unknown', '加载课程星球', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const list = ((data && (data.list || (Array.isArray(data) ? data : []))) || []) as Record<
    string,
    unknown
  >[]

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
            <View key={(item.id as string) || idx} className="list-item">
              <Text>{(item.title as string) || (item.name as string) || '课程'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">暂无课程</Text>
        )}
      </View>
    </View>
  )
}
