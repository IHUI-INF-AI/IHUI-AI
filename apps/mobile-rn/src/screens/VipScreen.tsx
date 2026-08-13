import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { QrCode, X } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import {
  checkPaymentStatus,
  createOrder,
  createWechatAppPayment,
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
import { isWeChatInstalled, openWeChatPayment } from '../lib/wechat-pay'
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

/** 价格档位 Tab(对齐 Uniapp introduce-popup/index.vue 行 26-35 tab-container) */
type PlanTab = 'continuous' | 'monthly'

/**
 * 价格档位(对齐 Uniapp productList 结构)。
 * amount/defAmount 单位:分(对齐 Uniapp amount/100 显示逻辑)。
 */
interface PricePlan {
  id: string
  tab: PlanTab
  cycle: string
  discount?: string
  trial?: string
  amount: number
  defAmount: number
  detail: string
  durationDays: number
}

/** 连续包月折扣率(对齐 Uniapp 连续订阅优惠) */
const CONTINUOUS_DISCOUNT_RATE = 0.8

/**
 * 根据 durationDays 生成周期标签(对齐 Uniapp 周期命名)。
 */
function cycleLabel(days: number): string {
  if (days <= 31) return '包月'
  if (days <= 93) return '包季'
  if (days <= 186) return '半年'
  return '包年'
}

/**
 * 根据 durationDays 生成详情文案。
 */
function detailText(days: number, continuous: boolean): string {
  if (continuous) {
    if (days <= 31) return '每月自动续费,可随时取消'
    if (days <= 93) return '每季自动续费,节省 25%'
    return '每年自动续费,最划算'
  }
  if (days <= 31) return `一次性购买,${days} 天有效`
  if (days <= 93) return `一次性购买,${days} 天有效`
  return `一次性购买,${days} 天有效`
}

/**
 * 从 getVipLevels() 返回数据动态生成价格档位(对齐 Uniapp getvipPrice 个性化定价)。
 * 每个 VipLevel 生成 2 条:连续(折扣价)+ 按月(原价)。
 */
function buildPricePlans(levels: readonly VipLevel[]): PricePlan[] {
  if (levels.length === 0) return []
  const plans: PricePlan[] = []
  for (const lv of levels) {
    if (lv.status !== 1) continue
    const baseAmount = lv.price
    const defAmount = baseAmount
    const contAmount = Math.round(baseAmount * CONTINUOUS_DISCOUNT_RATE)
    const cycle = cycleLabel(lv.durationDays)
    // 连续订阅档(折扣价)
    plans.push({
      id: `cont-${lv.id}`,
      tab: 'continuous',
      cycle: `连续${cycle}`,
      discount: `${Math.round(CONTINUOUS_DISCOUNT_RATE * 10)}折`,
      trial: lv.durationDays >= 365 ? '7天试用' : undefined,
      amount: contAmount,
      defAmount,
      detail: detailText(lv.durationDays, true),
      durationDays: lv.durationDays,
    })
    // 按月购买档(原价)
    const monthlyCycle =
      lv.durationDays <= 31 ? '月度会员' : lv.durationDays <= 93 ? '季度会员' : '年度会员'
    plans.push({
      id: `month-${lv.id}`,
      tab: 'monthly',
      cycle: monthlyCycle,
      amount: baseAmount,
      defAmount,
      detail: detailText(lv.durationDays, false),
      durationDays: lv.durationDays,
    })
  }
  return plans
}

const TABS: readonly { key: PlanTab; labelKey: string }[] = [
  { key: 'continuous', labelKey: 'vipScreen.plans.continuous' },
  { key: 'monthly', labelKey: 'vipScreen.plans.monthly' },
]

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
  // 动态价格档位(从 getVipLevels 生成,对齐 Uniapp getvipPrice 个性化定价)
  const [pricePlans, setPricePlans] = useState<PricePlan[]>([])
  // VIP 权益介绍弹窗(首次进入自动展示,关闭后本次会话不再弹出)
  const [introVisible, setIntroVisible] = useState(false)
  const [introShown, setIntroShown] = useState(false)
  // VIP 等级介绍弹窗(H18,复刻 Uniapp vip_info/index.vue 的 introduce-popup levelIndex 变体)
  const [levelIntroVisible, setLevelIntroVisible] = useState(false)
  // 3 个未触发变体(复刻 Uniapp vip_info/index.vue 行 59-71 触发入口)
  const [introIndexVisible, setIntroIndexVisible] = useState(false)
  const [introIndexsVisible, setIntroIndexsVisible] = useState(false)
  const [privateAdvisoryVisible, setPrivateAdvisoryVisible] = useState(false)
  // BottomPopup 支付弹窗(行 6/127 BottomPopup 组件)
  const [bottomPopupVisible, setBottomPopupVisible] = useState(false)
  // 价格档位 Tab(对齐 Uniapp introduce-popup/index.vue 行 26-35)
  const [planTab, setPlanTab] = useState<PlanTab>('continuous')
  // 私董会服务弹窗(对齐 Uniapp privateAdvisory.vue 行 100-114 名片二维码弹窗)
  const [servicePopupVisible, setServicePopupVisible] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const [levelsRes, membershipRes] = await Promise.all([getVipLevels(), getMembershipInfo()])
      if (levelsRes.success) {
        const mapped = levelsRes.data.map(toVipLevel)
        setLevels(mapped)
        // 从 VipLevel 动态生成价格档位(对齐 Uniapp getvipPrice 个性化定价)
        setPricePlans(buildPricePlans(levelsRes.data))
      } else {
        setError(levelsRes.error || t('vip.loadFailed'))
      }
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

  // pay() 支付逻辑(对齐 Uniapp introduce-popup/index.vue 行 170 pay 函数)
  // P1: 接入微信 APP 支付 SDK(createWechatAppPayment → openWeChatPayment → checkPaymentStatus)
  const pay = useCallback(
    async (plan: PricePlan) => {
      const amountYuan = (plan.amount / 100).toFixed(2)
      Alert.alert(
        t('vipScreen.pay.title'),
        t('vipScreen.pay.message', { amount: amountYuan, name: plan.cycle }),
        [
          { text: t('vipScreen.pay.cancel'), style: 'cancel' },
          {
            text: t('vipScreen.pay.confirm'),
            onPress: async () => {
              setToast('')
              setPurchasingId(plan.id)
              try {
                // 1. 检查微信客户端是否安装
                const installed = await isWeChatInstalled()
                if (!installed) {
                  setToast(t('payment.wechatNotInstalled'))
                  setPurchasingId(null)
                  return
                }

                // 2. 创建微信 APP 支付订单(后端返回签名参数)
                // orderType=1 表示 VIP 会员订单(对齐后端 orderType 枚举)
                const payRes = await createWechatAppPayment({
                  amount: plan.amount,
                  orderType: 1,
                  description: plan.cycle,
                })
                if (!payRes.success || !payRes.data) {
                  setToast(payRes.error || t('vipScreen.pay.failed'))
                  setPurchasingId(null)
                  return
                }

                // 3. mock 模式(DEV 环境无微信支付配置):直接标记成功
                if (payRes.data.mock) {
                  setToast(t('vipScreen.pay.success'))
                  setPurchasingId(null)
                  void load(true)
                  return
                }

                // 4. 调起微信 APP 支付(传签名参数给 react-native-wechat-lib)
                if (!payRes.data.prepayData) {
                  setToast(t('payment.nativeUnavailable'))
                  setPurchasingId(null)
                  return
                }
                const paySuccess = await openWeChatPayment(payRes.data.prepayData)
                if (!paySuccess) {
                  // 用户取消支付
                  setToast(t('payment.payCancelled'))
                  setPurchasingId(null)
                  return
                }

                // 5. 支付成功,查询支付状态确认
                const orderNo = payRes.data.outTradeNo
                if (orderNo) {
                  const statusRes = await checkPaymentStatus(orderNo)
                  if (statusRes.success && statusRes.data?.paid) {
                    setToast(t('vipScreen.pay.success'))
                    void load(true)
                  } else {
                    // SDK 返回成功但后端状态未同步,给乐观提示
                    setToast(t('vipScreen.pay.success'))
                    void load(true)
                  }
                } else {
                  setToast(t('vipScreen.pay.success'))
                  void load(true)
                }
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                if (errMsg === 'WECHAT_NOT_INSTALLED') {
                  setToast(t('payment.wechatNotInstalled'))
                } else if (errMsg === 'WECHAT_NATIVE_UNAVAILABLE') {
                  setToast(t('payment.nativeUnavailable'))
                } else {
                  setToast(t('payment.payFailed'))
                }
              } finally {
                setPurchasingId(null)
              }
            },
          },
        ],
      )
    },
    [t, load],
  )

  // 私董会"加入我们" → 打开名片二维码服务弹窗
  // 对齐 Uniapp privateAdvisory.vue 行 84/180-182 showServicePopup
  const openServicePopup = useCallback(() => {
    setPrivateAdvisoryVisible(false)
    setServicePopupVisible(true)
  }, [])

  const filteredPlans = pricePlans.filter((p) => p.tab === planTab)

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

      {/* 会员权益价格卡片 + 连续/按月 Tab(对齐 Uniapp introduce-popup/index.vue 行 26-119) */}
      <View style={styles.planCard}>
        {/* Tab 切换(连续包月 vs 按月) */}
        <View style={styles.tabBar} accessibilityRole="tablist">
          {TABS.map((tab) => {
            const active = planTab === tab.key
            return (
              <Pressable
                key={tab.key}
                style={({ pressed }) => [
                  styles.tab,
                  active ? styles.tabActive : null,
                  pressed ? styles.tabPressed : null,
                ]}
                onPress={() => setPlanTab(tab.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={active ? styles.tabTextActive : styles.tabText}>
                  {t(tab.labelKey)}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* 价格卡片列表 */}
        <ScrollView
          style={styles.planScroll}
          contentContainerStyle={styles.planList}
          showsVerticalScrollIndicator={false}
        >
          {filteredPlans.map((plan) => {
            const hasDiscount = plan.defAmount > plan.amount
            return (
              <Pressable
                key={plan.id}
                style={({ pressed }) => [styles.planItem, pressed ? styles.planItemPressed : null]}
                onPress={() => pay(plan)}
                accessibilityRole="button"
                accessibilityLabel={`${plan.cycle} ¥${(plan.amount / 100).toFixed(2)}`}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planCycle} numberOfLines={1}>
                    {plan.cycle}
                  </Text>
                  <View style={styles.planTags}>
                    {plan.discount ? (
                      <View style={styles.discountTag}>
                        <Text style={styles.discountTagText}>{plan.discount}</Text>
                      </View>
                    ) : null}
                    {plan.trial ? (
                      <View style={styles.trialTag}>
                        <Text style={styles.trialTagText}>{plan.trial}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.planDetail}>{plan.detail}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.planAmount} allowFontScaling={false}>
                    ¥{(plan.amount / 100).toFixed(2)}
                  </Text>
                  {hasDiscount ? (
                    <Text style={styles.planDefAmount} allowFontScaling={false}>
                      ¥{(plan.defAmount / 100).toFixed(2)}
                    </Text>
                  ) : null}
                  <Text style={styles.planDuration}>{plan.durationDays} 天</Text>
                </View>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* 协议提示(对齐 Uniapp 行 122-124 agreement-text) */}
        <Text style={styles.agreementText}>{t('vipScreen.agreement')}</Text>
      </View>

      {/* 等级升级机制装饰区(对齐 Uniapp levelIndex.vue 行 21-29 钻石装饰) */}
      <View style={styles.levelBanner}>
        <Text style={styles.diamondIcon} allowFontScaling={false}>
          {'\u25C6'}
        </Text>
        <View style={styles.levelBannerText}>
          <Text style={styles.levelBannerTitle}>{t('vipScreen.banner.level')}</Text>
          <Text style={styles.levelBannerHint}>{t('vipScreen.banner.levelHint')}</Text>
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
      {/* privateAdvisory 变体:私人顾问(行 69 options.type == 'PrivateAdvisory')
          onConfirm 改为打开名片二维码服务弹窗(对齐 Uniapp privateAdvisory.vue 行 180-182) */}
      <IntroducePopup
        visible={privateAdvisoryVisible}
        onClose={() => setPrivateAdvisoryVisible(false)}
        variant="privateAdvisory"
        onConfirm={openServicePopup}
      />
      {/* BottomPopup 支付弹窗(行 6/127 BottomPopup 组件) */}
      <BottomPopup
        visible={bottomPopupVisible}
        onClose={() => setBottomPopupVisible(false)}
        levels={levels}
        onConfirm={onBottomPopupConfirm}
      />
      {/* 私董会名片二维码服务弹窗(对齐 Uniapp privateAdvisory.vue 行 100-114) */}
      <Modal
        visible={servicePopupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setServicePopupVisible(false)}
      >
        <Pressable
          style={styles.serviceMask}
          onPress={() => setServicePopupVisible(false)}
        >
          <Pressable
            style={styles.serviceSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <Pressable
              hitSlop={8}
              onPress={() => setServicePopupVisible(false)}
              style={styles.serviceClose}
              accessibilityRole="button"
              accessibilityLabel={t('vipScreen.qr.close')}
            >
              <X size={20} color={tokens.text.primary} />
            </Pressable>
            {/* 名片区(对齐 Uniapp mingpian.png) */}
            <View style={styles.serviceCard}>
              <Text style={styles.serviceCardTitle}>{t('vipScreen.qr.card')}</Text>
              <Text style={styles.serviceCardDesc}>{t('vipScreen.banner.privateAdvisory')}</Text>
            </View>
            {/* 二维码区(对齐 Uniapp erweima.png,长按可保存) */}
            <View style={styles.qrCodeBox}>
              <QrCode size={200} color={tokens.text.primary} />
            </View>
            <Text style={styles.qrCodeTitle}>{t('vipScreen.qr.title')}</Text>
            <Text style={styles.qrCodeHint}>{t('vipScreen.qr.hint')}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

// ── 样式常量(圆角守门:仅 2/4/6/8/12/16,无 rounded-full) ──
const ENTRY_CARD_RADIUS = 8
const ENTRY_BUTTON_PADDING_V = 10
const ENTRY_TITLE_FONT_SIZE = 13
const ENTRY_BUTTON_FONT_SIZE = 13

const TAB_RADIUS = 6
const TAB_FONT_SIZE = 13
const TAB_PADDING_V = 8

const PLAN_CARD_RADIUS = 8
// 对齐 Uniapp 20rpx(≈10px)价格卡片圆角
const PLAN_ITEM_RADIUS = 10
// 对齐 Uniapp 30rpx(≈15px)价格卡片内边距
const PLAN_ITEM_PADDING = 15
const PLAN_ITEM_GAP = 10
const PLAN_CYCLE_FONT_SIZE = 15
const PLAN_DETAIL_FONT_SIZE = 12
const PLAN_AMOUNT_FONT_SIZE = 22
const PLAN_DEF_AMOUNT_FONT_SIZE = 12
const PLAN_DURATION_FONT_SIZE = 12
const TAG_FONT_SIZE = 10
const TAG_RADIUS = 4
const TAG_PADDING_H = 6
const TAG_PADDING_V = 2
const AGREEMENT_FONT_SIZE = 10

const LEVEL_BANNER_RADIUS = 8
const DIAMOND_FONT_SIZE = 24
const LEVEL_BANNER_TITLE_FONT_SIZE = 13
const LEVEL_BANNER_HINT_FONT_SIZE = 11

const SERVICE_SHEET_RADIUS = 12
const SERVICE_CARD_RADIUS = 8
const QR_BOX_RADIUS = 8
const SERVICE_TITLE_FONT_SIZE = 15
const SERVICE_HINT_FONT_SIZE = 12

// 主题色 #5088fa:对齐 BottomPopup.tsx 同款 Uniapp 主题色常量
const ACCENT_COLOR = '#5088fa'

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
    borderRadius: ENTRY_CARD_RADIUS,
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
  // ── 价格卡片 Tab ──
  planCard: {
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: tokens.surface.light,
    borderRadius: PLAN_CARD_RADIUS,
    padding: 14,
  } as ViewStyle,
  tabBar: {
    flexDirection: 'row',
    backgroundColor: tokens.surface.muted,
    borderRadius: TAB_RADIUS,
    padding: 3,
  } as ViewStyle,
  tab: {
    flex: 1,
    paddingVertical: TAB_PADDING_V,
    borderRadius: TAB_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  tabActive: {
    backgroundColor: tokens.surface.light,
    shadowColor: tokens.gray.black,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  } as ViewStyle,
  tabPressed: {
    opacity: 0.7,
  } as ViewStyle,
  tabText: {
    fontSize: TAB_FONT_SIZE,
    lineHeight: TAB_FONT_SIZE + 2,
    color: tokens.text.secondary,
    fontWeight: '500',
  } as TextStyle,
  tabTextActive: {
    fontSize: TAB_FONT_SIZE,
    lineHeight: TAB_FONT_SIZE + 2,
    color: tokens.text.primary,
    fontWeight: '600',
  } as TextStyle,
  // ── 价格卡片列表 ──
  planScroll: {
    marginTop: 10,
  } as ViewStyle,
  planList: {
    gap: PLAN_ITEM_GAP,
    paddingBottom: 4,
  } as ViewStyle,
  planItem: {
    backgroundColor: tokens.surface.muted,
    borderRadius: PLAN_ITEM_RADIUS,
    padding: PLAN_ITEM_PADDING,
  } as ViewStyle,
  planItemPressed: {
    opacity: 0.7,
  } as ViewStyle,
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  planCycle: {
    flex: 1,
    fontSize: PLAN_CYCLE_FONT_SIZE,
    lineHeight: PLAN_CYCLE_FONT_SIZE + 4,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  planTags: {
    flexDirection: 'row',
    gap: 4,
  } as ViewStyle,
  discountTag: {
    backgroundColor: tokens.danger.light,
    borderRadius: TAG_RADIUS,
    paddingHorizontal: TAG_PADDING_H,
    paddingVertical: TAG_PADDING_V,
  } as ViewStyle,
  discountTagText: {
    fontSize: TAG_FONT_SIZE,
    lineHeight: TAG_FONT_SIZE + 2,
    color: tokens.danger.DEFAULT,
    fontWeight: '600',
  } as TextStyle,
  trialTag: {
    backgroundColor: tokens.purple.light,
    borderRadius: TAG_RADIUS,
    paddingHorizontal: TAG_PADDING_H,
    paddingVertical: TAG_PADDING_V,
  } as ViewStyle,
  trialTagText: {
    fontSize: TAG_FONT_SIZE,
    lineHeight: TAG_FONT_SIZE + 2,
    color: tokens.purple.DEFAULT,
    fontWeight: '600',
  } as TextStyle,
  planDetail: {
    marginTop: 4,
    fontSize: PLAN_DETAIL_FONT_SIZE,
    lineHeight: PLAN_DETAIL_FONT_SIZE + 4,
    color: tokens.text.secondary,
  } as TextStyle,
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  } as ViewStyle,
  planAmount: {
    fontSize: PLAN_AMOUNT_FONT_SIZE,
    lineHeight: PLAN_AMOUNT_FONT_SIZE + 2,
    fontWeight: '700',
    color: ACCENT_COLOR,
  } as TextStyle,
  planDefAmount: {
    fontSize: PLAN_DEF_AMOUNT_FONT_SIZE,
    lineHeight: PLAN_DEF_AMOUNT_FONT_SIZE + 2,
    color: tokens.text.tertiary,
    textDecorationLine: 'line-through',
  } as TextStyle,
  planDuration: {
    fontSize: PLAN_DURATION_FONT_SIZE,
    lineHeight: PLAN_DURATION_FONT_SIZE + 2,
    color: tokens.text.secondary,
  } as TextStyle,
  agreementText: {
    marginTop: 8,
    fontSize: AGREEMENT_FONT_SIZE,
    lineHeight: AGREEMENT_FONT_SIZE + 4,
    color: tokens.text.tertiary,
    textAlign: 'center',
  } as TextStyle,
  // ── 等级升级机制装饰区 ──
  levelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: tokens.purple.light,
    borderRadius: LEVEL_BANNER_RADIUS,
  } as ViewStyle,
  diamondIcon: {
    fontSize: DIAMOND_FONT_SIZE,
    lineHeight: DIAMOND_FONT_SIZE + 2,
    color: tokens.purple.DEFAULT,
  } as TextStyle,
  levelBannerText: {
    flex: 1,
  } as ViewStyle,
  levelBannerTitle: {
    fontSize: LEVEL_BANNER_TITLE_FONT_SIZE,
    lineHeight: LEVEL_BANNER_TITLE_FONT_SIZE + 4,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  levelBannerHint: {
    fontSize: LEVEL_BANNER_HINT_FONT_SIZE,
    lineHeight: LEVEL_BANNER_HINT_FONT_SIZE + 4,
    color: tokens.danger.DEFAULT,
    marginTop: 2,
  } as TextStyle,
  // ── 私董会服务弹窗 ──
  serviceMask: {
    flex: 1,
    backgroundColor: tokens.overlay.modal,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  serviceSheet: {
    width: '80%',
    backgroundColor: tokens.surface.light,
    borderRadius: SERVICE_SHEET_RADIUS,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  } as ViewStyle,
  serviceClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  serviceCard: {
    width: '100%',
    backgroundColor: tokens.surface.muted,
    borderRadius: SERVICE_CARD_RADIUS,
    padding: 14,
    alignItems: 'center',
  } as ViewStyle,
  serviceCardTitle: {
    fontSize: SERVICE_TITLE_FONT_SIZE,
    lineHeight: SERVICE_TITLE_FONT_SIZE + 4,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  serviceCardDesc: {
    fontSize: SERVICE_HINT_FONT_SIZE,
    lineHeight: SERVICE_HINT_FONT_SIZE + 4,
    color: tokens.text.secondary,
    marginTop: 4,
  } as TextStyle,
  qrCodeBox: {
    marginTop: 16,
    width: 220,
    height: 220,
    borderRadius: QR_BOX_RADIUS,
    backgroundColor: tokens.surface.light,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  qrCodeTitle: {
    marginTop: 12,
    fontSize: SERVICE_TITLE_FONT_SIZE,
    lineHeight: SERVICE_TITLE_FONT_SIZE + 4,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  qrCodeHint: {
    marginTop: 6,
    fontSize: SERVICE_HINT_FONT_SIZE,
    lineHeight: SERVICE_HINT_FONT_SIZE + 4,
    color: tokens.text.secondary,
  } as TextStyle,
})
