import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getRankingList } from '@/api'
import { Ranking, Loading } from '@/components'
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
      {loading ? (
        <Loading text="加载中..." />
      ) : list.length ? (
        <Ranking list={list as never} title="排行榜" />
      ) : (
        <Text className="empty-text">暂无排行数据</Text>
      )}
    </View>
  )
}
