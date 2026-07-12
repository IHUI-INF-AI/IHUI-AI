import { View, Text, Image } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getAigcList } from '@/api'
import './list.css'

export default function AigcList() {
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getAigcList()) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  return (
    <View className="aigc-list-page">
      <View className="page-header">
        <Text className="page-title">AIGC 作品</Text>
      </View>
      <View className="aigc-grid">
        {loading ? (
          <Text className="loading-text">加载中...</Text>
        ) : list.length ? (
          list.map((item: Record<string, unknown>) => (
            <View key={item.id as string} className="aigc-card">
              {item.coverUrl ? (
                <Image className="aigc-cover" src={item.coverUrl as string} mode="aspectFill" />
              ) : null}
              <View className="aigc-info">
                <Text className="aigc-title">{(item.title as string) || '未命名作品'}</Text>
                <Text className="aigc-author">{(item.author as string) || '匿名'}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text className="empty-text">暂无作品</Text>
        )}
      </View>
    </View>
  )
}
