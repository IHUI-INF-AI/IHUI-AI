import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import './index.css'

export default function DistributionPlan() {
  const [info, setInfo] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = (await api.getDistributionInfo()) as unknown as Record<string, unknown>
      setInfo(res)
    } catch (e) {
      console.error('加载分佣计划失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  return (
    <View className="page-container">
      <View className="page-header">
        <Text className="page-title">分佣计划</Text>
      </View>
      <View className="page-content">
        {loading ? (
          <Text>加载中...</Text>
        ) : info ? (
          <View className="info-card">
            <View className="info-row">
              <Text className="info-label">分销等级</Text>
              <Text className="info-value">{(info.level as string) ?? '-'}</Text>
            </View>
            <View className="info-row">
              <Text className="info-label">累计佣金</Text>
              <Text className="info-value">{(info.totalCommission as number) ?? 0}</Text>
            </View>
            <View className="info-row">
              <Text className="info-label">可提现</Text>
              <Text className="info-value">{(info.available as number) ?? 0}</Text>
            </View>
            <View className="info-row">
              <Text className="info-label">已提现</Text>
              <Text className="info-value">{(info.withdrawn as number) ?? 0}</Text>
            </View>
            <View className="info-row">
              <Text className="info-label">团队人数</Text>
              <Text className="info-value">{(info.teamCount as number) ?? 0}</Text>
            </View>
          </View>
        ) : (
          <Text className="empty">暂无数据</Text>
        )}
      </View>
    </View>
  )
}
