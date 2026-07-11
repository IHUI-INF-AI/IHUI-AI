import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import './index.css'

export default function LearnDevelop() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getCourseList({ page: 1, pageSize: 20 })) as any
      setList(res?.list || [])
    } catch (e) {
      console.error('加载课程失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/course/detail?id=${id}` })
  }, [])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">学习开发</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>加载中...</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={item.id} className="list-item" onClick={() => onItemClick(item.id)}>
              <Text>{item.title || '课程'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">暂无课程</Text>
        )}
      </View>
    </View>
  )
}
