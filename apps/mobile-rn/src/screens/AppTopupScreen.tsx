/**
 * AppTopupScreen App 端充值页(mobile-rn 端)
 *
 * 对齐历史 Uniapp pagesA/top-up/index_app.vue(App 端充值):
 * - 顶部 NavBar「充值」+ 返回
 * - 预设金额 chips(10/50/100/500)
 * - 自定义金额输入(对齐 .vue activityprice)
 * - 充值方式选择(微信/支付宝,对齐 .vue topUp)
 * - 确认充值按钮 → 调用 createOrder API,成功后跳转 PaymentScreen
 * - 浅色优雅风,rnLightTokens;圆角守门(无 rounded-full);无分割线(gap 间距)
 */
import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { createOrder } from '@ihui/api-client'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import Loading from '../components/common/Loading'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type PayMethod = 'wechat' | 'alipay'

interface PresetAmount {
  value: number
  label: string
}

const PRESET_AMOUNTS: readonly PresetAmount[] = [
  { value: 10, label: '10 元' },
  { value: 50, label: '50 元' },
  { value: 100, label: '100 元' },
  { value: 500, label: '500 元' },
]

const PAY_METHODS: readonly { id: PayMethod; name: string; icon: string }[] = [
  { id: 'wechat', name: '微信支付', icon: '💚' },
  { id: 'alipay', name: '支付宝', icon: '💙' },
]

const MIN_AMOUNT = 1
const MAX_AMOUNT = 50000

export function AppTopupScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [selectedAmount, setSelectedAmount] = useState<number>(100)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [payMethod, setPayMethod] = useState<PayMethod>('alipay')
  const [submitting, setSubmitting] = useState(false)

  const finalAmount = customAmount ? Number(customAmount) : selectedAmount

  const selectPreset = (value: number): void => {
    setSelectedAmount(value)
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

  const onConfirm = async (): Promise<void> => {
    const err = validate()
    if (err) {
      Alert.alert('提示', err, [{ text: '知道了' }])
      return
    }
    setSubmitting(true)
    try {
      const res = await createOrder({
        type: 'recharge',
        targetId: String(finalAmount),
        remark: `${payMethod} 充值 ${finalAmount} 元`,
      })
      if (res.success) {
        navigation.navigate('Payment')
      } else {
        Alert.alert('充值失败', res.error || '请稍后重试', [{ text: '知道了' }])
      }
    } catch {
      Alert.alert('充值失败', '网络异常,请稍后重试', [{ text: '知道了' }])
    } finally {
      setSubmitting(false)
    }
  }

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
        >
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>当前账户余额(元)</Text>
            <Text style={styles.balanceValue}>0.00</Text>
            <Text style={styles.balanceHint}>充值后可用于购买课程、AI 服务等</Text>
          </View>

          <Text style={styles.sectionTitle}>选择充值金额</Text>
          <View style={styles.amountGrid}>
            {PRESET_AMOUNTS.map((item) => {
              const active = item.value === selectedAmount && !customAmount
              return (
                <Pressable
                  key={item.value}
                  style={[styles.amountChip, active ? styles.amountChipActive : null]}
                  onPress={() => selectPreset(item.value)}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <Text style={[styles.amountChipText, active ? styles.amountChipTextActive : null]}>
                    {item.label}
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
            <Text style={styles.summaryValue}>¥{Number.isFinite(finalAmount) ? finalAmount.toFixed(2) : '0.00'}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.confirmBtn, pressed ? styles.confirmBtnPressed : null]}
            onPress={() => void onConfirm()}
            accessibilityRole="button"
            accessibilityLabel="确认充值"
          >
            {submitting ? <Loading text="" /> : <Text style={styles.confirmBtnText}>确认充值</Text>}
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
  balanceCard: {
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    padding: 18,
    gap: 6,
    alignItems: 'center',
  } as ViewStyle,
  balanceLabel: { fontSize: 13, color: tk.text.secondary } as TextStyle,
  balanceValue: { fontSize: 28, fontWeight: '700', color: tk.text.primary } as TextStyle,
  balanceHint: { fontSize: 12, color: tk.text.tertiary } as TextStyle,
  sectionTitle: { fontSize: 15, fontWeight: '600', color: tk.text.primary, marginTop: 4 } as TextStyle,
  amountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } as ViewStyle,
  amountChip: {
    width: '47%',
    backgroundColor: tk.surface.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  } as ViewStyle,
  amountChipActive: {
    borderColor: tk.brand.DEFAULT,
    backgroundColor: tk.surface.muted,
  } as ViewStyle,
  amountChipText: { fontSize: 16, fontWeight: '600', color: tk.text.primary } as TextStyle,
  amountChipTextActive: { color: tk.brand.DEFAULT } as TextStyle,
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
  confirmBtnText: { fontSize: 16, fontWeight: '600', color: tk.surface.light } as TextStyle,
  footerNote: {
    fontSize: 12,
    color: tk.text.tertiary,
    textAlign: 'center',
    marginTop: 4,
  } as TextStyle,
})

export default AppTopupScreen
