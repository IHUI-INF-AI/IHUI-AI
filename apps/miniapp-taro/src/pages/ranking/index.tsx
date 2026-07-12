import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getRankingList } from '@/api'
import './index.css'

export default function RankingIndex() {
  const [list, setList] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getRankingList()) as Record<string, unknown>
      setList((res?.list as Record<string, unknown>[]) || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  return (
    <View className="ranking-page">
      <View className="page-header">
        <Text className="page-title">排行榜</Text>
      </View>
      <View className="ranking-list">
        {loading ? (
          <Text className="loading-text">加载中...</Text>
        ) : list.length ? (
          list.map((item, idx: number) => (
            <View key={item.id as string} className="ranking-item">
              <Text className={`rank-no ${idx < 3 ? 'rank-top' : ''}`}>{idx + 1}</Text>
              <View className="rank-info">
                <Text className="rank-name">
                  {(item.nickname as string) || (item.name as string) || '匿名'}
                </Text>
                <Text className="rank-score">
                  {(item.score as number) || (item.value as number) || 0}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text className="empty-text">暂无排行数据</Text>
        )}
      </View>
    </View>
  )
}
