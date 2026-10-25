// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Check, Crown, Wallet } from 'lucide-react-native'
import QRCode from 'react-native-qrcode-svg'
import { fetchApi } from '@ihui/api-client'
import { rnLightTokens, rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type Tab = 'subscribe' | 'topup'
type PayMethod = 'wechat' | 'alipay'
const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000] as const
const MIN_YUAN = 1,
  MAX_YUAN = 50000,
  DEFAULT_YUAN = 100,
  POLL_INTERVAL_MS = 3000
/**
 * 购买中枢 —— 对齐 web `/purchase`(订阅套餐 + 账户充值双 Tab)。
 * 订阅(apps/api/src/routes/developer-relay.ts):
 *  - GET  /api/developer/relay/subscriptions ⇒ { status, plans }
 *  - POST /api/developer/relay/subscriptions/subscribe { planId, payMethod }
 *        ⇒ 201 { orderNo, amount, planId, planName, payMethod, checkoutUrl }
 *        checkoutUrl 是 web 相对路径,RN 不打开浏览器,改跳既有 Payment 订单列表。
 * 充值(apps/api/src/routes/payment-gateway.ts):
 *  - POST /api/payments/wechat/native?amount=分&orderType=2&description=… ⇒ { outTradeNo, amount, codeUrl?, mock? }
 *  - POST /api/payments/alipay/create?amount=元&orderType=2&subject=… ⇒ { outTradeNo, payUrl?, mock? }
 *  - GET  /api/payments/wechat/status/:outTradeNo ⇒ { orderNo, status, amount }
 */
interface PlanInfo {
  id: string
  name: string
  price: number
  originalPrice: number
  billingPeriod: string
  validityDays: number
  features: string[]
  dailyTokenLimit: number
  weeklyTokenLimit: number
  monthlyTokenLimit: number
  modelWhitelist: string[]
}

interface SubscriptionStatus {
  activePlan: { id: string } | null
  subscription: { planName: string; endAt: string } | null
  remainingTokens: number
}

interface PaymentCreateData {
  outTradeNo: string
  codeUrl?: string
  payUrl?: string
  mock?: boolean
}

function fmtCents(cents: number): string {
  return `¥${(Number(cents ?? 0) / 100).toFixed(Number.isInteger(Number(cents) / 100) ? 0 : 2)}`
}
export default function PurchaseScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<Tab>('subscribe')
  const [plans, setPlans] = useState<PlanInfo[]>([])
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [subLoading, setSubLoading] = useState(true)
  const [subFailed, setSubFailed] = useState(false)
  const [subscribingId, setSubscribingId] = useState<string | null>(null)

  const [amountText, setAmountText] = useState(String(DEFAULT_YUAN))
  const [method, setMethod] = useState<PayMethod>('wechat')
  const [paying, setPaying] = useState(false)
  const [payInfo, setPayInfo] = useState<PaymentCreateData | null>(null)
  const [paid, setPaid] = useState(false)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const loadSubscriptions = useCallback(async () => {
    setSubLoading(true)
    setSubFailed(false)
    try {
      const res = await fetchApi<{ status: SubscriptionStatus; plans: PlanInfo[] }>(
        '/api/developer/relay/subscriptions',
      )
      if (!res.success) throw new Error(res.error)
      setPlans(res.data?.plans ?? [])
      setStatus(res.data?.status ?? null)
    } catch {
      setPlans([])
      setStatus(null)
      setSubFailed(true)
    } finally {
      setSubLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSubscriptions()
  }, [loadSubscriptions])

  useEffect(
    () => () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
    },
    [],
  )

  const onSubscribe = async (plan: PlanInfo) => {
    setSubscribingId(plan.id)
    try {
      const res = await fetchApi<{ orderNo: string }>(
        '/api/developer/relay/subscriptions/subscribe',
        {
          method: 'POST',
          body: JSON.stringify({ planId: plan.id, payMethod: 'wechat' }),
        },
      )
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('purchase.submitFailed'))
        return
      }
      appAlert(t('common.hint'), t('purchase.orderCreated', { orderNo: res.data?.orderNo ?? '' }))
      navigation.navigate('Payment')
    } catch {
      appAlert(t('common.error'), t('purchase.submitFailed'))
    } finally {
      setSubscribingId(null)
    }
  }

  const startPolling = (outTradeNo: string) => {
    if (pollTimer.current) clearInterval(pollTimer.current)
    pollTimer.current = setInterval(async () => {
      try {
        const res = await fetchApi<{ status: string }>(
          `/api/payments/wechat/status/${encodeURIComponent(outTradeNo)}`,
        )
        if (res.success && res.data?.status === 'paid') {
          if (pollTimer.current) clearInterval(pollTimer.current)
          pollTimer.current = null
          setPaid(true)
          setPayInfo(null)
          void loadSubscriptions()
        }
      } catch {
        // 轮询失败继续等下一轮,不打断支付流程
      }
    }, POLL_INTERVAL_MS)
  }

  const onTopup = async () => {
    const amount = Number.parseInt(amountText.replace(/[^\d]/g, ''), 10) || 0
    if (amount < MIN_YUAN || amount > MAX_YUAN) {
      appAlert(t('common.error'), t('purchase.amountRange', { min: MIN_YUAN, max: MAX_YUAN }))
      return
    }
    setPaying(true)
    setPaid(false)
    try {
      const res =
        method === 'wechat'
          ? await fetchApi<PaymentCreateData>(
              `/api/payments/wechat/native?amount=${amount * 100}&orderType=2&description=${encodeURIComponent(t('purchase.topupDescription'))}`,
              { method: 'POST' },
            )
          : await fetchApi<PaymentCreateData>(
              `/api/payments/alipay/create?amount=${amount}&orderType=2&subject=${encodeURIComponent(t('purchase.topupDescription'))}`,
              { method: 'POST' },
            )
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('purchase.submitFailed'))
        return
      }
      const data = res.data
      if (!data) return
      if (data.mock || (!data.codeUrl && !data.payUrl)) {
        appAlert(t('common.error'), t('purchase.channelUnavailable'))
        return
      }
      setPayInfo(data)
      startPolling(data.outTradeNo)
    } catch {
      appAlert(t('common.error'), t('purchase.submitFailed'))
    } finally {
      setPaying(false)
    }
  }

  const pickQuick = (v: number) => setAmountText(String(v))
  const styles = makeStyles()
  const qrValue = payInfo?.codeUrl ?? payInfo?.payUrl ?? ''

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('purchase.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>{t('purchase.subtitle')}</Text>

        <View style={styles.tabRow}>
          {(['subscribe', 'topup'] as const).map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                {t(key === 'subscribe' ? 'purchase.tabSubscribe' : 'purchase.tabTopup')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'subscribe' ? (
          subLoading ? (
            <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
          ) : subFailed ? (
            <View style={styles.stateBox}>
              <Text style={styles.errorText}>{t('purchase.loadFailed')}</Text>
              <TouchableOpacity onPress={() => void loadSubscriptions()} activeOpacity={0.7}>
                <Text style={styles.retry}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Crown size={16} color={tokens.text.secondary} />
                  <Text style={styles.cardTitle}>{t('purchase.currentSubscription')}</Text>
                </View>
                {status?.subscription ? (
                  <>
                    <Text style={styles.cardValue}>{status.subscription.planName}</Text>
                    <Text style={styles.muted}>
                      {t('purchase.expiresAt')}{' '}
                      {dateFmt.format(new Date(status.subscription.endAt))}
                    </Text>
                    <Text style={styles.muted}>
                      {t('purchase.remaining')}:{' '}
                      {status.remainingTokens === -1
                        ? t('purchase.unlimited')
                        : status.remainingTokens}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.muted}>{t('purchase.noSubscription')}</Text>
                )}
              </View>

              {plans.length === 0 ? (
                <Text style={styles.muted}>{t('purchase.noPlans')}</Text>
              ) : (
                plans.map((plan) => {
                  const current = status?.activePlan?.id === plan.id
                  return (
                    <View key={plan.id} style={styles.card}>
                      <View style={styles.cardHead}>
                        <Text style={styles.cardTitle}>{plan.name}</Text>
                        <Text style={styles.price}>{fmtCents(plan.price)}</Text>
                      </View>
                      <Text style={styles.muted}>
                        {t('purchase.validityDays', { days: plan.validityDays })} ·{' '}
                        {plan.billingPeriod}
                      </Text>
                      {plan.features.slice(0, 3).map((f) => (
                        <View key={f} style={styles.featureRow}>
                          <Check size={12} color={tokens.success.DEFAULT} />
                          <Text style={styles.featureText}>{f}</Text>
                        </View>
                      ))}
                      <Text style={styles.muted}>
                        {plan.modelWhitelist.length > 0
                          ? t('purchase.modelWhitelist', { count: plan.modelWhitelist.length })
                          : t('purchase.allModels')}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.payBtn,
                          (current || subscribingId !== null) && styles.btnDisabled,
                        ]}
                        onPress={() => void onSubscribe(plan)}
                        disabled={current || subscribingId !== null}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.payBtnText}>
                          {current
                            ? t('purchase.currentPlan')
                            : subscribingId === plan.id
                              ? t('purchase.creating')
                              : t('purchase.subscribeNow')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )
                })
              )}
            </>
          )
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('purchase.amountLabel')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="number-pad"
              placeholder={String(DEFAULT_YUAN)}
              style={styles.input}
              editable={!paying}
            />
            <View style={styles.quickRow}>
              {QUICK_AMOUNTS.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.quickChip, amountText === String(v) && styles.quickChipActive]}
                  onPress={() => pickQuick(v)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.quickText, amountText === String(v) && styles.quickTextActive]}
                  >
                    ¥{v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('purchase.payMethod')}</Text>
            <View style={styles.methodRow}>
              {(['wechat', 'alipay'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodChip, method === m && styles.methodChipActive]}
                  onPress={() => setMethod(m)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.methodText, method === m && styles.methodTextActive]}>
                    {t(m === 'wechat' ? 'purchase.wechat' : 'purchase.alipay')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.noteBox}>
              <Wallet size={14} color={tokens.text.tertiary} />
              <Text style={styles.noteText}>{t('purchase.topupNote')}</Text>
            </View>

            <TouchableOpacity
              style={[styles.payBtn, paying && styles.btnDisabled]}
              onPress={() => void onTopup()}
              disabled={paying}
              activeOpacity={0.7}
            >
              <Text style={styles.payBtnText}>
                {paying ? t('purchase.creating') : t('purchase.payNow')}
              </Text>
            </TouchableOpacity>

            {paid ? (
              <View style={styles.qrBox}>
                <Text style={styles.paidText}>{t('purchase.paid')}</Text>
              </View>
            ) : payInfo && qrValue ? (
              <View style={styles.qrBox}>
                <Text style={styles.qrTitle}>
                  {method === 'alipay' ? t('purchase.alipayScan') : t('purchase.wechatScan')}
                </Text>
                <View style={styles.qrCanvas}>
                  <QRCode value={qrValue} size={180} />
                </View>
                <Text style={styles.muted}>{t('purchase.waitingPay')}</Text>
                <Text style={styles.muted}>
                  {t('purchase.orderNo')}: {payInfo.outTradeNo}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: 10, paddingBottom: rnSpacing['3xl'] },
    subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    tabRow: { flexDirection: 'row', gap: rnSpacing.sm },
    tab: {
      flex: 1,
      height: 36,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabActive: { borderColor: tokens.brandAccent.deep, backgroundColor: tokens.brandAccent.light },
    tabText: { fontSize: 13, color: tokens.text.secondary },
    tabTextActive: { color: tokens.brandAccent.deep, fontWeight: '600' },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['5xl'],
    },
    errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    card: {
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: 6,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: {
      flex: 1,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    cardValue: { fontSize: rnType.subtitle.size, fontWeight: '700', color: tokens.text.primary },
    price: { fontSize: rnType.title.size, fontWeight: '700', color: tokens.brandAccent.deep },
    muted: { fontSize: rnType.label.size, color: tokens.text.secondary },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    featureText: { flex: 1, fontSize: rnType.label.size, color: tokens.text.secondary },
    label: { marginTop: rnSpacing.xs, fontSize: rnType.label.size, color: tokens.text.secondary },
    input: {
      height: 42,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: rnType.body.size,
      backgroundColor: tokens.surface.bg,
    },
    quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    quickChip: {
      height: 30,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickChipActive: {
      borderColor: tokens.brandAccent.deep,
      backgroundColor: tokens.brandAccent.light,
    },
    quickText: { fontSize: rnType.label.size, color: tokens.text.secondary },
    quickTextActive: { color: tokens.brandAccent.deep, fontWeight: '600' },
    methodRow: { flexDirection: 'row', gap: rnSpacing.sm },
    methodChip: {
      flex: 1,
      height: 34,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    methodChipActive: {
      borderColor: tokens.brandAccent.deep,
      backgroundColor: tokens.brandAccent.light,
    },
    methodText: { fontSize: 13, color: tokens.text.secondary },
    methodTextActive: { color: tokens.brandAccent.deep, fontWeight: '600' },
    noteBox: {
      flexDirection: 'row',
      gap: 6,
      padding: 10,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.bg,
    },
    noteText: {
      flex: 1,
      fontSize: rnType.caption.size,
      lineHeight: 17,
      color: tokens.text.secondary,
    },
    payBtn: {
      height: 42,
      marginTop: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.5 },
    payBtnText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    qrBox: { alignItems: 'center', gap: 6, paddingVertical: 10 },
    // 二维码必须恒定亮底(跟随暗色主题会让多数扫码器识别失败),取亮色板书面白。
    qrCanvas: {
      padding: rnSpacing.sm,
      borderRadius: rnRadius.sm,
      backgroundColor: rnLightTokens.surface.light,
    },
    qrTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
    paidText: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.success.DEFAULT },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
