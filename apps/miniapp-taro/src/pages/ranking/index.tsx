import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getRankingList } from '@/api'
import { Ranking, Loading, type RankingItem } from '@/components'
import { useI18n } from '@/i18n'
import './index.css'

// 排行榜列表响应(对标后端 GET /ranking 返回结构)
interface RankingListResponse {
  list: RankingItem[]
  total?: number
  myRank?: number
}

export default function RankingIndex() {
  const { t } = useI18n()
  const [list, setList] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getRankingList()) as RankingListResponse
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
        <Text className="page-title">{t('ranking.title')}</Text>
      </View>
      {loading ? (
        <Loading text={t('common.loading')} />
      ) : list.length ? (
        <Ranking list={list} title={t('ranking.title')} />
      ) : (
        <Text className="empty-text">{t('ranking.empty')}</Text>
      )}
    </View>
  )
}
