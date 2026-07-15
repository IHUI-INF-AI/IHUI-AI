import { View, Text } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getRankingList } from '@/api'
import { Ranking, Loading } from '@/components'
import { useI18n } from '@/i18n'
import './index.css'

export default function RankingIndex() {
  const { t } = useI18n()
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
        <Text className="page-title">{t('ranking.title')}</Text>
      </View>
      {loading ? (
        <Loading text={t('common.loading')} />
      ) : list.length ? (
        <Ranking list={list as never} title={t('ranking.title')} />
      ) : (
        <Text className="empty-text">{t('ranking.empty')}</Text>
      )}
    </View>
  )
}
