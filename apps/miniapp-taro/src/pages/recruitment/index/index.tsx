import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface Requirement {
  id: string
  title: string
  desc: string
}

interface Privilege {
  id: string
  title: string
  desc: string
  icon?: string
}

interface IncomeEstimate {
  level: string
  monthly: string
  yearly: string
}

interface RecruitmentInfo {
  title: string
  banner?: string
  requirements: Requirement[]
  privileges: Privilege[]
  incomeEstimates: IncomeEstimate[]
}

export default function RecruitmentIndexPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [info, setInfo] = useState<RecruitmentInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<RecruitmentInfo>('/recruitment')
      setInfo(res)
    } catch (e) {
      logger.error('unknown', '加载招募信息', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  const onApply = useCallback(async () => {
    if (submitting) return
    const invite = router.params.invite
    setSubmitting(true)
    try {
      await post('/recruitment/apply', { invite: invite || undefined })
      Taro.showToast({ title: t('recruitment.applied'), icon: 'success' })
      setTimeout(() => {
        Taro.navigateTo({ url: '/pages/vip-trader/index/index' })
      }, 800)
    } catch (e) {
      logger.error('unknown', '提交申请', e)
    } finally {
      setSubmitting(false)
    }
  }, [submitting, router.params.invite, t])

  if (loading && !info) {
    return (
      <View className="recruitment-page">
        <View className="recruit-empty">
          <Text>{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (!info) {
    return (
      <View className="recruitment-page">
        <View className="recruit-empty">
          <Text>{t('recruitment.empty')}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="recruitment-page">
      <View className="recruit-header">
        {info.banner ? (
          <Image className="recruit-banner" src={info.banner} mode="aspectFill" />
        ) : null}
        <View className="recruit-header-mask">
          <Text className="recruit-title">{info.title || t('recruitment.defaultTitle')}</Text>
          <Text className="recruit-subtitle">{t('recruitment.subtitle')}</Text>
        </View>
      </View>

      <View className="recruit-section">
        <Text className="section-title">{t('recruitment.requirements')}</Text>
        <View className="req-list">
          {info.requirements.map((item) => (
            <View key={item.id} className="req-item">
              <View className="req-dot" />
              <View className="req-content">
                <Text className="req-item-title">{item.title}</Text>
                <Text className="req-item-desc">{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="recruit-section">
        <Text className="section-title">{t('recruitment.privileges')}</Text>
        <View className="priv-grid">
          {info.privileges.map((item) => (
            <View key={item.id} className="priv-item">
              {item.icon ? (
                <Image className="priv-icon" src={item.icon} mode="aspectFit" />
              ) : (
                <View className="priv-icon-default">
                  <Text className="priv-icon-text">★</Text>
                </View>
              )}
              <Text className="priv-item-title">{item.title}</Text>
              <Text className="priv-item-desc">{item.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="recruit-section">
        <Text className="section-title">{t('recruitment.incomeEstimate')}</Text>
        <View className="income-list">
          {info.incomeEstimates.map((item) => (
            <View key={item.level} className="income-item">
              <Text className="income-level">{item.level}</Text>
              <View className="income-detail">
                <View className="income-row">
                  <Text className="income-label">{t('recruitment.monthlyIncome')}</Text>
                  <Text className="income-value">{item.monthly}</Text>
                </View>
                <View className="income-row">
                  <Text className="income-label">{t('recruitment.yearlyIncome')}</Text>
                  <Text className="income-value">{item.yearly}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="recruit-footer">
        <View className={`apply-btn${submitting ? ' disabled' : ''}`} onClick={onApply}>
          <Text>{submitting ? t('recruitment.submitting') : t('recruitment.apply')}</Text>
        </View>
      </View>
    </View>
  )
}
