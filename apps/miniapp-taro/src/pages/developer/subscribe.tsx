import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getDeveloperPricingList, subscribeDeveloper, type DeveloperPricing } from '@/api'
import { useI18n } from '@/i18n'
import './subscribe.css'

export default function DeveloperSubscribePage() {
  const { t } = useI18n()
  const [list, setList] = useState<DeveloperPricing[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const periodLabel = useCallback(
    (period?: string | null) => {
      if (period === 'monthly') return t('developer.subscribe.monthly')
      if (period === 'yearly') return t('developer.subscribe.yearly')
      return t('developer.subscribe.monthly')
    },
    [t],
  )

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
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [list, selected, submitting, t])

  const current = list[selected]
  const periodText = current ? periodLabel(current.period) : ''

  return (
    <View className="page">
      <View className="banner">
        <View className="banner-title">{t('developer.subscribe.bannerTitle')}</View>
        <View className="banner-desc">{t('developer.subscribe.bannerDesc')}</View>
      </View>
      <View className="plan-list">
        {loading ? (
          <Text className="loading-text">{t('common.loading')}</Text>
        ) : list.length ? (
          list.map((p, i) => (
            <View
              key={p.id}
              className={`plan-card${selected === i ? ' active' : ''}`}
              onClick={() => setSelected(i)}
            >
              {i === 1 ? (
                <View className="plan-tag">{t('developer.subscribe.recommended')}</View>
              ) : null}
              <View className="plan-head">
                <Text className="plan-name">{p.name}</Text>
                <Text className="plan-period">{periodLabel(p.period)}</Text>
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
          <Text className="empty-text">{t('developer.subscribe.empty')}</Text>
        )}
      </View>
      {current ? (
        <Button className="btn" disabled={submitting} onClick={onSubscribe}>
          {submitting
            ? t('developer.subscribe.submitting')
            : t('developer.subscribe.priceLabel', { price: current.price, period: periodText })}
        </Button>
      ) : null}
    </View>
  )
}
