/**
 * PersonalInformationCard 个人信息卡片 (mobile-rn 端)
 *
 * 对齐历史 Uniapp 分销页个人信息卡片:
 * - 展示分销者头像、昵称、邀请码、佣金比例
 * - 浅色优雅风,圆角矩形(非圆形),无霓虹无渐变
 * - 无分割线,用背景色对比 + gap 间距分隔
 */
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { Image, StyleSheet, Text, View, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native'
import { DEFAULT_AVATAR_URL } from '@ihui/shared/constants'

export interface PersonalInformationCardProps {
  avatar?: string
  nickname?: string
  inviteCode?: string
  commissionRate?: number | string
  level?: string
}

const AVATAR_SIZE = 48
const AVATAR_RADIUS = 8
const CARD_RADIUS = 12
const CARD_PADDING = 14

export function PersonalInformationCard({
  avatar,
  nickname,
  inviteCode,
  commissionRate,
  level,
}: PersonalInformationCardProps) {
  const avatarUrl = avatar || DEFAULT_AVATAR_URL

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Image
          source={{ uri: avatarUrl }}
          style={styles.avatar}
          resizeMode="cover"
        />
        <View style={styles.infoWrap}>
          <Text style={styles.nickname} numberOfLines={1}>
            {nickname || '分销者'}
          </Text>
          {level ? (
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>{level}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.detailRow}>
        {inviteCode ? (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>邀请码</Text>
            <Text style={styles.detailValue}>{inviteCode}</Text>
          </View>
        ) : null}
        {commissionRate !== undefined ? (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>佣金比例</Text>
            <Text style={styles.detailValue}>
              {typeof commissionRate === 'number'
                ? `${(commissionRate * 100).toFixed(1)}%`
                : commissionRate}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    backgroundColor: tokens.surface.card,
    gap: 12,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  } as ViewStyle,
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_RADIUS,
    backgroundColor: tokens.surface.muted,
  } as ImageStyle,
  infoWrap: {
    flex: 1,
    gap: 4,
  } as ViewStyle,
  nickname: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  levelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: tokens.warning.light,
  } as ViewStyle,
  levelText: {
    fontSize: 11,
    fontWeight: '500',
    color: tokens.warning.DEFAULT,
  } as TextStyle,
  detailRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: tokens.surface.muted,
    borderRadius: 8,
  } as ViewStyle,
  detailItem: {
    flex: 1,
    gap: 2,
  } as ViewStyle,
  detailLabel: {
    fontSize: 12,
    color: tokens.text.tertiary,
  } as TextStyle,
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
})

export default PersonalInformationCard
