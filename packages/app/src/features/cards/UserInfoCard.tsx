import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

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
          <Pressable
            style={({ pressed }) => [
              isFollowing ? styles.followBtnOutline : styles.followBtn,
              pressed && styles.pressed,
            ]}
            onPress={onFollowPress}
          >
            <Text style={isFollowing ? styles.followBtnOutlineText : styles.followBtnText}>
              {isFollowing ? '已关注' : '+ 关注'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Fragment>
  )

  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={onPress}
      >
        {inner}
      </Pressable>
    )
  }
  return <View style={styles.card}>{inner}</View>
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    card: { backgroundColor: tk.surface.muted, borderRadius: 8, padding: 16, gap: 12 },
    pressed: { opacity: 0.85 },
    userRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 48, height: 48, borderRadius: 24 },
    avatarText: { fontSize: 20, fontWeight: '700', color: tk.surface.light },
    userMeta: { flex: 1, gap: 2 },
    nickname: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    bio: { fontSize: 12, color: tk.text.secondary },
    contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    contactItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    contactLabel: { fontSize: 12, color: tk.text.secondary },
    contactValue: { fontSize: 12, color: tk.text.primary },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
    statCell: { gap: 2 },
    statValue: { fontSize: 16, fontWeight: '700', color: tk.text.primary },
    statLabel: { fontSize: 11, color: tk.text.secondary },
    statSpacer: { flex: 1 },
    followBtn: {
      backgroundColor: tk.brand.DEFAULT,
      borderRadius: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    followBtnOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: tk.border.medium,
      borderRadius: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    followBtnText: { fontSize: 12, fontWeight: '600', color: tk.surface.light },
    followBtnOutlineText: { fontSize: 12, fontWeight: '600', color: tk.text.primary },
    footer: { marginTop: 4 },
  })
}
