// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import { useState, useCallback } from 'react'
import { getMemberBenefits } from '@/api'
import { logger } from '@/utils/logger'
import { REMOTE_ICONS, icon } from '@/constants/remote-icons'
import ThemeRoot from '@/components/ThemeRoot'
// 会员权益主题图标(2026-07-30 生成,扁平化设计统一风格)
// 用字符串路径让 Taro copy 到 dist/static/ 而非打包进 benefits.js chunk(11 个图标 ~1MB,base64 内联会让 chunk 暴涨)
const shoppingIcon = '/pages/member/assets/benefits/shopping.png'
const sparkleIcon = '/pages/member/assets/benefits/sparkle.png'
const giftIcon = '/pages/member/assets/benefits/gift.png'
const calendarIcon = '/pages/member/assets/benefits/calendar.png'
const mailIcon = '/pages/member/assets/benefits/mail.png'
const silverIcon = '/pages/member/assets/benefits/silver.png'
const birthdayIcon = '/pages/member/assets/benefits/birthday.png'
const truckIcon = '/pages/member/assets/benefits/truck.png'
const ticketIcon = '/pages/member/assets/benefits/ticket.png'
const partyIcon = '/pages/member/assets/benefits/party.png'
const trophyIcon = '/pages/member/assets/benefits/trophy.png'

// 统一判断 icon 是否为图片路径(http(s):// 远程 URL 或 / 开头本地路径或 import 路径)
function isImagePath(s: string): boolean {
  return /^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('data:')
}

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
    icon: REMOTE_ICONS.xing!,
    nk: 'member.benefits.tier.normal',
    nf: '普通会员',
    benefits: [
      {
        icon: shoppingIcon,
        tk: 'member.benefits.b.discount',
        tf: '购物折扣',
        dk: 'member.benefits.b.discountD1',
        df: '全场商品 95 折',
      },
      {
        icon: sparkleIcon,
        tk: 'member.benefits.b.points',
        tf: '积分加速',
        dk: 'member.benefits.b.pointsD1',
        df: '消费 1 元得 1 积分',
      },
      {
        icon: giftIcon,
        tk: 'member.benefits.b.gift',
        tf: '新人礼包',
        dk: 'member.benefits.b.giftD',
        df: '注册专享礼包',
      },
      {
        icon: calendarIcon,
        tk: 'member.benefits.b.sign',
        tf: '每日签到',
        dk: 'member.benefits.b.signD',
        df: '每日签到领积分',
      },
      {
        icon: mailIcon,
        tk: 'member.benefits.b.news',
        tf: '优惠资讯',
        dk: 'member.benefits.b.newsD',
        df: '优惠活动通知',
      },
    ],
  },
  {
    key: 'silver',
    icon: silverIcon,
    nk: 'member.benefits.tier.silver',
    nf: '银卡会员',
    benefits: [
      {
        icon: shoppingIcon,
        tk: 'member.benefits.b.discount',
        tf: '购物折扣',
        dk: 'member.benefits.b.discountD2',
        df: '全场商品 9 折',
      },
      {
        icon: sparkleIcon,
        tk: 'member.benefits.b.pointsMul',
        tf: '积分倍数',
        dk: 'member.benefits.b.pointsMulD2',
        df: '1.2 倍积分加速',
      },
      {
        icon: birthdayIcon,
        tk: 'member.benefits.b.birthday',
        tf: '生日礼包',
        dk: 'member.benefits.b.birthdayD',
        df: '生日专享礼包',
      },
      {
        icon: truckIcon,
        tk: 'member.benefits.b.shipping',
        tf: '免邮特权',
        dk: 'member.benefits.b.shippingD2',
        df: '每月 3 次免邮',
      },
      {
        icon: ticketIcon,
        tk: 'member.benefits.b.coupon',
        tf: '专属优惠券',
        dk: 'member.benefits.b.couponD2',
        df: '每月 2 张优惠券',
      },
      {
        icon: calendarIcon,
        tk: 'member.benefits.b.sign',
        tf: '每日签到',
        dk: 'member.benefits.b.signD2',
        df: '签到领双倍积分',
      },
    ],
  },
  {
    key: 'gold',
    icon: REMOTE_ICONS.gold!,
    nk: 'member.benefits.tier.gold',
    nf: '金卡会员',
    benefits: [
      {
        icon: shoppingIcon,
        tk: 'member.benefits.b.discount',
        tf: '购物折扣',
        dk: 'member.benefits.b.discountD3',
        df: '全场商品 85 折',
      },
      {
        icon: sparkleIcon,
        tk: 'member.benefits.b.pointsMul',
        tf: '积分倍数',
        dk: 'member.benefits.b.pointsMulD3',
        df: '1.5 倍积分加速',
      },
      {
        icon: birthdayIcon,
        tk: 'member.benefits.b.birthday',
        tf: '生日礼包',
        dk: 'member.benefits.b.birthdayD3',
        df: '生日双倍礼包',
      },
      {
        icon: truckIcon,
        tk: 'member.benefits.b.shipping',
        tf: '免邮特权',
        dk: 'member.benefits.b.shippingD3',
        df: '无限次免邮',
      },
      {
        icon: REMOTE_ICONS.privateadvisory!,
        tk: 'member.benefits.b.service',
        tf: '专属客服',
        dk: 'member.benefits.b.serviceD',
        df: '1 对 1 专属服务',
      },
      {
        icon: ticketIcon,
        tk: 'member.benefits.b.coupon',
        tf: '专属优惠券',
        dk: 'member.benefits.b.couponD3',
        df: '每月 5 张优惠券',
      },
      {
        icon: partyIcon,
        tk: 'member.benefits.b.preview',
        tf: '优先体验',
        dk: 'member.benefits.b.previewD',
        df: '新功能优先体验',
      },
    ],
  },
  {
    key: 'diamond',
    icon: REMOTE_ICONS.zuan!,
    nk: 'member.benefits.tier.diamond',
    nf: '钻石会员',
    benefits: [
      {
        icon: shoppingIcon,
        tk: 'member.benefits.b.discount',
        tf: '购物折扣',
        dk: 'member.benefits.b.discountD4',
        df: '全场商品 8 折',
      },
      {
        icon: sparkleIcon,
        tk: 'member.benefits.b.pointsMul',
        tf: '积分倍数',
        dk: 'member.benefits.b.pointsMulD4',
        df: '2 倍积分加速',
      },
      {
        icon: birthdayIcon,
        tk: 'member.benefits.b.birthday',
        tf: '生日礼包',
        dk: 'member.benefits.b.birthdayD4',
        df: '生日豪华礼包',
      },
      {
        icon: truckIcon,
        tk: 'member.benefits.b.shipping',
        tf: '免邮特权',
        dk: 'member.benefits.b.shippingD4',
        df: '无限次免邮',
      },
      {
        icon: icon('privateadvisory'),
        tk: 'member.benefits.b.service',
        tf: '专属客服',
        dk: 'member.benefits.b.serviceD4',
        df: '7×24 专属管家',
      },
      {
        icon: ticketIcon,
        tk: 'member.benefits.b.coupon',
        tf: '专属优惠券',
        dk: 'member.benefits.b.couponD4',
        df: '每月 10 张优惠券',
      },
      {
        icon: partyIcon,
        tk: 'member.benefits.b.preview',
        tf: '优先体验',
        dk: 'member.benefits.b.previewD4',
        df: '新功能首发体验',
      },
      {
        icon: trophyIcon,
        tk: 'member.benefits.b.event',
        tf: '尊享活动',
        dk: 'member.benefits.b.eventD',
        df: '线下高端活动',
      },
    ],
  },
]

// 等级头部底色对齐 RN 共享屏视觉语言(无彩色渐变,统一 surface.muted 底 + 前景文字)
const TIER_HEAD_CLASS = 'bg-muted text-foreground'

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
    <ThemeRoot>
      <View className="min-h-screen bg-background p-[28rpx] pb-[64rpx]">
        <View className="text-[32rpx] font-bold text-foreground mt-[8rpx] mb-[24rpx]">
          {tt('member.benefits.myBenefits', '我的专属权益')}
        </View>
        {loading ? (
          <View className="flex flex-col items-center py-[64rpx] text-muted-foreground text-[28rpx]">
            <Text>{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="flex flex-col items-center py-[64rpx] text-muted-foreground text-[28rpx]">
            <Text>{tt('member.benefits.loadFailed', '加载失败')}</Text>
            <Text
              className="mt-[16rpx] px-[32rpx] py-[8rpx] text-[28rpx] text-primary"
              onClick={load}
            >
              {t('common.retry')}
            </Text>
          </View>
        ) : list.length ? (
          <View className="flex flex-col gap-[24rpx]">
            {list.map((b) => (
              <View
                key={b.id}
                className="bg-card border border-[var(--color-border)] rounded-[24rpx] p-[28rpx]"
              >
                {b.icon ? (
                  <Text className="block text-[48rpx]">{b.icon}</Text>
                ) : (
                  <LineIcon
                    name="star-fill"
                    size={48}
                    color="var(--color-warning)"
                    className="mx-auto"
                  />
                )}
                {/* 兼容后端返回的 icon 为图片路径时,用 Image 渲染 */}
                {b.icon && isImagePath(b.icon) ? (
                  <Image src={b.icon} className="w-12 h-12 mx-auto mt-[8rpx]" mode="aspectFit" />
                ) : null}
                <Text className="block mt-[12rpx] text-[32rpx] font-bold text-foreground">
                  {b.title}
                </Text>
                <Text className="block mt-[16rpx] text-[28rpx] text-muted-foreground leading-[36rpx]">
                  {b.desc}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="flex flex-col items-center py-[64rpx] text-muted-foreground text-[28rpx]">
            <Text>{tt('member.benefits.empty', '暂无权益')}</Text>
          </View>
        )}

        <View className="text-[32rpx] font-bold text-foreground mt-[32rpx] mb-[24rpx]">
          {tt('member.benefits.tierCatalog', '等级权益')}
        </View>
        {TIERS.map((tier) => (
          <View
            key={tier.key}
            className="bg-card border border-[var(--color-border)] rounded-[24rpx] overflow-hidden mb-[24rpx]"
          >
            <View className={`flex items-center px-[28rpx] py-[24rpx] ${TIER_HEAD_CLASS}`}>
              {isImagePath(tier.icon) ? (
                <Image src={tier.icon} className="w-6 h-6 mr-[16rpx]" mode="aspectFit" />
              ) : (
                <Text className="text-[40rpx] mr-[16rpx]">{tier.icon}</Text>
              )}
              <Text className="text-[32rpx] font-bold">{tt(tier.nk, tier.nf)}</Text>
            </View>
            <View className="py-[8rpx]">
              {tier.benefits.map((b, i) => (
                <View key={i} className="flex items-center px-[28rpx] py-[20rpx]">
                  {isImagePath(b.icon) ? (
                    <Image src={b.icon} className="w-5 h-5 flex-shrink-0" mode="aspectFit" />
                  ) : (
                    <Text className="text-[36rpx] w-[48rpx] text-center flex-shrink-0">
                      {b.icon}
                    </Text>
                  )}
                  <View className="flex-1 ml-[16rpx]">
                    <Text className="block text-[28rpx] text-[var(--color-text-medium)] font-medium">
                      {tt(b.tk, b.tf)}
                    </Text>
                    <Text className="block mt-[6rpx] text-[22rpx] text-muted-foreground">
                      {tt(b.dk, b.df)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
