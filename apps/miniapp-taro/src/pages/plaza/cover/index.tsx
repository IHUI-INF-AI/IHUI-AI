import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import './index.css'

export default function PlazaCover() {
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getModelPlazaList()) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch (e) {
      logger.error('unknown', '加载模型广场', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onItemClick = useCallback((id: string) => {
    Taro.navigateTo({ url: `/pages/model-plaza/index?id=${id}` })
  }, [])

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
            <View
              key={item.id as string}
              className="list-item"
              onClick={() => onItemClick(item.id as string)}
            >
              <Text>{(item.name as string) || (item.title as string) || '模型'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">暂无模型</Text>
        )}
      </View>
    </View>
  )
}
