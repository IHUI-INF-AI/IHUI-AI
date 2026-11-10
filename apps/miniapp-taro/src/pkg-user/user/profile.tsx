// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/profile/ProfileScreen.tsx(直载共享屏 + 注入本端事实)
//
// 端内保留的业务:GET /user/profile 取用户体;统计/订单数/实名态三枚附加读数各自独立取,
// 取不到留 null(共享屏渲染 '--',不把「没取到」说成 0 / 未认证);头像选图→上传→落库
// (先 uploadImage 拿服务端 URL 再 PUT /user/avatar,不把本机临时路径写库);登出把 refreshToken
// 交给 POST /auth/logout 的吊销腿再 clearAuth;身份徽章 roleId 取本机登录快照(纯展示)。
// 渲染(用户卡/身份标签/统计六格/菜单分节/退出按钮)全部委托共享屏,本页无自有渲染段。

import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { fetchApi } from '@ihui/api-client'
import { getProfile, type UserInfo } from '@/api'
import { getUserInfo } from '@/utils/auth'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useTt, useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { onToast } from '@/host/on-toast'
import { ProfileScreen } from '@ihui/rn-app/features/profile/ProfileScreen'
import { useAvatarUpload } from './profile-avatar'
import { useProfileLogout } from './profile-logout'
import type { ProfileStats } from './profile-stats'
import './profile.css'

export default function Profile() {
  const { t } = useI18n()
  const tt = useTt()
  const gate = useAuthReadyGate()
  const { resolvedTheme } = useTheme()
  const [form, setForm] = useState<Partial<UserInfo>>({})
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [orderCount, setOrderCount] = useState<number | null>(null)
  const [realnameVerified, setRealnameVerified] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    try {
      setForm(await getProfile())
    } catch (e) {
      logger.error('user/profile', '获取用户信息', e)
      onToast(t('common.failed'), { kind: 'error' })
    }
    // 三枚读数各自独立:取不到留 null(渲染 '--' / 不出值),不把「没取到」说成「就是 0 / 没认证」。
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

  // 平台动作下沉到同目录 hook:本页只做数据装配与注入,不含任何渲染段。
  const { chooseAvatar } = useAvatarUpload((url) => {
    setForm((prev) => ({ ...prev, avatar: url }))
  })
  const handleLogout = useProfileLogout()

  useDidShow(() => {
    // G-933 冷启动门控:GET /user/profile(checkAuth)需鉴权,落定前不发
    gate.waitUntilReady(() => {
      void load()
    })
  })

  // 身份徽章的 roleId 取本机登录时落盘的用户体:GET /user/profile 不回 roleId。
  // 它是登录时刻快照,不随会话中途改角色刷新 —— 纯展示,不参与任何鉴权判定。
  const roleId = getUserInfo()?.roleId ?? 0
  const identityTags = [
    ...(form.isVip ? [{ text: t('user.vipMember'), tone: 'vip' as const }] : []),
    ...(roleId >= 1 ? [{ text: t('user.admin'), tone: 'admin' as const }] : []),
    ...(!form.isVip && roleId < 1 ? [{ text: t('user.normalUser'), tone: 'normal' as const }] : []),
  ]
  const realnameValue =
    realnameVerified === null
      ? ''
      : realnameVerified
        ? t('user.profile.verified')
        : t('user.profile.unverified')
  const menuSections = [
    {
      title: tt('user.profile.accountInfo', '账号信息'),
      items: [
        {
          key: '/pkg-user/user/nickname',
          label: t('user.profile.nickname'),
          value: form.nickname || t('profile.nickname'),
        },
        {
          key: '/pkg-user/user/phone',
          label: t('user.profile.phone'),
          value: form.phone || t('user.profile.unbound'),
        },
        {
          key: '/pkg-user/user/email',
          label: t('user.profile.email'),
          value: form.email || t('user.profile.unbound'),
        },
      ],
    },
    {
      title: tt('user.profile.security', '安全设置'),
      items: [
        { key: '/pkg-user/user/password', label: t('user.profile.password') },
        { key: '/pkg-user/user/realname', label: t('user.profile.realname'), value: realnameValue },
        { key: '/pkg-user/checkin-assistant/index', label: t('checkinAssistant.title') },
        { key: '/pkg-user/account-pool/index', label: t('accountPool.title') },
      ],
    },
    {
      title: tt('user.profile.other', '其他'),
      items: [{ key: '/pkg-user/user/feedback', label: t('user.profile.feedback') }],
    },
  ]

  return (
    <ThemeRoot>
      <ProfileScreen
        t={t}
        colorScheme={resolvedTheme}
        user={{
          id: Number(form.id ?? getUserInfo()?.id ?? 0),
          nickname: form.nickname ?? '',
          avatar: form.avatar ?? null,
          email: form.email,
          phone: form.phone,
        }}
        stats={stats}
        orderCount={orderCount}
        loading={false}
        realnameStatus={
          realnameVerified === null ? undefined : realnameVerified ? 'verified' : 'unverified'
        }
        identityTags={identityTags}
        menuSections={menuSections}
        onNavigate={navigate}
        onAvatarPress={chooseAvatar}
        onLogout={handleLogout}
        onToast={onToast}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
