import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getModelPlazaList } from '@/api'
import './index.css'

export default function ModelPlazaIndex() {
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getModelPlazaList()) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  return (
    <View className="model-plaza-page">
      <View className="page-header">
        <Text className="page-title">模型广场</Text>
      </View>
      <View className="model-list">
        {loading ? (
          <Text className="loading-text">加载中...</Text>
        ) : list.length ? (
          list.map((model) => (
            <View key={model.id as string} className="model-item">
              <View className="model-head">
                <Text className="model-name">{(model.name as string) || '未命名模型'}</Text>
                <Text className="model-tag">{(model.provider as string) || ''}</Text>
              </View>
              <Text className="model-desc">{(model.desc as string) || '暂无介绍'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty-text">暂无模型</Text>
        )}
      </View>
    </View>
  )
}
