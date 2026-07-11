import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import './index.css'

export default function PlazaIndex() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getModelPlazaList()) as any
      setList(Array.isArray(res) ? res : res?.list || [])
    } catch (e) {
      console.error('加载广场数据失败:', e)
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
        <Text className="page-title">模型广场</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>加载中...</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={item.id || item.name} className="list-item">
              <Text>{item.name || item.title || '模型'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">暂无模型</Text>
        )}
      </View>
    </View>
  )
}
