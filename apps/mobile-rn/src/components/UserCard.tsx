/**
 * UserCard 4 宫格卡片入口(对齐 Uniapp user_cards.vue)
 * 2×2 网格:我的订单 / 我的公司 / 我的智汇值 / 我的钱包
 * 点击跳转对应路由,未登录时 Alert 提示。
 */
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Building2, Gem, Receipt, Wallet } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'

export type UserCardKey = 'order' | 'company' | 'token' | 'wallet'

interface UserCardConfig {
  key: UserCardKey
  labelKey: string
  subtitleKey: string
  Icon: typeof Receipt
}

const CARDS: readonly UserCardConfig[] = [
  { key: 'order', labelKey: 'profile.userCard.order', subtitleKey: 'profile.userCard.orderSubtitle', Icon: Receipt },
  { key: 'company', labelKey: 'profile.userCard.company', subtitleKey: 'profile.userCard.companySubtitle', Icon: Building2 },
  { key: 'token', labelKey: 'profile.userCard.token', subtitleKey: 'profile.userCard.tokenSubtitle', Icon: Gem },
  { key: 'wallet', labelKey: 'profile.userCard.wallet', subtitleKey: 'profile.userCard.walletSubtitle', Icon: Wallet },
]

export interface UserCardProps {
  /** i18n 翻译函数 */
  t: (key: string) => string
  /** 是否已登录(未登录时点击弹提示) */
  isLoggedIn: boolean
  /** 卡片点击回调,返回 key */
  onPress: (key: UserCardKey) => void
}

export function UserCard({ t, isLoggedIn, onPress }: UserCardProps) {
  const handlePress = (key: UserCardKey) => {
    if (!isLoggedIn) {
      Alert.alert(t('profile.userCard.loginRequired'))
      return
    }
    onPress(key)
  }

  return (
    <View style={styles.grid}>
      {CARDS.map(({ key, labelKey, subtitleKey, Icon }) => (
        <Pressable
          key={key}
          style={styles.card}
          onPress={() => handlePress(key)}
          android_ripple={{ color: tokens.border.light }}
        >
          <View style={styles.iconWrap}>
            <Icon size={24} color={tokens.indigo.DEFAULT} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.label} numberOfLines={1}>
              {t(labelKey)}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {t(subtitleKey)}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // 对齐 Uniapp 14rpx(≈7px)卡片间距
    gap: 7,
    marginBottom: 10,
  },
  card: {
    width: '48%',
    // 对齐 Uniapp 120rpx(≈60px)卡片高度
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    // 对齐 Uniapp padding: 0 10rpx 0 12rpx
    paddingVertical: 6,
    paddingHorizontal: 10,
    // 对齐 Uniapp 15rpx(≈7.5px→8px)卡片圆角
    borderRadius: 8,
    backgroundColor: tokens.surface.light,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 45,
    height: 45,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: tokens.text.secondary,
    marginTop: 2,
  },
})
