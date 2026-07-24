import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'

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
      <View className="min-h-[100vh] bg-background pb-[140rpx]">
        <View className="text-center text-muted-foreground py-[120rpx] text-[28rpx]">
          <Text>{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  if (!info) {
    return (
      <View className="min-h-[100vh] bg-background pb-[140rpx]">
        <View className="text-center text-muted-foreground py-[120rpx] text-[28rpx]">
          <Text>{t('recruitment.empty')}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="min-h-[100vh] bg-background pb-[140rpx]">
      <View className="relative w-full h-[320rpx] bg-primary overflow-hidden">
        {info.banner ? (
          <Image className="absolute top-0 left-0 w-full h-full" src={info.banner} mode="aspectFill" />
        ) : null}
        <View className="relative z-[1] px-[30rpx] py-[80rpx] flex flex-col">
          <Text className="text-[44rpx] font-bold text-foreground">{info.title || t('recruitment.defaultTitle')}</Text>
          <Text className="mt-[16rpx] text-[26rpx] text-[rgba(255,255,255,0.85)]">{t('recruitment.subtitle')}</Text>
        </View>
      </View>

      <View className="mx-[20rpx] p-[24rpx] bg-card rounded-2xl">
        <Text className="text-[32rpx] font-semibold text-foreground block mb-[20rpx]">{t('recruitment.requirements')}</Text>
        <View className="flex flex-col">
          {info.requirements.map((item) => (
            <View key={item.id} className="flex items-start py-[16rpx]">
              <View className="w-[12rpx] h-[12rpx] [border-radius:6rpx] bg-primary mt-[12rpx] mr-[16rpx] shrink-0" />
              <View className="flex-1 flex flex-col">
                <Text className="text-[28rpx] font-medium text-foreground">{item.title}</Text>
                <Text className="mt-[8rpx] text-[24rpx] text-muted-foreground leading-[1.5]">{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="mx-[20rpx] p-[24rpx] bg-card rounded-2xl">
        <Text className="text-[32rpx] font-semibold text-foreground block mb-[20rpx]">{t('recruitment.privileges')}</Text>
        <View className="flex flex-wrap">
          {info.privileges.map((item) => (
            <View key={item.id} className="w-1/2 p-[16rpx] box-border flex flex-col items-center">
              {item.icon ? (
                <Image className="w-[64rpx] h-[64rpx]" src={item.icon} mode="aspectFit" />
              ) : (
                <View className="w-[64rpx] h-[64rpx] rounded-2xl bg-[rgba(245,158,11,0.1)] flex items-center justify-center">
                  <Text className="text-[32rpx] text-warning">★</Text>
                </View>
              )}
              <Text className="mt-[12rpx] text-[26rpx] text-foreground text-center">{item.title}</Text>
              <Text className="mt-[6rpx] text-[22rpx] text-muted-foreground text-center">{item.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mx-[20rpx] p-[24rpx] bg-card rounded-2xl">
        <Text className="text-[32rpx] font-semibold text-foreground block mb-[20rpx]">{t('recruitment.incomeEstimate')}</Text>
        <View className="flex flex-col">
          {info.incomeEstimates.map((item, idx) => (
            <View key={item.level} className={`py-[20rpx]${idx > 0 ? ' mt-[16rpx]' : ''}`}>
              <Text className="text-[28rpx] font-semibold text-primary">{item.level}</Text>
              <View className="mt-[12rpx] flex flex-col">
                <View className="flex justify-between items-center py-[8rpx]">
                  <Text className="text-[26rpx] text-muted-foreground">{t('recruitment.monthlyIncome')}</Text>
                  <Text className="text-[28rpx] font-semibold text-warning">{item.monthly}</Text>
                </View>
                <View className="flex justify-between items-center py-[8rpx]">
                  <Text className="text-[26rpx] text-muted-foreground">{t('recruitment.yearlyIncome')}</Text>
                  <Text className="text-[28rpx] font-semibold text-warning">{item.yearly}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="fixed bottom-0 left-0 w-full px-[30rpx] py-[20rpx] box-border bg-card [box-shadow:0_-2rpx_12rpx_rgba(0,0,0,0.06)]">
        <View className={`h-[88rpx] bg-primary text-foreground text-[32rpx] [border-radius:44rpx] flex items-center justify-center${submitting ? ' opacity-60' : ''}`} onClick={onApply}>
          <Text>{submitting ? t('recruitment.submitting') : t('recruitment.apply')}</Text>
        </View>
      </View>
    </View>
  )
}
