import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import './index.css'

export default function ModelEdit() {
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getDeveloperAgents()) as Record<string, unknown>
      setList((Array.isArray(res) ? res : res?.list || []) as Record<string, unknown>[])
    } catch (e) {
      console.error('加载模型失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onSave = useCallback(() => {
    Taro.showToast({ title: '保存成功', icon: 'success' })
  }, [])

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">模型编辑</Text>
        <Text className="btn" onClick={onSave}>
          保存
        </Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>加载中...</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={(item.id as string) || (item.name as string)} className="list-item">
              <Text>{(item.name as string) || (item.title as string) || '模型'}</Text>
            </View>
          ))
        ) : (
          <Text className="empty">暂无可编辑模型</Text>
        )}
      </View>
    </View>
  )
}
