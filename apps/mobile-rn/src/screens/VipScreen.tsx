import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  createOrder,
  getMembershipInfo,
  getVipLevels,
  type MembershipInfo,
  type VipLevel,
} from '@ihui/api-client'
import {
  VipScreen as SharedVipScreen,
  type VipLevelItem2,
  type VipMembershipInfo,
} from '@ihui/rn-app'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import { BottomPopup } from '../components/BottomPopup'
import { PurchaseNoticePopUp } from '../components/PurchaseNoticePopUp'
import { IntroducePopup } from '../components/IntroducePopup'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

function toVipLevel(l: VipLevel): VipLevelItem2 {
  return {
    id: l.id,
    levelName: l.levelName,
    levelValue: l.levelValue,
    price: l.price,
    durationDays: l.durationDays,
    status: l.status,
    benefits: l.benefits ?? undefined,
  }
}

function toVipMembership(m: MembershipInfo): VipMembershipInfo {
  return {
    isActive: m.isActive,
    level: m.level,
    levelName: m.levelName,
    expireTime: formatDateOnly(m.expireTime ?? ''),
    daysRemaining: m.daysRemaining,
  }
}

export function VipScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [levels, setLevels] = useState<VipLevelItem2[]>([])
  const [membership, setMembership] = useState<VipMembershipInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  // VIP 权益介绍弹窗(首次进入自动展示,关闭后本次会话不再弹出)
  const [introVisible, setIntroVisible] = useState(false)
  const [introShown, setIntroShown] = useState(false)
  // VIP 等级介绍弹窗(H18,复刻 Uniapp vip_info/index.vue 的 introduce-popup levelIndex 变体)
  const [levelIntroVisible, setLevelIntroVisible] = useState(false)
  // 3 个未触发变体(复刻 Uniapp vip_info/index.vue 行 59-71 触发入口)
  // index 变体 — 会员权益介绍(行 65 options.type == 'IntroducePopup')
  const [introIndexVisible, setIntroIndexVisible] = useState(false)
  // indexs 变体 — 操盘手权益(行 59 options.type == 'IntroducePopups' / 行 62 'IntroducePopups1')
  const [introIndexsVisible, setIntroIndexsVisible] = useState(false)
  // privateAdvisory 变体 — 私人顾问(行 69 options.type == 'PrivateAdvisory')
  const [privateAdvisoryVisible, setPrivateAdvisoryVisible] = useState(false)
  // BottomPopup 支付弹窗(行 6/127 BottomPopup 组件)
  const [bottomPopupVisible, setBottomPopupVisible] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const [levelsRes, membershipRes] = await Promise.all([getVipLevels(), getMembershipInfo()])
      if (levelsRes.success) setLevels(levelsRes.data.map(toVipLevel))
      else setError(levelsRes.error || t('vip.loadFailed'))
      if (membershipRes.success && membershipRes.data)
        setMembership(toVipMembership(membershipRes.data))
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
    // 首次进入自动展示 VIP 等级介绍弹窗(复刻 Uniapp vip_info/index.vue)
    const timer = setTimeout(() => setLevelIntroVisible(true), 500)
    return () => clearTimeout(timer)
  }, [load])

  const onPurchase = async (level: VipLevelItem2) => {
    setPurchasingId(level.id)
    setToast('')
    const res = await createOrder({ type: 'vip', targetId: level.id })
    setPurchasingId(null)
    if (res.success) {
      setToast(t('vip.orderCreated', { orderNo: res.data.orderNo }))
      // 订单创建成功后弹出购买须知,引导用户完成支付
      if (!introShown) {
        setIntroVisible(true)
        setIntroShown(true)
      }
    } else {
      setToast(res.error || t('vip.purchaseFailed'))
    }
  }

  // 从介绍弹窗(index/indexs/privateAdvisory)跳转到等级弹窗
  // 对齐 Uniapp vip_info/index.vue 行 112-120 handleOpenLevelPopup:
  // 隐藏当前介绍弹窗 → 显示会员等级介绍弹窗
  const openLevelFromIntro = useCallback(() => {
    setIntroIndexVisible(false)
    setIntroIndexsVisible(false)
    setPrivateAdvisoryVisible(false)
    setLevelIntroVisible(true)
  }, [])

  // 从等级弹窗跳转到支付弹窗
  // 对齐 Uniapp vip_info/index.vue 行 127-140 handleOpenPaymentPopup:
  // 关闭介绍/等级弹窗 → 显示 BottomPopup 支付弹窗
  const openPaymentFromLevel = useCallback(() => {
    setLevelIntroVisible(false)
    setBottomPopupVisible(true)
  }, [])

  // BottomPopup 确认 → 调 createOrder API(对齐 Uniapp pay 流程)
  const onBottomPopupConfirm = useCallback(
    async (levelId: string) => {
      setBottomPopupVisible(false)
      setToast('')
      const res = await createOrder({ type: 'vip', targetId: levelId })
      if (res.success) {
        setToast(t('vip.orderCreated', { orderNo: res.data.orderNo }))
      } else {
        setToast(res.error || t('vip.purchaseFailed'))
      }
    },
    [t],
  )

  return (
    <View style={styles.screen}>
      {/* 权益介绍入口(对齐 Uniapp vip_info/index.vue 行 59-71 触发入口) */}
      <View style={styles.entryCard}>
        <Text style={styles.entryTitle}>权益介绍</Text>
        <View style={styles.entryRow}>
          <Pressable
            style={({ pressed }) => [styles.entryButton, pressed ? styles.entryButtonPressed : null]}
            onPress={() => setIntroIndexVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="会员权益介绍"
          >
            <Text style={styles.entryButtonText}>会员权益</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.entryButton, pressed ? styles.entryButtonPressed : null]}
            onPress={() => setIntroIndexsVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="操盘手权益介绍"
          >
            <Text style={styles.entryButtonText}>操盘手权益</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.entryButton, pressed ? styles.entryButtonPressed : null]}
            onPress={() => setPrivateAdvisoryVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="私人顾问介绍"
          >
            <Text style={styles.entryButtonText}>私人顾问</Text>
          </Pressable>
        </View>
      </View>
      <SharedVipScreen
        t={t}
        levels={levels}
        membership={membership}
        loading={loading}
        refreshing={refreshing}
        error={error}
        toast={toast}
        purchasingId={purchasingId}
        onRefresh={() => load(true)}
        onPurchase={onPurchase}
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
      />
      <PurchaseNoticePopUp
        visible={introVisible}
        title="VIP 会员权益"
        subtitle="解锁全部高级内容与专属服务"
        icon="👑"
        bullets={['畅享全站 VIP 课程与直播', '专属客服优先响应', '每月赠送积分,可兑换礼品', '专享会员折扣与活动']}
        primaryLabel="立即查看"
        onClose={() => setIntroVisible(false)}
        onPrimary={() => setIntroVisible(false)}
      />
      {/* levelIndex 变体:会员等级介绍弹窗(行 72 options.type == 'levelPopup') */}
      <IntroducePopup
        visible={levelIntroVisible}
        onClose={() => setLevelIntroVisible(false)}
        variant="levelIndex"
        level={membership?.level ?? 0}
        onConfirm={openPaymentFromLevel}
      />
      {/* index 变体:会员权益介绍(行 65 options.type == 'IntroducePopup') */}
      <IntroducePopup
        visible={introIndexVisible}
        onClose={() => setIntroIndexVisible(false)}
        variant="index"
        onConfirm={openLevelFromIntro}
      />
      {/* indexs 变体:操盘手权益(行 59/62 options.type == 'IntroducePopups' / 'IntroducePopups1') */}
      <IntroducePopup
        visible={introIndexsVisible}
        onClose={() => setIntroIndexsVisible(false)}
        variant="indexs"
        onConfirm={openLevelFromIntro}
      />
      {/* privateAdvisory 变体:私人顾问(行 69 options.type == 'PrivateAdvisory') */}
      <IntroducePopup
        visible={privateAdvisoryVisible}
        onClose={() => setPrivateAdvisoryVisible(false)}
        variant="privateAdvisory"
        onConfirm={openLevelFromIntro}
      />
      {/* BottomPopup 支付弹窗(行 6/127 BottomPopup 组件) */}
      <BottomPopup
        visible={bottomPopupVisible}
        onClose={() => setBottomPopupVisible(false)}
        levels={levels}
        onConfirm={onBottomPopupConfirm}
      />
    </View>
  )
}

const ENTRY_CARD_RADIUS = 8
const ENTRY_BUTTON_PADDING_V = 10
const ENTRY_TITLE_FONT_SIZE = 13
const ENTRY_BUTTON_FONT_SIZE = 13

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  } as ViewStyle,
  entryCard: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
  } as ViewStyle,
  entryTitle: {
    fontSize: ENTRY_TITLE_FONT_SIZE,
    lineHeight: ENTRY_TITLE_FONT_SIZE + 4,
    color: tokens.text.secondary,
    marginBottom: 8,
  } as TextStyle,
  entryRow: {
    flexDirection: 'row',
    gap: 8,
  } as ViewStyle,
  entryButton: {
    flex: 1,
    paddingVertical: ENTRY_BUTTON_PADDING_V,
    borderRadius: ENTRY_CARD_RADIUS,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  entryButtonPressed: {
    opacity: 0.7,
  } as ViewStyle,
  entryButtonText: {
    fontSize: ENTRY_BUTTON_FONT_SIZE,
    lineHeight: ENTRY_BUTTON_FONT_SIZE + 2,
    color: tokens.text.primary,
    fontWeight: '500',
  } as TextStyle,
})
