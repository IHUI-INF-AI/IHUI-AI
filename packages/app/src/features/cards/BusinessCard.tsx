import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

export interface BusinessCardProps {
  /** 头像 URL */
  avatar: string
  name: string
  /** 职位 */
  title: string
  company: string
  phone?: string
  email?: string
  /** 微信号 */
  wechat?: string
  /** 位置 */
  location?: string
  /** 个人简介 */
  bio?: string
  /** 二维码 URL(若有则显示二维码图标,点击放大) */
  qrCode?: string
  /** 多动作按钮 slot(替代单一 onContactPress,支持发送好友/保存相册/编辑名片等多个按钮) */
  actions?: ReactNode
  onPress?: () => void
  onContactPress?: () => void
  colorScheme?: 'light' | 'dark'
}

function initials(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'U'
}

/**
 * BusinessCard — 商务名片卡(跨端共享)。
 *
 * 纯展示组件:头像(圆角)+ 姓名 + 职位 + 公司 + 联系方式 + 联系按钮。
 * 数据由调用方传入,样式遵循 packages/app 现有模式(StyleSheet + getTokens)。
 */
export function BusinessCard({
  avatar,
  name,
  title,
  company,
  phone,
  email,
  wechat,
  location,
  bio,
  qrCode,
  actions,
  onPress,
  onContactPress,
  colorScheme = 'light',
}: BusinessCardProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const hasContact = Boolean(phone || email || wechat)

  const inner = (
    <Fragment>
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{initials(name)}</Text>
          )}
        </View>
        <View style={styles.userMeta}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.titleText}>{title}</Text>
          <Text style={styles.company}>{company}</Text>
          {location ? <Text style={styles.location}>{location}</Text> : null}
        </View>
        {qrCode ? (
          <View style={styles.qrWrap}>
            <Image
              source={{ uri: qrCode }}
              style={styles.qrImg}
              accessibilityLabel={`${name} 名片二维码`}
            />
          </View>
        ) : null}
      </View>

      {bio ? (
        <Text style={styles.bio} numberOfLines={2}>
          {bio}
        </Text>
      ) : null}

      {hasContact ? (
        <View style={styles.contactRow}>
          {phone ? (
            <View style={styles.contactItem}>
              <Text style={styles.contactLabel}>电话</Text>
              <Text style={styles.contactValue}>{phone}</Text>
            </View>
          ) : null}
          {email ? (
            <View style={styles.contactItem}>
              <Text style={styles.contactLabel}>邮箱</Text>
              <Text style={styles.contactValue}>{email}</Text>
            </View>
          ) : null}
          {wechat ? (
            <View style={styles.contactItem}>
              <Text style={styles.contactLabel}>微信</Text>
              <Text style={styles.contactValue}>{wechat}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {actions ? (
        <View style={styles.actionsRow}>{actions}</View>
      ) : onContactPress ? (
        <Pressable
          style={({ pressed }) => [styles.contactBtn, pressed && styles.pressed]}
          onPress={onContactPress}
        >
          <Text style={styles.contactBtnText}>联系</Text>
        </Pressable>
      ) : null}
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
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 48, height: 48, borderRadius: 8 },
    avatarText: { fontSize: 20, fontWeight: '700', color: tk.surface.light },
    userMeta: { flex: 1, gap: 2 },
    name: { fontSize: 16, fontWeight: '600', color: tk.text.primary },
    titleText: { fontSize: 12, color: tk.brand.DEFAULT },
    company: { fontSize: 12, color: tk.text.secondary },
    location: { fontSize: 11, color: tk.text.tertiary },
    qrWrap: {
      width: 48,
      height: 48,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: tk.surface.card,
    },
    qrImg: { width: 48, height: 48 },
    bio: { fontSize: 12, color: tk.text.secondary },
    contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
    contactItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    contactLabel: { fontSize: 12, color: tk.text.secondary },
    contactValue: { fontSize: 12, color: tk.text.primary },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    contactBtn: {
      alignSelf: 'flex-start',
      backgroundColor: tk.brand.DEFAULT,
      borderRadius: 6,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    contactBtnText: { fontSize: 13, fontWeight: '600', color: tk.surface.light },
  })
}
