import { logger } from '@/utils/logger'
import { View, Text, Image, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getMemberInfo, getMemberBenefits, getProfile, type MemberInfo } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface BenefitItem {
  id: string
  title: string
  desc: string
  active?: boolean
}

interface LevelTier {
  key: string
  name: string
  threshold: string
  perks: string
}

/** 默认会员特权列表(对齐原 uniapp pages/member/index.vue 555 行版) */
const DEFAULT_BENEFITS: BenefitItem[] = [
  { id: 'unlimited', title: '无限对话', desc: '无限制使用 AI 对话功能', active: true },
  { id: 'advanced', title: '高级模型', desc: '使用最新的 AI 大模型', active: true },
  { id: 'priority', title: '优先响应', desc: '对话请求优先处理', active: true },
  { id: 'community', title: 'VIP 社区', desc: '加入专属 VIP 交流群', active: true },
]

/** 会员等级梯度:普通 / 银卡 / 金卡 / 钻石 */
const LEVEL_TIERS: LevelTier[] = [
  { key: 'normal', name: '普通会员', threshold: '注册即享', perks: '基础对话 / 有限次数' },
  { key: 'silver', name: '银卡会员', threshold: '成长值 ≥ 500', perks: '专属折扣 / 课程试听' },
  { key: 'gold', name: '金卡会员', threshold: '成长值 ≥ 2000', perks: '免费课程 / 专属客服' },
  { key: 'diamond', name: '钻石会员', threshold: '成长值 ≥ 8000', perks: '全部权益 / 私董会' },
]

/** 时间戳(秒/毫秒)或 ISO 字符串 → 毫秒数 */
const toMs = (v: number | string | undefined): number => {
  if (!v) return 0
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000
  const n = Number(v)
  if (!isNaN(n) && n > 0) return n > 1e12 ? n : n * 1000
  const d = Date.parse(v)
  return isNaN(d) ? 0 : d
}

/** 计算 VIP 到期剩余天数 */
const calcRemainDays = (expireTime: string | number | undefined): number => {
  const ms = toMs(expireTime)
  if (!ms) return 0
  const diff = ms - Date.now()
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0
}

/** 格式化时间 → YYYY-MM-DD */
const formatDate = (v: string | number | undefined): string => {
  const ms = toMs(v)
  if (!ms) return ''
  const d = new Date(ms)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 从 UserInfo 索引签名安全取值 */
const readStr = (obj: Record<string, unknown>, key: string): string | undefined => {
  const v = obj[key]
  return typeof v === 'string' ? v : v != null ? String(v) : undefined
}

export default function MemberIndexPage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  const [info, setInfo] = useState<MemberInfo>({} as MemberInfo)
  const [profile, setProfile] = useState<{
    nickname?: string
    avatar?: string
    isVip?: boolean
    vipExpireTime?: string
    isPermanentVip?: boolean
  }>({})
  const [benefits, setBenefits] = useState<BenefitItem[]>(DEFAULT_BENEFITS)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [memberInfo, userProfile, benefitsRes] = await Promise.all([
        getMemberInfo().catch(() => ({} as MemberInfo)),
        getProfile().catch(() => null),
        getMemberBenefits().catch(() => ({ list: [] as Array<{ id: string; title: string; desc: string; icon?: string }> })),
      ])
      setInfo(memberInfo)
      if (userProfile) {
        const raw = userProfile as Record<string, unknown>
        setProfile({
          nickname: userProfile.nickname,
          avatar: userProfile.avatar,
          isVip: Boolean(userProfile.isVip),
          vipExpireTime: readStr(raw, 'vipExpireTime'),
          isPermanentVip: Boolean(raw['isPermanentVip']),
        })
      }
      const list = (benefitsRes.list || []).map(
        (b): BenefitItem => ({ id: b.id, title: b.title, desc: b.desc, active: true }),
      )
      if (list.length > 0) setBenefits(list)
    } catch (e) {
      logger.error('member/index', '加载会员信息', e)
      Taro.showToast({ title: tt('member.index.loadFailed', '加载失败'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [tt])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  useDidShow(load)

  const isVip = Boolean(profile.isVip)
  const isPermanentVip = Boolean(profile.isPermanentVip)
  const remainDays = calcRemainDays(profile.vipExpireTime)
  const expireText = isPermanentVip
    ? tt('member.index.permanentVip', '永久有效')
    : profile.vipExpireTime
      ? remainDays > 0
        ? `${formatDate(profile.vipExpireTime)} ${tt('member.index.expire', '到期')}`
        : tt('member.index.expired', '已过期')
      : ''

  // 根据成长值推算当前等级
  const growth = info.growth || 0
  const currentLevelKey =
    growth >= 8000 ? 'diamond' : growth >= 2000 ? 'gold' : growth >= 500 ? 'silver' : 'normal'

  const goToPayment = () => {
    Taro.navigateTo({ url: '/pages/vip/index' })
  }

  const goToShare = () => {
    Taro.switchTab({ url: '/pages/distribution/index' }).catch(() => {
      Taro.navigateTo({ url: '/pages/distribution/index' })
    })
  }

  return (
    <ScrollView scrollY className="member-page">
      {/* ===== Header:用户信息 + VIP 状态 ===== */}
      <View className="member-header">
        <View className="member-user">
          <Image
            className="member-avatar"
            src={profile.avatar || '/static/default-avatar.png'}
            mode="aspectFill"
          />
          <View className="member-user-detail">
            <Text className="member-nickname">
              {profile.nickname || tt('member.index.guest', '游客')}
            </Text>
            {isVip ? (
              <View className="member-vip-badge">
                <Text className="member-vip-text">VIP</Text>
                <Text className="member-vip-expire">{expireText}</Text>
              </View>
            ) : (
              <Text className="member-normal-user">
                {tt('member.index.normalUser', '普通用户')}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* ===== 会员等级梯度 ===== */}
      <View className="member-card">
        <Text className="member-card-title">
          {tt('member.index.levelIntro', '会员等级介绍')}
        </Text>
        <View className="member-level-grid">
          {LEVEL_TIERS.map((tier) => (
            <View
              key={tier.key}
              className={`member-level-item member-level-${tier.key} ${
                tier.key === currentLevelKey ? 'member-level-current' : ''
              }`}
            >
              <Text className="member-level-name">{tier.name}</Text>
              <Text className="member-level-threshold">{tier.threshold}</Text>
              <Text className="member-level-perks">{tier.perks}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ===== 使用统计 ===== */}
      <View className="member-card">
        <Text className="member-card-title">
          {tt('member.index.usageStats', '使用统计')}
        </Text>
        <View className="member-stats">
          <View className="member-stat">
            <Text className="member-stat-num">{info.integral || 0}</Text>
            <Text className="member-stat-label">{tt('member.index.integral', '积分')}</Text>
          </View>
          <View className="member-stat">
            <Text className="member-stat-num">{info.growth || 0}</Text>
            <Text className="member-stat-label">{tt('member.index.growth', '成长值')}</Text>
          </View>
          <View className="member-stat">
            <Text className="member-stat-num">{info.coupons || 0}</Text>
            <Text className="member-stat-label">{tt('member.index.coupons', '优惠券')}</Text>
          </View>
        </View>
      </View>

      {/* ===== 会员特权列表 ===== */}
      <View className="member-card">
        <Text className="member-card-title">
          {tt('member.index.privileges', '会员特权')}
        </Text>
        <View className="member-benefits">
          {benefits.map((b) => (
            <View key={b.id} className="member-benefit-item">
              <View className="member-benefit-icon">
                <Text className="member-benefit-icon-text">★</Text>
              </View>
              <View className="member-benefit-content">
                <Text className="member-benefit-title">{b.title}</Text>
                <Text className="member-benefit-desc">{b.desc}</Text>
              </View>
              <Text
                className={`member-benefit-status ${isVip ? 'member-benefit-active' : ''}`}
              >
                {isVip
                  ? tt('member.index.opened', '已开通')
                  : tt('member.index.notOpened', '未开通')}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* ===== VIP CTA(三态) ===== */}
      {!isVip ? (
        <View className="member-vip-cta">
          <View className="member-vip-info">
            <Text className="member-vip-title">
              {tt('member.index.openVip', '开通 VIP 会员')}
            </Text>
            <Text className="member-vip-desc">
              {tt('member.index.openVipDesc', '享受更多特权,提升 AI 体验')}
            </Text>
            <View className="member-vip-price">
              <Text className="member-current-price">¥588</Text>
              <Text className="member-original-price">¥1288</Text>
            </View>
          </View>
          <Button className="member-vip-button" onClick={goToPayment}>
            {tt('member.index.openNow', '立即开通')}
          </Button>
        </View>
      ) : isPermanentVip ? (
        <View className="member-vip-section member-vip-permanent">
          <View className="member-permanent-badge">
            <Text className="member-crown">♛</Text>
            <Text className="member-permanent-text">
              {tt('member.index.permanentActive', '您已是永久 VIP 会员')}
            </Text>
          </View>
          <Text className="member-cta-text">
            {tt('member.index.allPrivileges', '已享有全部特权')}
          </Text>
        </View>
      ) : (
        <View className="member-vip-section">
          <View className="member-vip-price">
            <Text className="member-price-label">
              {tt('member.index.upgradePermanent', '升级永久 VIP 会员')}
            </Text>
            <View className="member-price-display">
              <Text className="member-current-price">¥588</Text>
              <Text className="member-original-price">¥1288</Text>
            </View>
          </View>
          <Text className="member-cta-text">
            {tt('member.index.upgradeHint', '您已是 VIP 会员,可升级为永久 VIP')}
          </Text>
          <Button className="member-cta-button member-cta-outlined" onClick={goToPayment}>
            {tt('member.index.upgradeNow', '升级永久 VIP')}
          </Button>
        </View>
      )}

      {/* ===== 快捷入口 ===== */}
      <View className="member-menu">
        <View className="member-menu-item" onClick={() => navigate('/pages/member/benefits')}>
          <Text>{tt('member.index.benefits', '会员权益')}</Text>
          <Text className="member-arrow">›</Text>
        </View>
        <View className="member-menu-item" onClick={() => navigate('/pages/member/integral')}>
          <Text>{tt('member.index.integralDetail', '积分明细')}</Text>
          <Text className="member-arrow">›</Text>
        </View>
        <View className="member-menu-item" onClick={() => navigate('/pages/member/coupon')}>
          <Text>{tt('member.index.myCoupons', '我的优惠券')}</Text>
          <Text className="member-arrow">›</Text>
        </View>
        <View className="member-menu-item" onClick={() => navigate('/pages/member/coupon-list')}>
          <Text>{tt('member.index.couponCenter', '领券中心')}</Text>
          <Text className="member-arrow">›</Text>
        </View>
        <View className="member-menu-item" onClick={() => navigate('/pages/vip/index')}>
          <Text>{tt('member.index.vip', 'VIP 会员')}</Text>
          <Text className="member-arrow">›</Text>
        </View>
        <View className="member-menu-item" onClick={goToShare}>
          <Text>{tt('member.index.share', '分享赚佣金')}</Text>
          <Text className="member-arrow">›</Text>
        </View>
      </View>

      {/* ===== 联系客服 ===== */}
      <View className="member-contact">
        <Text className="member-contact-title">
          {tt('member.index.contactTitle', '遇到问题?')}
        </Text>
        <Text className="member-contact-text">
          {tt('member.index.contactText', '联系客服微信:AIXHS_Service')}
        </Text>
      </View>

      {loading && (
        <View className="member-loading">
          <Text>{tt('member.index.loading', '加载中…')}</Text>
        </View>
      )}
    </ScrollView>
  )
}
