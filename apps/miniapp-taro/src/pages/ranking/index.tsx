import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getRankingList } from '@/api'
import { Ranking, Loading, type RankingItem } from '@/components'
import { useI18n } from '@/i18n'
import './index.css'

/** 排行榜类型 tab(对标原项目:创作/学习/分销) */
type RankType = 'creation' | 'learning' | 'distribution'

const TYPE_TABS: { key: RankType; labelKey: string }[] = [
  { key: 'creation', labelKey: 'ranking.tabCreation' },
  { key: 'learning', labelKey: 'ranking.tabLearning' },
  { key: 'distribution', labelKey: 'ranking.tabDistribution' },
]

interface RankingListResponse {
  list: RankingItem[]
  total?: number
  myRank?: number
  myScore?: number
}

export default function RankingIndex() {
  const { t } = useI18n()
  const [list, setList] = useState<RankingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<RankType>('creation')
  const [myRank, setMyRank] = useState<number | null>(null)
  const [myScore, setMyScore] = useState<number>(0)

  const load = useCallback(
    async (t2: RankType) => {
      setLoading(true)
      try {
        const res = (await getRankingList(t2)) as RankingListResponse
        setList(res?.list || [])
        setMyRank(res?.myRank ?? null)
        setMyScore(res?.myScore ?? 0)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useDidShow(() => {
    load(type)
  })

  const onTypeChange = useCallback(
    (t2: RankType) => {
      if (t2 === type) return
      setType(t2)
      load(t2)
    },
    [type, load],
  )

  const unitMap: Record<RankType, string> = {
    creation: t('ranking.unitCreation'),
    learning: t('ranking.unitLearning'),
    distribution: t('ranking.unitDistribution'),
  }

  return (
    <View className="rkg-page">
      <View className="rkg-header">
        <Text className="rkg-title">{t('ranking.title')}</Text>
      </View>

      {/* 类型筛选 tab */}
      <ScrollView scrollX className="rkg-tabs">
        {TYPE_TABS.map((tab) => (
          <View
            key={tab.key}
            className={`rkg-tab${type === tab.key ? ' active' : ''}`}
            onClick={() => onTypeChange(tab.key)}
          >
            <Text>{t(tab.labelKey)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 我的排名卡片 */}
      <View className="rkg-mine">
        <View className="rkg-mine-info">
          <Text className="rkg-mine-label">{t('ranking.myRank')}</Text>
          <Text className="rkg-mine-rank">
            {myRank !== null ? `#${myRank}` : t('ranking.notRanked')}
          </Text>
        </View>
        <View className="rkg-mine-score">
          <Text className="rkg-mine-score-val">{myScore}</Text>
          <Text className="rkg-mine-score-unit">{unitMap[type]}</Text>
        </View>
      </View>

      {/* 排行榜列表 */}
      <View className="rkg-list">
        {loading ? (
          <Loading text={t('common.loading')} />
        ) : list.length ? (
          <Ranking list={list} unit={unitMap[type]} />
        ) : (
          <Text className="rkg-empty">{t('ranking.empty')}</Text>
        )}
      </View>
    </View>
  )
}
