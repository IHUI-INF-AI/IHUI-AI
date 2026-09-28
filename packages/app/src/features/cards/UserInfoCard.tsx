// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

import { rnRadius } from '@ihui/design-tokens'

export interface UserInfoCardProps {
  /** 头像 URL */
  avatar: string
  nickname: string
  bio?: string
  followingCount: number
  fansCount: number
  isFollowing?: boolean
  /** 邮箱(自用资料页语义) */
  email?: string
  /** 手机号 */
  phone?: string
  /** 底部 slot(用于自定义额外内容) */
  footer?: ReactNode
  onPress?: () => void
  onFollowPress?: () => void
  colorScheme?: 'light' | 'dark'
}

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'U'
}

/**
 * UserInfoCard — 用户信息卡(跨端共享)。
 *
 * 纯展示组件:头像(圆形,§4 圆角豁免)+ 昵称 + 简介 + 关注/粉丝数 + 关注按钮。
 * 数据由调用方传入,样式遵循 packages/app 现有模式(StyleSheet + getTokens)。
 */
export function UserInfoCard({
  avatar,
  nickname,
  bio,
  followingCount,
  fansCount,
  isFollowing = false,
  email,
  phone,
  footer,
  onPress,
  onFollowPress,
  colorScheme = 'light',
}: UserInfoCardProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const hasContact = Boolean(email || phone)

  const inner = (
    <Fragment>
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{initials(nickname)}</Text>
          )}
        </View>
        <View style={styles.userMeta}>
          <Text style={styles.nickname}>{nickname}</Text>
          {bio ? (
            <Text style={styles.bio} numberOfLines={2}>
              {bio}
            </Text>
          ) : null}
        </View>
      </View>

      {hasContact ? (
        <View style={styles.contactRow}>
          {phone ? (
            <View style={styles.contactItem}>
              <Text style={styles.contactLabel}>手机</Text>
              <Text style={styles.contactValue}>{phone}</Text>
            </View>
          ) : null}
          {email ? (
            <View style={styles.contactItem}>
              <Text style={styles.contactLabel}>邮箱</Text>
              <Text style={styles.contactValue}>{email}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{followingCount}</Text>
          <Text style={styles.statLabel}>关注</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>{fansCount}</Text>
          <Text style={styles.statLabel}>粉丝</Text>
        </View>
        <View style={styles.statSpacer} />
        {onFollowPress ? (
          // 按压态样式**不得写在 Pressable 的 style 上**(守门 131 那一型):Pressable 注册过
          // cssInterop,函数形态声明被 `{ ...declaration }` 清成 `{}`,整份内联样式静默消失。
          // 外层在 statsRow(row + alignItems center)里只 hug 内容,盒子尺寸由内层决定 ⇒ 同尺寸。
          <Pressable onPress={onFollowPress}>
            {({ pressed }) => (
              <View
                style={[
                  isFollowing ? styles.followBtnOutline : styles.followBtn,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={isFollowing ? styles.followBtnOutlineText : styles.followBtnText}>
                  {isFollowing ? '已关注' : '+ 关注'}
                </Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Fragment>
  )

  if (onPress) {
    return (
      // 同上:卡面档(底色/描边/圆角/padding/gap)落到内层 View 的数组形态。
      // gap 仍作用在同一批子元素上(内层 View 就是这些子元素的父),外层是 Pressable 时
      // 与下面那条纯 View 分支渲染出逐字节相同的盒子 —— 两条分支本来就同用 styles.card。
      <Pressable onPress={onPress}>
        {({ pressed }) => (
          <View style={[styles.card, pressed ? styles.pressed : null]}>{inner}</View>
        )}
      </Pressable>
    )
  }
  return <View style={styles.card}>{inner}</View>
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: tk.surface.light,
      // 角色档 card → lg(8)。用户定档"卡片类一律 lg,不得在任一端单独取 xl/2xl"。
      // 同名元素在 apps/mobile-rn 那一份里本就是 lg(8)、小程序端根容器是 rounded-lg(8),
      // 这一份写 2xl(16) 会让同一个 UserInfoCard 在两个屏上长成两张脸。
      borderRadius: rnRadius.lg,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    pressed: { opacity: 0.85 },
    userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24, // radius-exempt: 48dp 圆形头像,取边长一半
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 48, height: 48, borderRadius: 24 }, // radius-exempt: 48dp 圆形头像图,取边长一半
    avatarText: { fontSize: 20, fontWeight: '700', color: tk.surface.light },
    userMeta: { flex: 1, gap: 4 },
    nickname: { fontSize: 18, fontWeight: '600', color: tk.text.primary },
    bio: { fontSize: 14, color: tk.text.secondary },
    contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    contactItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    contactLabel: { fontSize: 14, color: tk.text.secondary },
    contactValue: { fontSize: 14, color: tk.text.primary },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
    statCell: { gap: 4 },
    statValue: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    statLabel: { fontSize: 11, color: tk.text.secondary },
    statSpacer: { flex: 1 },
    followBtn: {
      backgroundColor: tk.brand.cta,
      // 角色档 control(按钮)→ sm(4),与 apps/mobile-rn 那一份的登录/充值钮同档
      borderRadius: rnRadius.sm,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    followBtnOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: tk.border.medium,
      // 角色档 control(按钮)→ sm(4),与实底态 followBtn 同档(两态必须同形)
      borderRadius: rnRadius.sm,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    followBtnText: { fontSize: 14, fontWeight: '600', color: tk.surface.light },
    followBtnOutlineText: { fontSize: 14, fontWeight: '600', color: tk.text.primary },
    footer: { marginTop: 8 },
  })
}
