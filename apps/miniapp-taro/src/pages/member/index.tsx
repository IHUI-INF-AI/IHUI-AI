// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/vip/VipScreen.tsx
import { useTt, t } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image, Button, ScrollView } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { useDidShow } from '@tarojs/taro'
import {
  getMemberInfo,
  getMemberBenefits,
  getProfile,
  getVipLevels,
  type MemberInfo,
  type VipLevel,
} from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { calcVipRemainDays, formatDateByTemplate } from '@ihui/shared'
import { formatPrice } from '@ihui/shared/utils/format'
import ThemeRoot from '@/components/ThemeRoot'
import VipLevels, { pickEntryLevel, pickPermanentLevel } from './vip-levels'
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

/** 等级成长值阈值(与 levelTiers 一一对应) */
const GROWTH_THRESHOLDS: Record<string, number> = {
  normal: 0,
  silver: 500,
  gold: 2000,
  diamond: 8000,
}

/** 从 UserInfo 索引签名安全取值 */
const readStr = (obj: Record<string, unknown>, key: string): string | undefined => {
  const v = obj[key]
  return typeof v === 'string' ? v : v !== null && v !== undefined ? String(v) : undefined
}

export default function MemberIndexPage() {
  const tt = useTt()
  const gate = useAuthReadyGate()

  const defaultBenefits = useMemo<BenefitItem[]>(
    () => [
      {
        id: 'unlimited',
        title: tt('member.benefit.unlimited', '无限对话'),
        desc: tt('member.benefit.unlimitedDesc', '无限制使用 AI 对话功能'),
        active: true,
      },
      {
        id: 'advanced',
        title: tt('member.benefit.advanced', '高级模型'),
        desc: tt('member.benefit.advancedDesc', '使用最新的 AI 大模型'),
        active: true,
      },
      {
        id: 'priority',
        title: tt('member.benefit.priority', '优先响应'),
        desc: tt('member.benefit.priorityDesc', '对话请求优先处理'),
        active: true,
      },
      {
        id: 'community',
        title: tt('member.benefit.community', 'VIP 社区'),
        desc: tt('member.benefit.communityDesc', '加入专属 VIP 交流群'),
        active: true,
      },
    ],
    [tt],
  )

  const levelTiers = useMemo<LevelTier[]>(
    () => [
      {
        key: 'normal',
        name: tt('member.level.normal', '普通会员'),
        threshold: tt('member.level.normalThreshold', '注册即享'),
        perks: tt('member.level.normalPerks', '基础对话 / 有限次数'),
      },
      {
        key: 'silver',
        name: tt('member.level.silver', '银卡会员'),
        threshold: tt('member.level.silverThreshold', '成长值 ≥ 500'),
        perks: tt('member.level.silverPerks', '专属折扣 / 课程试听'),
      },
      {
        key: 'gold',
        name: tt('member.level.gold', '金卡会员'),
        threshold: tt('member.level.goldThreshold', '成长值 ≥ 2000'),
        perks: tt('member.level.goldPerks', '免费课程 / 专属客服'),
      },
      {
        key: 'diamond',
        name: tt('member.level.diamond', '钻石会员'),
        threshold: tt('member.level.diamondThreshold', '成长值 ≥ 8000'),
        perks: tt('member.level.diamondPerks', '全部权益 / 私董会'),
      },
    ],
    [tt],
  )

  const [info, setInfo] = useState<MemberInfo>({} as MemberInfo)
  const [profile, setProfile] = useState<{
    nickname?: string
    avatar?: string
    isVip?: boolean
    vipExpireTime?: string
    isPermanentVip?: boolean
  }>({})
  const [benefits, setBenefits] = useState<BenefitItem[]>(defaultBenefits)
  const [loading, setLoading] = useState(false)
  // 加载失败态:与共享屏 VipScreen 一致(ErrorState 承接,不靠一次性 toast 就假装加载完了)
  const [error, setError] = useState('')
  // 会员等级(VIP 套餐)—— GET /vip/levels 公开端点,与 pkg-shop/vip 购买页同源
  const [vipLevels, setVipLevels] = useState<VipLevel[]>([])
  const [vipLevelsError, setVipLevelsError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [memberInfo, userProfile, benefitsRes, levelsRes] = await Promise.all([
        getMemberInfo().catch(() => ({}) as MemberInfo),
        getProfile().catch(() => null),
        getMemberBenefits().catch(() => ({
          list: [] as Array<{ id: string; title: string; desc: string; icon?: string }>,
        })),
        getVipLevels().catch(() => null),
      ])
      setInfo(memberInfo)
      if (levelsRes) {
        setVipLevels(levelsRes.items || [])
        setVipLevelsError('')
      } else {
        setVipLevelsError(tt('member.index.loadFailed', '加载失败'))
      }
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
      const list = (benefitsRes.list || []).map((b): BenefitItem => ({
        id: b.id,
        title: b.title,
        desc: b.desc,
        active: true,
      }))
      if (list.length > 0) setBenefits(list)
    } catch (e) {
      logger.error('member/index', t('member.q1'), e)
      setError(tt('member.index.loadFailed', '加载失败'))
    } finally {
      setLoading(false)
    }
  }, [tt])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  // G-933 冷启动抢跑门控:load 的三发全是需鉴权端点 —— GET /api/levels/current 与
  // GET /api/points/transactions 同挂 gamificationRoutes 的统一 preHandler
  // (`apps/api/src/routes/gamification.ts:69` addHook authenticate),
  // GET /api/user/profile 走 `miniapp-compat-routes.ts:2247` 的 inline checkAuth。
  // 三支都在同一个 Promise.all 里且无一公开 ⇒ 整块挡到门后,游客可见内容(等级档位表)
  // 本就是页面内静态 TIERS/levelTiers,不依赖这三发,不存在首屏白屏。
  // (同批第 4 支 getVipLevels 打的是公开端点 GET /vip/levels,不参与这道门控。)
  useDidShow(() => {
    gate.waitUntilReady(load)
  })

  const isVip = Boolean(profile.isVip)
  const isPermanentVip = Boolean(profile.isPermanentVip)
  const remainDays = calcVipRemainDays(profile.vipExpireTime)
  // 会员卡元信息:与共享屏 VipScreen 的 membershipMeta 同语义(到期时间 + 剩余天数)
  const expireText = isPermanentVip
    ? tt('member.index.permanentVip', '永久有效')
    : profile.vipExpireTime
      ? remainDays > 0
        ? `${tt('vip.expireAt', '到期时间')}:${formatDateByTemplate(profile.vipExpireTime, 'YYYY-MM-DD')}`
        : tt('member.index.expired', '已过期')
      : ''
  const daysRemainingText =
    !isPermanentVip && profile.vipExpireTime && remainDays > 0
      ? tt('vip.daysRemaining', '剩余 {count} 天', { count: remainDays })
      : ''

  // VIP CTA 的价格一律取同页 <VipLevels> 已拉到的 GET /vip/levels 真档位(price 单位为分,公开端点):
  // 此处曾写死 ¥588 / ¥1288,而库里在册档位是 3990/29900/99000/32400 分(packages/database/drizzle/
  // 0037_vip_captcha.sql 种子)⇒ 写死价就是可见错误文案。取不到档位时整块不渲染,不拿 0 或常量冒充。
  const entryLevel = useMemo(() => pickEntryLevel(vipLevels), [vipLevels])
  const permanentLevel = useMemo(() => pickPermanentLevel(vipLevels), [vipLevels])

  // 根据成长值推算当前等级
  const growth = info.growth || 0
  const currentLevelKey =
    growth >= 8000 ? 'diamond' : growth >= 2000 ? 'gold' : growth >= 500 ? 'silver' : 'normal'

  // 进度条:当前成长值 → 下一等级阈值
  const tierOrder: ReadonlyArray<string> = ['normal', 'silver', 'gold', 'diamond']
  const currentIdx = tierOrder.indexOf(currentLevelKey)
  const isMaxLevel = currentIdx === tierOrder.length - 1
  const nextTier = !isMaxLevel ? levelTiers[currentIdx + 1] : null
  const currentThreshold = GROWTH_THRESHOLDS[currentLevelKey] ?? 0
  const nextThreshold = !isMaxLevel && nextTier ? (GROWTH_THRESHOLDS[nextTier.key] ?? 0) : growth
  const progressPercent = isMaxLevel
    ? 100
    : Math.min(
        100,
        Math.max(0, ((growth - currentThreshold) / (nextThreshold - currentThreshold)) * 100),
      )

  const goToPayment = () => {
    Taro.navigateTo({ url: '/pkg-shop/vip/index' })
  }

  const goToShare = () => {
    // distribution/index 非 tabBar 页,直接 navigateTo
    Taro.navigateTo({ url: '/pages/distribution/index' })
  }

  return (
    <ThemeRoot>
      <ScrollView scrollY className="member-page">
        {/* ===== Header:用户信息 + VIP 状态 ===== */}
        <View className="member-header">
          {/* 标题区:对齐共享屏 VipScreen header 的 title + subtitle(本页此前只有原生导航栏标题) */}
          <Text className="block text-[length:40rpx] font-semibold text-[var(--color-surface-light)]">
            {tt('vip.title', '会员中心')}
          </Text>
          <Text className="block text-[length:24rpx] text-[var(--color-white-70)] mt-[8rpx] mb-[24rpx]">
            {tt('vip.subtitle', '开通会员,尊享更多权益')}
          </Text>
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
                  <Text className="member-vip-expire">
                    {expireText}
                    {daysRemainingText ? ` · ${daysRemainingText}` : ''}
                  </Text>
                </View>
              ) : (
                <Text className="member-normal-user">
                  {tt('member.index.normalUser', '普通用户')}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* 加载失败:共享屏走 ErrorState + vip.retry,这里用同一语义的行内错误条(可重试) */}
        {error ? (
          <View className="mx-[20rpx] mb-[24rpx] p-[24rpx] bg-card border-[length:2rpx] border-border rounded-lg flex items-center justify-between">
            <Text className="flex-1 text-[length:26rpx] text-destructive">{error}</Text>
            <Text
              className="flex-shrink-0 ml-[16rpx] text-[length:26rpx] font-semibold text-[var(--color-primary)]"
              onClick={() => gate.waitUntilReady(load)}
            >
              {tt('vip.retry', '重试')}
            </Text>
          </View>
        ) : null}

        {/* ===== 会员等级梯度 ===== */}
        <View className="member-card">
          <Text className="member-card-title">{tt('vip.levelsTitle', '会员等级')}</Text>
          <View className="member-level-grid">
            {levelTiers.map((tier) => (
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
          <Text className="member-card-title">{tt('member.index.usageStats', '使用统计')}</Text>
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

          {/* 成长值进度条:当前等级 → 下一等级 */}
          <View className="member-progress">
            <View className="member-progress-header">
              <Text>{tt('member.index.currentLevel', '当前等级')}</Text>
              <Text className="member-progress-current">
                {isMaxLevel
                  ? tt('member.index.maxLevel', '已满级')
                  : `${growth} / ${nextThreshold}`}
              </Text>
            </View>
            <View className="member-progress-bar">
              <View className="member-progress-fill" style={{ width: `${progressPercent}%` }} />
            </View>
            <Text className="member-progress-hint">
              {isMaxLevel
                ? tt('member.index.maxLevelHint', '已达成最高等级')
                : tt(
                    'member.index.nextLevelHint',
                    t('member.y1', { p1: nextTier?.name ?? '', p2: nextThreshold - growth }),
                  )}
            </Text>
          </View>
        </View>

        {/* ===== 会员特权列表 ===== */}
        <View className="member-card">
          <Text className="member-card-title">
            {tt('member.index.privileges', '会员特权')} ·{' '}
            {tt('vip.benefitsCount', '{count} 项专属权益', { count: benefits.length })}
          </Text>
          <View className="member-benefits">
            {benefits.map((b) => (
              <View key={b.id} className="member-benefit-item">
                <View className="member-benefit-icon">
                  <LineIcon name="star" size={28} color="var(--color-warning)" />
                </View>
                <View className="member-benefit-content">
                  <Text className="member-benefit-title">{b.title}</Text>
                  <Text className="member-benefit-desc">{b.desc}</Text>
                </View>
                <Text className={`member-benefit-status ${isVip ? 'member-benefit-active' : ''}`}>
                  {isVip
                    ? tt('member.index.opened', '已开通')
                    : tt('member.index.notOpened', '未开通')}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ===== 会员等级(套餐)—— 对齐共享屏 levelsSection:等级 / 时长 / 权益数 / 价格 ===== */}
        <VipLevels
          levels={vipLevels}
          error={vipLevelsError}
          onRetry={() => gate.waitUntilReady(load)}
        />

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
              {entryLevel ? (
                <View className="member-vip-price">
                  <Text className="member-current-price">¥{formatPrice(entryLevel.price)}</Text>
                </View>
              ) : null}
            </View>
            <Button className="member-vip-button" onClick={goToPayment}>
              {tt('vip.purchase', '开通会员')}
            </Button>
          </View>
        ) : isPermanentVip ? (
          <View className="member-vip-section member-vip-permanent">
            <View className="member-permanent-badge">
              <LineIcon
                className="member-crown"
                name="gem"
                size={40}
                color="var(--color-vip-card)"
              />
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
              {permanentLevel ? (
                <View className="member-price-display">
                  <Text className="member-current-price">¥{formatPrice(permanentLevel.price)}</Text>
                </View>
              ) : null}
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
          <View
            className="member-menu-item"
            onClick={() => navigate('/pages/member/benefits')}
            hoverClass="opacity-60"
          >
            <Text>{tt('member.index.benefits', '会员权益')}</Text>
            <LineIcon name="chevron-right" size={24} color="var(--color-muted-foreground)" />
          </View>
          <View
            className="member-menu-item"
            onClick={() => navigate('/pages/member/integral')}
            hoverClass="opacity-60"
          >
            <Text>{tt('member.index.integralDetail', '积分明细')}</Text>
            <LineIcon name="chevron-right" size={24} color="var(--color-muted-foreground)" />
          </View>
          <View
            className="member-menu-item"
            onClick={() => navigate('/pages/member/coupon')}
            hoverClass="opacity-60"
          >
            <Text>{tt('member.index.myCoupons', '我的优惠券')}</Text>
            <LineIcon name="chevron-right" size={24} color="var(--color-muted-foreground)" />
          </View>
          <View
            className="member-menu-item"
            onClick={() => navigate('/pages/member/coupon-list')}
            hoverClass="opacity-60"
          >
            <Text>{tt('member.index.couponCenter', '领券中心')}</Text>
            <LineIcon name="chevron-right" size={24} color="var(--color-muted-foreground)" />
          </View>
          <View
            className="member-menu-item"
            onClick={() => navigate('/pkg-shop/vip/index')}
            hoverClass="opacity-60"
          >
            <Text>{tt('member.index.vip', 'VIP 会员')}</Text>
            <LineIcon name="chevron-right" size={24} color="var(--color-muted-foreground)" />
          </View>
          <View className="member-menu-item" onClick={goToShare} hoverClass="opacity-60">
            <Text>{tt('member.index.share', '分享赚佣金')}</Text>
            <LineIcon name="chevron-right" size={24} color="var(--color-muted-foreground)" />
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
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
