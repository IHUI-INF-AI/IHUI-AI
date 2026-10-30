// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/profile/ProfileScreen.tsx
import { useTt, useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, type UserInfo } from '@/api'
import { getUserInfo } from '@/utils/auth'
import { fetchApi } from '@ihui/api-client'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import ProfileStatsGrid, { type ProfileStats } from './profile-stats'
import ProfileAvatar from './profile-avatar'
import ProfileLogoutButton from './profile-logout'
import './profile.css'
import LineIcon from '@/components/LineIcon'

export default function Profile() {
  const { t } = useI18n()
  const tt = useTt()
  const gate = useAuthReadyGate()
  const [form, setForm] = useState<Partial<UserInfo>>({})
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [orderCount, setOrderCount] = useState<number | null>(null)
  const [realnameVerified, setRealnameVerified] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    try {
      setForm(await getProfile())
    } catch (e) {
      logger.error('user/profile', '获取用户信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
    // 附加读数三枚各自独立:取不到留 null(渲染 '--' / 不出值),不把「没取到」说成「就是 0 / 没认证」。
    // /user/profile 不回统计也不回 realName ⇒ 计数走 /api/statistics/user-center + /api/orders/me,
    // 实名态走在册端点 /api/auth/realname/my(auth-identity.ts 回 authStatus)。
    try {
      const [statsRes, orderRes, realnameRes] = await Promise.all([
        fetchApi<ProfileStats>('/api/statistics/user-center'),
        fetchApi<{ total: number }>('/api/orders/me', { params: { page: 1, pageSize: 1 } }),
        fetchApi<{ authStatus?: string | null }>('/api/auth/realname/my'),
      ])
      if (statsRes.success) setStats(statsRes.data)
      if (orderRes.success) setOrderCount(Number(orderRes.data?.total ?? 0))
      if (realnameRes.success) setRealnameVerified(realnameRes.data?.authStatus === 'approved')
    } catch (e) {
      logger.error('user/profile', '获取个人中心统计', e)
    }
  }, [t])

  function navigate(url: string) {
    Taro.navigateTo({ url })
  }

  useDidShow(() => {
    // G-933 冷启动门控:GET /user/profile(checkAuth)需鉴权,落定前不发
    gate.waitUntilReady(() => {
      void load()
    })
  })

  const accountRows = [
    {
      label: t('user.profile.nickname'),
      path: '/pkg-user/user/nickname',
      value: form.nickname || t('profile.nickname'),
    },
    {
      label: t('user.profile.phone'),
      path: '/pkg-user/user/phone',
      value: form.phone || t('user.profile.unbound'),
    },
    {
      label: t('user.profile.email'),
      path: '/pkg-user/user/email',
      value: form.email || t('user.profile.unbound'),
    },
  ]

  // GET /user/profile 的 SELECT 里没有 realName ⇒ 旧判定 form.realName 恒假(永远显示「未认证」);
  // 改走在册端点 /api/auth/realname/my 的 authStatus。未判定(请求失败)时不出值,不猜成「未认证」。
  const realnameValue =
    realnameVerified === null
      ? ''
      : realnameVerified
        ? t('user.profile.verified')
        : t('user.profile.unverified')

  const securityRows = [
    {
      label: t('user.profile.password'),
      path: '/pkg-user/user/password',
      value: '',
    },
    {
      label: t('user.profile.realname'),
      path: '/pkg-user/user/realname',
      value: realnameValue,
    },
    {
      label: t('checkinAssistant.title'),
      path: '/pkg-user/checkin-assistant/index',
      value: '',
    },
    {
      label: t('accountPool.title'),
      path: '/pkg-user/account-pool/index',
      value: '',
    },
  ]

  // 身份徽章的 roleId 取本机登录时落盘的用户体:GET /user/profile 不回 roleId,而登录响应
  // (api-client AuthUser.roleId ← 后端 auth.ts 的 buildTokenPair/序列化)带它。
  // 它是登录时刻的快照,不随会话中途改角色刷新 —— 纯展示,不参与任何鉴权判定。
  const roleId = getUserInfo()?.roleId ?? 0

  return (
    <ThemeRoot>
      <View className="pf-page">
        {/* 身份标签行(对齐原项目 identity-tag) */}
        <View className="pf-identity-row">
          <Text className="pf-identity-label">{t('user.identity')}</Text>
          <View className="pf-identity-tags">
            {form.isVip ? <Text className="pf-tag pf-tag-vip">{t('user.vipMember')}</Text> : null}
            {roleId >= 1 ? <Text className="pf-tag pf-tag-admin">{t('user.admin')}</Text> : null}
            {!form.isVip && roleId < 1 ? (
              <Text className="pf-tag pf-tag-normal">{t('user.normalUser')}</Text>
            ) : null}
          </View>
        </View>

        {/* 个人中心统计六格(对齐共享屏 statsGrid:课程/收藏/关注/粉丝/订单/智汇值) */}
        <ProfileStatsGrid stats={stats} orderCount={orderCount} />

        {/* 头像 section:选图 → 上传 → PUT 服务端 URL(见 ./profile-avatar 的取证注) */}
        <ProfileAvatar
          avatar={form.avatar}
          onAvatarSaved={(url) => setForm((prev) => ({ ...prev, avatar: url }))}
        />

        {/* 账号信息 section */}
        <View className="pf-section">
          <Text className="pf-section-title">{tt('user.profile.accountInfo', '账号信息')}</Text>
          <View className="pf-section-card">
            {accountRows.map((row) => (
              <View
                key={row.path}
                className="pf-item"
                hoverClass="opacity-60"
                onClick={() => navigate(row.path)}
              >
                <Text className="pf-item-label">{row.label}</Text>
                <View className="pf-item-right">
                  <Text className="pf-item-value">{row.value}</Text>
                  <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 安全设置 section */}
        <View className="pf-section">
          <Text className="pf-section-title">{tt('user.profile.security', '安全设置')}</Text>
          <View className="pf-section-card">
            {securityRows.map((row) => (
              <View
                key={row.path}
                className="pf-item"
                hoverClass="opacity-60"
                onClick={() => navigate(row.path)}
              >
                <Text className="pf-item-label">{row.label}</Text>
                <View className="pf-item-right">
                  {row.value ? <Text className="pf-item-value">{row.value}</Text> : null}
                  <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 反馈 section */}
        <View className="pf-section">
          <Text className="pf-section-title">{tt('user.profile.other', '其他')}</Text>
          <View className="pf-section-card">
            <View
              className="pf-item"
              hoverClass="opacity-60"
              onClick={() => navigate('/pkg-user/user/feedback')}
            >
              <Text className="pf-item-label">{t('user.profile.feedback')}</Text>
              <View className="pf-item-right">
                <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
              </View>
            </View>
          </View>
        </View>

        {/* 退出登录(对齐共享屏 logoutBtn) */}
        <ProfileLogoutButton />
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
