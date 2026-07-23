import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { useState, useRef } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import './index.css'

interface PlanItem {
  id: string
  name: string
  commissionRate: number
  productCount: number
  status: number
}

interface Overview {
  level: number
  totalCommission: number
  available: number
}

const PAGE_SIZE = 20

export default function DistributionPlan() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }
  const [list, setList] = useState<PlanItem[]>([])
  const [overview, setOverview] = useState<Overview>({
    level: 0,
    totalCommission: 0,
    available: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const loadOverview = async () => {
    try {
      const info = (await api.getDistributionInfo()) as unknown as Record<string, unknown>
      setOverview({
        level: (info.level as number) ?? 0,
        totalCommission: (info.totalCommission as number) ?? 0,
        available: (info.available as number) ?? 0,
      })
    } catch (e) {
      logger.error('unknown', '加载分销概览', e)
    }
  }

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setHasMore(true)
      setList([])
      setError(false)
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = (await api.get('/distribution/plans', {
        page: pageRef.current,
        pageSize: PAGE_SIZE,
      })) as unknown as {
        list: Array<Record<string, unknown>>
        total: number
      }
      const items: PlanItem[] = (res.list || []).map((p) => ({
        id: String(p.id ?? ''),
        name: (p.name as string) || (p.title as string) || tt('distribution.plan.planName', '计划'),
        commissionRate: (p.commissionRate as number) ?? (p.rate as number) ?? 0,
        productCount: (p.productCount as number) ?? (p.goodsCount as number) ?? 0,
        status: (p.status as number) ?? 1,
      }))
      setList((prev) => (reset ? items : [...prev, ...items]))
      const more = pageRef.current * PAGE_SIZE < (res.total ?? 0)
      hasMoreRef.current = more
      setHasMore(more)
      pageRef.current++
    } catch (e) {
      logger.error('unknown', '加载分销计划', e)
      setError(true)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  const onNewPlan = () => {
    Taro.showToast({
      title: tt('distribution.plan.comingSoon', '功能开发中'),
      icon: 'none',
    })
  }

  const onPlanClick = (_plan: PlanItem) => {
    Taro.showToast({
      title: tt('distribution.plan.comingSoon', '功能开发中'),
      icon: 'none',
    })
  }

  useDidShow(() => {
    loadOverview()
    load(true)
  })

  useReachBottom(() => {
    load()
  })

  usePullDownRefresh(() => {
    Promise.all([loadOverview(), load(true)]).finally(() => Taro.stopPullDownRefresh())
  })

  return (
    <View className="pl-page">
      {/* 概览卡片 */}
      <View className="pl-overview">
        <View className="pl-overview-row">
          <Text className="pl-overview-label">{t('distribution.plan.level')}</Text>
          <Text className="pl-overview-value">V{overview.level}</Text>
        </View>
        <View className="pl-overview-row">
          <Text className="pl-overview-label">{t('distribution.plan.totalCommission')}</Text>
          <Text className="pl-overview-value pl-overview-accent">¥{overview.totalCommission}</Text>
        </View>
        <View className="pl-overview-row">
          <Text className="pl-overview-label">{t('distribution.plan.available')}</Text>
          <Text className="pl-overview-value">¥{overview.available}</Text>
        </View>
      </View>

      {/* 新建计划按钮 */}
      <View className="pl-new-btn" onClick={onNewPlan}>
        <Text>+ {tt('distribution.plan.newPlan', '新建计划')}</Text>
      </View>

      {/* 计划列表 */}
      <View className="pl-list-section">
        <Text className="pl-list-title">
          {tt('distribution.plan.planList', '计划列表')}
        </Text>

        {list.length > 0 && (
          <View className="pl-list">
            {list.map((p) => {
              const isActive = p.status === 1
              return (
                <View
                  key={p.id}
                  className={`pl-plan-card ${isActive ? '' : 'pl-plan-card-inactive'}`}
                  onClick={() => onPlanClick(p)}
                >
                  <View className="pl-plan-header">
                    <Text className="pl-plan-name">{p.name}</Text>
                    <Text className={`pl-plan-status ${isActive ? 'pl-status-active' : 'pl-status-inactive'}`}>
                      {isActive
                        ? tt('distribution.plan.active', '进行中')
                        : tt('distribution.plan.inactive', '已停用')}
                    </Text>
                  </View>
                  <View className="pl-plan-meta">
                    <View className="pl-plan-meta-item">
                      <Text className="pl-plan-meta-label">
                        {tt('distribution.plan.commissionRate', '佣金比例')}
                      </Text>
                      <Text className="pl-plan-meta-value pl-plan-rate">
                        {p.commissionRate}%
                      </Text>
                    </View>
                    <View className="pl-plan-meta-item">
                      <Text className="pl-plan-meta-label">
                        {tt('distribution.plan.productCount', '商品数')}
                      </Text>
                      <Text className="pl-plan-meta-value">{p.productCount}</Text>
                    </View>
                    <View className="pl-plan-meta-item">
                      <Text className="pl-plan-meta-label">
                        {tt('distribution.plan.viewDetail', '详情')}
                      </Text>
                      <Text className="pl-plan-meta-value pl-plan-arrow">›</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {list.length === 0 && !loading && !error && (
          <Text className="pl-empty">{t('distribution.plan.empty')}</Text>
        )}

        {error && !loading && (
          <View className="pl-error" onClick={() => load(true)}>
            <Text className="pl-error-text">
              {tt('distribution.plan.error', '加载失败')}
            </Text>
            <Text className="pl-error-retry">
              {tt('distribution.plan.retry', '点击重试')}
            </Text>
          </View>
        )}

        {loading && (
          <Text className="pl-loading">{t('distribution.plan.loading')}</Text>
        )}

        {!loading && !hasMore && list.length > 0 && (
          <Text className="pl-no-more">
            {tt('distribution.plan.noMore', '没有更多了')}
          </Text>
        )}
      </View>
    </View>
  )
}
