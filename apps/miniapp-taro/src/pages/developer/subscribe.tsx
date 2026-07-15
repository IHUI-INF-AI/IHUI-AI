import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getDeveloperPricingList, subscribeDeveloper, type DeveloperPricing } from '@/api'
import './subscribe.css'

const PERIOD_LABEL: Record<string, string> = {
  monthly: '月度',
  yearly: '年度',
}

export default function DeveloperSubscribePage() {
  const [list, setList] = useState<DeveloperPricing[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await getDeveloperPricingList()
      setList(res?.list || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  const onSubscribe = useCallback(async () => {
    const plan = list[selected]
    if (!plan || submitting) return
    setSubmitting(true)
    try {
      const period = (plan.period as 'monthly' | 'yearly') || 'monthly'
      const res = await subscribeDeveloper({ pricingId: plan.id, period })
      Taro.navigateTo({ url: `/pages/pay/index?orderNo=${res.orderNo}` })
    } catch (e) {
      logger.error('developer/subscribe', '开通套餐', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [list, selected, submitting])

  const current = list[selected]
  const periodText = current ? PERIOD_LABEL[current.period || ''] || current.period || '月度' : ''

  return (
    <View className="page">
      <View className="banner">
        <View className="banner-title">开发者套餐</View>
        <View className="banner-desc">开通开发者权益，解锁 API 调用与智能体发布</View>
      </View>
      <View className="plan-list">
        {loading ? (
          <Text className="loading-text">加载中...</Text>
        ) : list.length ? (
          list.map((p, i) => (
            <View
              key={p.id}
              className={`plan-card${selected === i ? ' active' : ''}`}
              onClick={() => setSelected(i)}
            >
              {i === 1 ? <View className="plan-tag">推荐</View> : null}
              <View className="plan-head">
                <Text className="plan-name">{p.name}</Text>
                <Text className="plan-period">
                  {PERIOD_LABEL[p.period || ''] || p.period || '月度'}
                </Text>
              </View>
              <Text className="plan-price">{p.price}</Text>
              {Array.isArray(p.features) && p.features.length ? (
                <View className="plan-features">
                  {p.features.map((f, fi) => (
                    <Text key={fi} className="plan-feature">
                      · {f}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <Text className="empty-text">暂无可选套餐</Text>
        )}
      </View>
      {current ? (
        <Button className="btn" disabled={submitting} onClick={onSubscribe}>
          {submitting ? '提交中...' : `立即开通 ¥${current.price} / ${periodText}`}
        </Button>
      ) : null}
    </View>
  )
}
