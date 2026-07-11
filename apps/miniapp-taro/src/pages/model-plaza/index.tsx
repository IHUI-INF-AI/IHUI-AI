import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getModelPlazaList } from '@/api'
import './index.css'

export default function ModelPlazaIndex() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res: any = await getModelPlazaList()
      setList(res?.list || [])
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
          list.map((model: any) => (
            <View key={model.id} className="model-item">
              <View className="model-head">
                <Text className="model-name">{model.name || '未命名模型'}</Text>
                <Text className="model-tag">{model.provider || ''}</Text>
              </View>
              <Text className="model-desc">{model.desc || '暂无介绍'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty-text">暂无模型</Text>
        )}
      </View>
    </View>
  )
}
