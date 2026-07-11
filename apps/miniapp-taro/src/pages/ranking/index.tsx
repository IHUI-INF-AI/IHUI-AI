import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getRankingList } from '@/api'
import './index.css'

export default function RankingIndex() {
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res: any = await getRankingList()
      setList(res?.list || [])
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
          list.map((item: any, idx: number) => (
            <View key={item.id} className="ranking-item">
              <Text className={`rank-no ${idx < 3 ? 'rank-top' : ''}`}>{idx + 1}</Text>
              <View className="rank-info">
                <Text className="rank-name">{item.nickname || item.name || '匿名'}</Text>
                <Text className="rank-score">{item.score || item.value || 0}</Text>
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
