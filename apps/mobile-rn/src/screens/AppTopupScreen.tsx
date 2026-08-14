/**
 * AppTopupScreen App 端充值页(mobile-rn 端)
 *
 * 对齐历史 Uniapp pagesA/top-up/index_app.vue(App 端充值):
 * - 顶部 NavBar「充值」+ 返回
 * - UserInfoCard 用户信息卡(头像 + 昵称 + 智汇值,对齐 .vue UserInfoCard)
 * - 活动充值区(banner + 活动说明,对齐 .vue activity-bg-img;TODO: 对接 getactivity API)
 * - 充值比例三档说明(普通/会员/操盘手,对齐 .vue amount-header-right;TODO: 对接 selectsGoods API)
 * - 充值金额列表(mock 占位,TODO: 对接 selectsGoods API 动态列表)
 * - 自定义金额输入(对齐 .vue activityprice)
 * - 充值方式选择(微信/支付宝 Radio 路径区分,对齐 .vue topUp)
 * - 确认充值按钮 → 微信 APP 支付链路(useWechatPayment 共享 Hook,orderType=2 充值订单)
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线(gap 间距)
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { getTokenBalance } from '@ihui/api-client'
import type { UserInfo } from '@ihui/types'
import { NavBar } from '../components/NavBar'
import UserInfoCard from '../components/UserInfoCard'
import { useAuth } from '../context/AuthContext'
import { useWechatPayment } from '../hooks/useWechatPayment'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type PayMethod = 'wechat' | 'alipay'

interface AmountOption {
  id: number
  amount: number
}

// selectsGoods API 暂未在 api-client 封装,使用静态 4 档兜底,后端配置变更需前端同步
const AMOUNT_OPTIONS: readonly AmountOption[] = [
  { id: 1, amount: 10 },
  { id: 2, amount: 50 },
  { id: 3, amount: 100 },
  { id: 4, amount: 500 },
]

const PAY_METHODS: readonly { id: PayMethod; name: string; icon: string }[] = [
  { id: 'wechat', name: '微信支付', icon: '💚' },
  { id: 'alipay', name: '支付宝', icon: '💙' },
]

const MIN_AMOUNT = 1
const MAX_AMOUNT = 50000

/**
 * 智汇值比例:普通=10 / 会员=11 / 操盘手=12。
 * 操盘手需 identityType===1(对齐 packages/shared/utils/role.ts),AuthUser 暂未暴露该字段,
 * 降级用 isVip 区分普通(10)/会员(11);TODO: AuthUser 暴露 identityType 后补操盘手(12)分支。
 */
function getTokenRatio(isVip?: number): number {
  return isVip === 1 ? 11 : 10
}

export function AppTopupScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { user } = useAuth()
  const [selectedId, setSelectedId] = useState<number>(3)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [payMethod, setPayMethod] = useState<PayMethod>('wechat')
  const [balance, setBalance] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const tokenRatio = getTokenRatio(user?.isVip)

  // 智汇值余额加载(对齐 packages/api-client getTokenBalance API)
  // NOTE: 加载失败时 balance 保持 null → UserInfoCard 显示 0;formatTokenValue 不支持 '--'(NaN→'0'),
  //       需改 shared/utils/format.ts 才能在 UserInfoCard 显示 '--',此处不越界修改共享层。
  const loadBalance = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    const res = await getTokenBalance()
    if (res.success && res.data) {
      setBalance(res.data.balance)
    }
    setRefreshing(false)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void loadBalance()
  }, [loadBalance, user?.id])

  // 支付成功后刷新智汇值
  const handlePaySuccess = useCallback(async () => {
    await loadBalance()
  }, [loadBalance])

  // 微信 APP 支付共享 Hook(orderType=2 充值订单)
  const { paying, pay } = useWechatPayment({
    orderType: 2,
    onSuccess: handlePaySuccess,
  })

  const selectedOption = AMOUNT_OPTIONS.find((item) => item.id === selectedId)
  const finalAmount = customAmount ? Number(customAmount) : selectedOption?.amount ?? 0

  const selectAmount = (id: number): void => {
    setSelectedId(id)
    setCustomAmount('')
  }

  const validate = (): string => {
    if (!Number.isFinite(finalAmount) || finalAmount < MIN_AMOUNT) {
      return `请输入不小于 ${MIN_AMOUNT} 元的充值金额`
    }
    if (finalAmount > MAX_AMOUNT) {
      return `单次充值不能超过 ${MAX_AMOUNT} 元`
    }
    if (!Number.isInteger(finalAmount)) {
      return '充值金额必须为整数'
    }
    return ''
  }

  const onConfirm = (): void => {
    const err = validate()
    if (err) {
      Alert.alert('提示', err, [{ text: '知道了' }])
      return
    }
    if (payMethod === 'alipay') {
      // TODO: 支付宝原生 SDK 需 @alipay/react-native-alipay 包,暂未集成
      Alert.alert('提示', '支付宝暂未接入,请使用微信支付', [{ text: '知道了' }])
      return
    }
    // 微信支付:amountCents 单位分(createWechatAppPayment 期望整数分)
    void pay(finalAmount * 100, `充值 ${finalAmount} 元`)
  }

  // AuthUser → UserInfo 映射(UserInfoCard 所需字段)
  // NOTE: 加载中/失败均显示 0;formatTokenValue 不支持 '--'(NaN → '0'),需改 shared 工具才能显示 '--'
  const userInfo: UserInfo = user
    ? {
        uuid: user.id,
        username: user.nickname || user.username,
        avatarUrl: user.avatar,
        isVip: user.isVip,
        tokenQuantity: balance ?? 0,
      }
    : {}

  return (
    <View style={styles.container}>
      <NavBar title="充值" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadBalance(true)}
              colors={[tk.brand.DEFAULT]}
              tintColor={tk.brand.DEFAULT}
            />
          }
        >
          <UserInfoCard userInfo={userInfo} showRechargeBtn={false} />

          {/* 活动充值区(对齐 Uniapp activity-bg-img + activity-input-card) */}
          {/* TODO(P1): 对接 getactivity() API 获取活动数据 */}
          <View style={styles.activityCard}>
            <Text style={styles.activityTitle}>🎁 充值活动</Text>
            <Text style={styles.activityDesc}>活动期间充值享额外智汇值赠送,多充多送</Text>
          </View>

          {/* 充值比例三档说明(对齐 Uniapp amount-header-right) */}
          {/* TODO(P1): 对接 selectsGoods() API 获取 denomination 数据 */}
          <View style={styles.ratioCard}>
            <Text style={styles.ratioTitle}>充值比例</Text>
            <Text style={styles.ratioLine}>普通用户 1 元 = 10 智汇值</Text>
            <Text style={styles.ratioLine}>会员 1 元 = 11 智汇值</Text>
            <Text style={styles.ratioLine}>操盘手 1 元 = 12 智汇值</Text>
          </View>

          <Text style={styles.sectionTitle}>选择充值金额</Text>
          <View style={styles.amountGrid}>
            {AMOUNT_OPTIONS.map((item) => {
              const active = item.id === selectedId && !customAmount
              return (
                <Pressable
                  key={item.id}
                  style={[styles.amountChip, active ? styles.amountChipActive : null]}
                  onPress={() => selectAmount(item.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.amount} 元`}
                >
                  <Text style={[styles.amountChipText, active ? styles.amountChipTextActive : null]}>
                    {item.amount} 元
                  </Text>
                  <Text style={[styles.amountChipSub, active ? styles.amountChipSubActive : null]}>
                    {item.amount * tokenRatio} 智汇值
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={styles.sectionTitle}>自定义金额</Text>
          <View style={styles.customRow}>
            <Text style={styles.currencySymbol}>¥</Text>
            <TextInput
              style={styles.customInput}
              value={customAmount}
              onChangeText={setCustomAmount}
              placeholder="输入充值金额(整数)"
              placeholderTextColor={tk.text.tertiary}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.sectionTitle}>选择充值方式</Text>
          <View style={styles.payList}>
            {PAY_METHODS.map((method) => {
              const active = method.id === payMethod
              return (
                <Pressable
                  key={method.id}
                  style={({ pressed }) => [
                    styles.payItem,
                    active ? styles.payItemActive : null,
                    pressed ? styles.payItemPressed : null,
                  ]}
                  onPress={() => setPayMethod(method.id)}
                  accessibilityRole="button"
                  accessibilityLabel={method.name}
                >
                  <Text style={styles.payIcon}>{method.icon}</Text>
                  <Text style={styles.payName}>{method.name}</Text>
                  <View style={[styles.radio, active ? styles.radioActive : null]}>
                    {active ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              )
            })}
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>充值金额</Text>
            <Text style={styles.summaryValue}>
              ¥{Number.isFinite(finalAmount) ? finalAmount.toFixed(2) : '0.00'}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.confirmBtn,
              pressed ? styles.confirmBtnPressed : null,
              paying ? styles.confirmBtnDisabled : null,
            ]}
            onPress={onConfirm}
            disabled={paying}
            accessibilityRole="button"
            accessibilityLabel="确认充值"
            accessibilityState={{ disabled: paying }}
          >
            {paying ? (
              <ActivityIndicator color={tk.surface.light} size="small" />
            ) : (
              <Text style={styles.confirmBtnText}>确认充值</Text>
            )}
          </Pressable>

          <Text style={styles.footerNote}>充值即表示同意《充值服务协议》· 充值金额不支持退款</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tk.surface.bg } as ViewStyle,
  flex: { flex: 1 } as ViewStyle,
  scrollContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 } as ViewStyle,
  activityCard: {
    backgroundColor: tk.indigo.light,
    borderRadius: 12,
    padding: 16,
    gap: 4,
  } as ViewStyle,
  activityTitle: { fontSize: 15, fontWeight: '600', color: tk.indigo.deep } as TextStyle,
  activityDesc: { fontSize: 13, color: tk.indigo.DEFAULT } as TextStyle,
  ratioCard: {
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  } as ViewStyle,
  ratioTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary } as TextStyle,
  ratioLine: { fontSize: 13, color: tk.text.secondary } as TextStyle,
  sectionTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary, marginTop: 4 } as TextStyle,
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } as ViewStyle,
  amountChip: {
    width: '47%',
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  } as ViewStyle,
  amountChipActive: {
    borderColor: tk.brand.DEFAULT,
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
  amountChipText: { fontSize: 16, fontWeight: '600', color: tk.text.primary } as TextStyle,
  amountChipTextActive: { color: tk.brand.DEFAULT } as TextStyle,
  amountChipSub: { fontSize: 12, color: tk.text.tertiary } as TextStyle,
  amountChipSubActive: { color: tk.brand.DEFAULT } as TextStyle,
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    paddingHorizontal: 14,
  } as ViewStyle,
  currencySymbol: { fontSize: 18, fontWeight: '600', color: tk.text.primary } as TextStyle,
  customInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    fontSize: 16,
    color: tk.text.primary,
  } as TextStyle,
  payList: { gap: 10 } as ViewStyle,
  payItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  } as ViewStyle,
  payItemActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.muted } as ViewStyle,
  payItemPressed: { opacity: 0.85 } as ViewStyle,
  payIcon: { fontSize: 22 } as TextStyle,
  payName: { flex: 1, fontSize: 15, color: tk.text.primary } as TextStyle,
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: tk.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  radioActive: { borderColor: tk.brand.DEFAULT } as ViewStyle,
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: tk.brand.DEFAULT } as ViewStyle,
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
  } as ViewStyle,
  summaryLabel: { fontSize: 14, color: tk.text.secondary } as TextStyle,
  summaryValue: { fontSize: 18, fontWeight: '700', color: tk.warning.deep } as TextStyle,
  confirmBtn: {
    backgroundColor: tk.brand.DEFAULT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  } as ViewStyle,
  confirmBtnPressed: { opacity: 0.85 } as ViewStyle,
  confirmBtnDisabled: { opacity: 0.6 } as ViewStyle,
  confirmBtnText: { fontSize: 16, fontWeight: '600', color: tk.surface.light } as TextStyle,
  footerNote: {
    fontSize: 12,
    color: tk.text.tertiary,
    textAlign: 'center',
    marginTop: 4,
  } as TextStyle,
})

export default AppTopupScreen
