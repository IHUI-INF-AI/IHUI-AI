// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { MessageCircle, User, UserCheck, UserPlus } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState } from '../../components/ScreenStates'

/**
 * 他人主页共享屏 —— 渲染真相源(web 基准 = apps/web/app/(main)/user/[id]/PageClient.tsx)。
 *
 * 结构(逐元素,基准 = web 版):页头(BackChevron + userPublic.title)→ ScrollView:
 *   四态分支 = loading(ActivityIndicator)/ failed(ErrorState + common.retry,平台注入)
 *   / 用户不存在(EmptyState userPublic.notFound)/ 数据态:
 *   头像行(80 方形圆角 2xl,Image 或首字兜底)+ 昵称(heading 档)+ bio(body 档,可空)
 *   + 加入时间(label 档,formatDate 由平台注入)+ 三统计卡(following/followers/favorites,
 *   rounded-lg border bg-card 契约同 web)→ 操作行(关注/已关注 CTA + 发消息;isSelf 不渲染)。
 *
 * 平台侧只注入取数与副作用:本屏不触网、不导航 ——
 * GET /api/users/:id、GET /api/follows/:id/status、POST/DELETE /api/follows/:id、
 * POST /api/messages/conversations 全留在各端薄壳(与 UserFansScreen 同模式)。
 */
export interface UserPublicView {
  id: string
  nickname: string
  avatar?: string | null
  bio?: string | null
  createdAt?: string | null
}

export interface UserPublicStats {
  followingCount: number
  followersCount: number
  favoritesCount: number
}

export interface UserPublicScreenProps {
  t: (key: string) => string
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading: boolean
  error: string | null
  /** null 且 !loading && !error = 用户不存在(EmptyState) */
  user: UserPublicView | null
  stats: UserPublicStats | null
  /** null = 关注态未知(隐藏按钮态差异,仅禁用) */
  following: boolean | null
  followPending: boolean
  isSelf: boolean
  onRetry: () => void
  onToggleFollow: () => void
  onMessage: () => void
  formatDate?: (iso: string | null) => string
}

export function UserPublicScreen({
  t,
  colorScheme = 'light',
  onBack,
  loading,
  error,
  user,
  stats,
  following,
  followPending,
  isSelf,
  onRetry,
  onToggleFollow,
  onMessage,
  formatDate,
}: UserPublicScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const initials = (user?.nickname ?? '').trim().slice(0, 1).toUpperCase()

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('userPublic.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tk.brand.cta} />
          </View>
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={onRetry}
            retryLabel={t('common.retry')}
            colorScheme={colorScheme}
          />
        ) : !user ? (
          <EmptyState
            icon={<User size={26} color={tk.text.tertiary} />}
            title={t('userPublic.notFound')}
            colorScheme={colorScheme}
          />
        ) : (
          <View style={styles.card}>
            <View style={styles.profileRow}>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>{initials}</Text>
                </View>
              )}
              <View style={styles.profileMeta}>
                <Text style={styles.nickname}>{user.nickname}</Text>
                {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
                {user.createdAt ? (
                  <Text style={styles.joined}>
                    {t('userPublic.joined')}{' '}
                    {(formatDate ?? ((iso: string | null) => iso ?? ''))(user.createdAt)}
                  </Text>
                ) : null}
              </View>
            </View>

            {stats ? (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.followingCount}</Text>
                  <Text style={styles.statLabel}>{t('userPublic.followingCount')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.followersCount}</Text>
                  <Text style={styles.statLabel}>{t('userPublic.followersCount')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.favoritesCount}</Text>
                  <Text style={styles.statLabel}>{t('userPublic.favoritesCount')}</Text>
                </View>
              </View>
            ) : null}

            {!isSelf ? (
              <View style={styles.actions}>
                <Pressable
                  onPress={onToggleFollow}
                  disabled={followPending || following === null}
                  style={({ pressed }) => [
                    following ? styles.followBtnOn : styles.followBtn,
                    (followPending || following === null) && styles.btnDisabled,
                    pressed && styles.btnPressed,
                  ]}
                  accessibilityRole="button"
                >
                  {followPending ? (
                    <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
                  ) : following ? (
                    <UserCheck size={16} color={tk.text.secondary} />
                  ) : (
                    <UserPlus size={16} color={tk.brand.ctaForeground} />
                  )}
                  <Text style={following ? styles.followBtnTextOn : styles.followBtnText}>
                    {following ? t('userPublic.following') : t('userPublic.follow')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onMessage}
                  style={({ pressed }) => [styles.messageBtn, pressed && styles.btnPressed]}
                  accessibilityRole="button"
                >
                  <MessageCircle size={16} color={tk.text.primary} />
                  <Text style={styles.messageBtnText}>{t('userPublic.message')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { ...rnType.heading, color: tk.text.primary },
    body: { padding: rnSpacing.lg },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: rnSpacing['3xl'] },
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      padding: rnSpacing.lg,
      gap: rnSpacing.md,
    },
    profileRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rnSpacing.lg,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: rnRadius['2xl'],
      backgroundColor: tk.surface.muted,
    },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarFallbackText: { ...rnType.display, color: tk.text.tertiary },
    profileMeta: { flex: 1, minWidth: 0, gap: rnSpacing.xs },
    nickname: { ...rnType.heading, color: tk.text.primary },
    bio: { ...rnType.body, color: tk.text.secondary },
    joined: { fontSize: rnType.label.size, color: tk.text.tertiary },
    statsRow: { flexDirection: 'row', gap: rnSpacing.md },
    statCard: {
      flex: 1,
      alignItems: 'center',
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.xs,
    },
    statValue: { ...rnType.title, color: tk.text.primary },
    statLabel: { fontSize: rnType.label.size, color: tk.text.tertiary },
    actions: {
      flexDirection: 'row',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xs,
    },
    followBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    followBtnOn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      height: 44,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    followBtnText: { ...rnType.body, color: tk.brand.ctaForeground, fontWeight: '600' },
    followBtnTextOn: { ...rnType.body, color: tk.text.secondary, fontWeight: '600' },
    messageBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      height: 44,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    messageBtnText: { ...rnType.body, color: tk.text.primary, fontWeight: '600' },
    btnDisabled: { opacity: 0.6 },
    btnPressed: { opacity: 0.8 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
