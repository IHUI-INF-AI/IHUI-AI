/**
 * UserMembershipBenefits 会员权益展示(mobile-rn 端)
 *
 * 对齐历史 Uniapp user-membership-benefits 组件:
 * - 顶部会员等级徽章(如 VIP/SVIP)+ 到期时间
 * - 权益清单:图标 + 权益名称 + 权益描述
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线(gap 间距)
 *
 * 平台特有:依赖 RN 组件,不适合共享。
 */
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { CircleCheck, Crown, Sparkles, type LucideIcon } from 'lucide-react-native'

export interface BenefitItem {
  id: string
  icon: LucideIcon
  title: string
  desc: string
}

export type MembershipLevel = 'normal' | 'vip' | 'svip'

export interface UserMembershipBenefitsProps {
  level: MembershipLevel
  expireAt?: string
  benefits: readonly BenefitItem[]
  onPressUpgrade?: () => void
}

const LEVEL_LABEL: Record<MembershipLevel, string> = {
  normal: '普通会员',
  vip: 'VIP 会员',
  svip: 'SVIP 会员',
}

const LEVEL_COLOR: Record<MembershipLevel, string> = {
  normal: tokens.text.secondary,
  vip: tokens.brand.DEFAULT,
  svip: tokens.purple.DEFAULT,
}

export function UserMembershipBenefits({
  level,
  expireAt,
  benefits,
  onPressUpgrade,
}: UserMembershipBenefitsProps) {
  const LevelIcon = level === 'svip' ? Sparkles : Crown
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.levelBadge}>
          <LevelIcon size={16} color={LEVEL_COLOR[level]} />
          <Text style={[styles.levelText, { color: LEVEL_COLOR[level] }]}>
            {LEVEL_LABEL[level]}
          </Text>
        </View>
        {expireAt ? <Text style={styles.expireText}>到期:{expireAt}</Text> : null}
      </View>
      <View style={styles.benefitList}>
        {benefits.map((b) => {
          const Icon = b.icon
          return (
            <View key={b.id} style={styles.benefitItem}>
              <View style={styles.benefitIconWrap}>
                <Icon size={18} color={tokens.brand.DEFAULT} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
              <CircleCheck size={16} color={tokens.success.DEFAULT} />
            </View>
          )
        })}
      </View>
      {level === 'normal' && onPressUpgrade ? (
        <Pressable
          style={({ pressed }) => [styles.upgradeBtn, pressed ? styles.pressed : null]}
          onPress={onPressUpgrade}
          accessibilityRole="button"
          accessibilityLabel="升级会员"
        >
          <Text style={styles.upgradeBtnText}>立即升级会员</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.surface.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  } as ViewStyle,
  levelText: {
    fontSize: 15,
    fontWeight: '600',
  } as TextStyle,
  expireText: {
    fontSize: 12,
    color: tokens.text.tertiary,
  } as TextStyle,
  benefitList: {
    gap: 10,
  } as ViewStyle,
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: tokens.surface.muted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as ViewStyle,
  benefitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  benefitContent: {
    flex: 1,
    gap: 2,
  } as ViewStyle,
  benefitTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.text.primary,
  } as TextStyle,
  benefitDesc: {
    fontSize: 12,
    color: tokens.text.secondary,
  } as TextStyle,
  upgradeBtn: {
    height: 44,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  } as ViewStyle,
  upgradeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  } as TextStyle,
  pressed: { opacity: 0.85 } as ViewStyle,
})

export default UserMembershipBenefits
