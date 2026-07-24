import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getMemberBenefits } from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'

interface Benefit {
  id: string
  title: string
  desc: string
  icon?: string
}

interface TierBenefit {
  icon: string
  tk: string
  tf: string
  dk: string
  df: string
}

interface Tier {
  key: string
  icon: string
  nk: string
  nf: string
  benefits: TierBenefit[]
}

const TIERS: Tier[] = [
  {
    key: 'normal',
    icon: '★',
    nk: 'member.benefits.tier.normal',
    nf: '普通会员',
    benefits: [
      { icon: '🛒', tk: 'member.benefits.b.discount', tf: '购物折扣', dk: 'member.benefits.b.discountD1', df: '全场商品 95 折' },
      { icon: '✨', tk: 'member.benefits.b.points', tf: '积分加速', dk: 'member.benefits.b.pointsD1', df: '消费 1 元得 1 积分' },
      { icon: '🎁', tk: 'member.benefits.b.gift', tf: '新人礼包', dk: 'member.benefits.b.giftD', df: '注册专享礼包' },
      { icon: '📅', tk: 'member.benefits.b.sign', tf: '每日签到', dk: 'member.benefits.b.signD', df: '每日签到领积分' },
      { icon: '💌', tk: 'member.benefits.b.news', tf: '优惠资讯', dk: 'member.benefits.b.newsD', df: '优惠活动通知' },
    ],
  },
  {
    key: 'silver',
    icon: '🥈',
    nk: 'member.benefits.tier.silver',
    nf: '银卡会员',
    benefits: [
      { icon: '🛒', tk: 'member.benefits.b.discount', tf: '购物折扣', dk: 'member.benefits.b.discountD2', df: '全场商品 9 折' },
      { icon: '✨', tk: 'member.benefits.b.pointsMul', tf: '积分倍数', dk: 'member.benefits.b.pointsMulD2', df: '1.2 倍积分加速' },
      { icon: '🎂', tk: 'member.benefits.b.birthday', tf: '生日礼包', dk: 'member.benefits.b.birthdayD', df: '生日专享礼包' },
      { icon: '🚚', tk: 'member.benefits.b.shipping', tf: '免邮特权', dk: 'member.benefits.b.shippingD2', df: '每月 3 次免邮' },
      { icon: '🎟️', tk: 'member.benefits.b.coupon', tf: '专属优惠券', dk: 'member.benefits.b.couponD2', df: '每月 2 张优惠券' },
      { icon: '📅', tk: 'member.benefits.b.sign', tf: '每日签到', dk: 'member.benefits.b.signD2', df: '签到领双倍积分' },
    ],
  },
  {
    key: 'gold',
    icon: '🥇',
    nk: 'member.benefits.tier.gold',
    nf: '金卡会员',
    benefits: [
      { icon: '🛒', tk: 'member.benefits.b.discount', tf: '购物折扣', dk: 'member.benefits.b.discountD3', df: '全场商品 85 折' },
      { icon: '✨', tk: 'member.benefits.b.pointsMul', tf: '积分倍数', dk: 'member.benefits.b.pointsMulD3', df: '1.5 倍积分加速' },
      { icon: '🎂', tk: 'member.benefits.b.birthday', tf: '生日礼包', dk: 'member.benefits.b.birthdayD3', df: '生日双倍礼包' },
      { icon: '🚚', tk: 'member.benefits.b.shipping', tf: '免邮特权', dk: 'member.benefits.b.shippingD3', df: '无限次免邮' },
      { icon: '📞', tk: 'member.benefits.b.service', tf: '专属客服', dk: 'member.benefits.b.serviceD', df: '1 对 1 专属服务' },
      { icon: '🎟️', tk: 'member.benefits.b.coupon', tf: '专属优惠券', dk: 'member.benefits.b.couponD3', df: '每月 5 张优惠券' },
      { icon: '🎉', tk: 'member.benefits.b.preview', tf: '优先体验', dk: 'member.benefits.b.previewD', df: '新功能优先体验' },
    ],
  },
  {
    key: 'diamond',
    icon: '💎',
    nk: 'member.benefits.tier.diamond',
    nf: '钻石会员',
    benefits: [
      { icon: '🛒', tk: 'member.benefits.b.discount', tf: '购物折扣', dk: 'member.benefits.b.discountD4', df: '全场商品 8 折' },
      { icon: '✨', tk: 'member.benefits.b.pointsMul', tf: '积分倍数', dk: 'member.benefits.b.pointsMulD4', df: '2 倍积分加速' },
      { icon: '🎂', tk: 'member.benefits.b.birthday', tf: '生日礼包', dk: 'member.benefits.b.birthdayD4', df: '生日豪华礼包' },
      { icon: '🚚', tk: 'member.benefits.b.shipping', tf: '免邮特权', dk: 'member.benefits.b.shippingD4', df: '无限次免邮' },
      { icon: '📞', tk: 'member.benefits.b.service', tf: '专属客服', dk: 'member.benefits.b.serviceD4', df: '7×24 专属管家' },
      { icon: '🎟️', tk: 'member.benefits.b.coupon', tf: '专属优惠券', dk: 'member.benefits.b.couponD4', df: '每月 10 张优惠券' },
      { icon: '🎉', tk: 'member.benefits.b.preview', tf: '优先体验', dk: 'member.benefits.b.previewD4', df: '新功能首发体验' },
      { icon: '🏆', tk: 'member.benefits.b.event', tf: '尊享活动', dk: 'member.benefits.b.eventD', df: '线下高端活动' },
    ],
  },
]

const TIER_HEAD_CLASS: Record<string, string> = {
  normal: 'bg-[linear-gradient(135deg,#6b7280,#9ca3af)] text-white',
  silver: 'bg-[linear-gradient(135deg,#b8c0c8,#e8edf2)] text-[#1f1f28]',
  gold: 'bg-[linear-gradient(135deg,#d4af6a,#f5d98a)] text-[#1f1f28]',
  diamond: 'bg-[linear-gradient(135deg,#6ec1e4,#b9f2ff)] text-[#1f1f28]',
}

export default function BenefitsPage() {
  const { t } = useI18n()
  const [list, setList] = useState<Benefit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const tt = (key: string, fallback: string, params?: Record<string, string | number>) => {
    const v = t(key, params)
    if (v === key) {
      if (!params) return fallback
      return fallback.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
    }
    return v
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await getMemberBenefits()
      setList(res.list || [])
    } catch (e) {
      logger.error('member/benefits', '获取权益', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => load())

  return (
    <View className="min-h-screen bg-background p-[24rpx] pb-[48rpx]">
      <View className="text-[30rpx] font-semibold text-foreground mt-[8rpx] mx-[8rpx] mb-[16rpx]">{tt('member.benefits.myBenefits', '我的专属权益')}</View>
      {loading ? (
        <View className="flex flex-col items-center py-[60rpx] text-muted-foreground text-[26rpx]">
          <Text>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View className="flex flex-col items-center py-[60rpx] text-muted-foreground text-[26rpx]">
          <Text>{tt('member.benefits.loadFailed', '加载失败')}</Text>
          <Text className="mt-[16rpx] px-[32rpx] py-[8rpx] text-[24rpx] text-primary" onClick={load}>
            {t('common.retry')}
          </Text>
        </View>
      ) : list.length ? (
        <View className="flex flex-wrap gap-[16rpx]">
          {list.map((b) => (
            <View key={b.id} className="w-[calc(50%-8rpx)] bg-card rounded-[16rpx] py-[24rpx] px-[16rpx] text-center">
              <Text className="block text-[48rpx]">{b.icon || '★'}</Text>
              <Text className="block mt-[12rpx] text-[28rpx] font-semibold text-foreground">{b.title}</Text>
              <Text className="block mt-[8rpx] text-[22rpx] text-muted-foreground">{b.desc}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View className="flex flex-col items-center py-[60rpx] text-muted-foreground text-[26rpx]">
          <Text>{tt('member.benefits.empty', '暂无权益')}</Text>
        </View>
      )}

      <View className="text-[30rpx] font-semibold text-foreground mt-[24rpx] mx-[8rpx] mb-[16rpx]">{tt('member.benefits.tierCatalog', '等级权益')}</View>
      {TIERS.map((tier) => (
        <View key={tier.key} className="bg-card rounded-[16rpx] overflow-hidden mb-[24rpx]">
          <View className={`flex items-center px-[32rpx] py-[24rpx] ${TIER_HEAD_CLASS[tier.key]}`}>
            <Text className="text-[40rpx] mr-[16rpx]">{tier.icon}</Text>
            <Text className="text-[30rpx] font-bold">{tt(tier.nk, tier.nf)}</Text>
          </View>
          <View className="py-[8rpx]">
            {tier.benefits.map((b, i) => (
              <View key={i} className="flex items-center px-[32rpx] py-[20rpx]">
                <Text className="text-[36rpx] w-[48rpx] text-center flex-shrink-0">{b.icon}</Text>
                <View className="flex-1 ml-[16rpx]">
                  <Text className="block text-[28rpx] text-foreground font-medium">{tt(b.tk, b.tf)}</Text>
                  <Text className="block mt-[6rpx] text-[22rpx] text-muted-foreground">{tt(b.dk, b.df)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}
