// © 2026 IHUI AI (智汇AI) · 版权所有者: 李
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { appAlert, BottomPops, sheetButton } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, getBalance } from '@ihui/api-client'
import { getTokens, TextField, WithdrawScreen as SharedWithdrawScreen } from '@ihui/rn-app'
import { rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function WithdrawScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [amount, setAmount] = useState('')
  const [bankCardId, setBankCardId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  // 可提现金额(对齐原项目 withdrawal/index.vue 顶部余额展示;真实来源 wallet.getBalance())
  const [balance, setBalance] = useState(0)
  // 两步验证(TOTP)面板:开了 2FA 的账号提现会收到 401 STEP_UP_REQUIRED,
  // 必须先 POST /auth/2fa/step-up 记账(5 分钟窗内有效),再原样重试提现。
  // 改前本屏只把后端那句"请先调用 POST /auth/2fa/step-up"当错误文案显示出来,
  // 用户既没有输入框也没有下一步动作 ⇒ 开了 2FA 就永远提不了现。
  const [stepUpOpen, setStepUpOpen] = useState(false)
  const [totp, setTotp] = useState('')
  const [stepUpBusy, setStepUpBusy] = useState(false)
  const [stepUpError, setStepUpError] = useState('')

  useEffect(() => {
    void getBalance().then((res) => {
      if (res.success) setBalance(res.data.balance)
    })
  }, [])

  /**
   * 真正打提现接口的那一步（可被 TOTP 验证成功后原样重放）。
   * 返回值语义：stepup = 需要先过两步验证（面板已弹出）；其余为普通失败/成功。
   */
  const submitWithdraw = async (): Promise<'ok' | 'stepup' | 'fail'> => {
    const num = Number(amount)
    try {
      const resp = await fetchApi<unknown>('/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(num),
          account: bankCardId,
          accountType: 'bank_card',
        }),
      })
      if (!resp.success) {
        // 机器码优先：errorCode 是稳定契约，文案会改；命中即拉 TOTP 面板而不是报错
        if (resp.errorCode === 'STEP_UP_REQUIRED') {
          setStepUpError('')
          setTotp('')
          setStepUpOpen(true)
          return 'stepup'
        }
        setError(resp.error || t('withdraw.failed'))
        return 'fail'
      }
      setSuccess(t('withdraw.success'))
      setAmount('')
      setBankCardId('')
      return 'ok'
    } catch {
      setError(t('withdraw.failed'))
      return 'fail'
    }
  }

  const doWithdraw = async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await submitWithdraw()
    } finally {
      setLoading(false)
    }
  }

  /** 提交 6 位 TOTP → 记账成功即关面板并自动重试提现（不让用户再填一遍表单）。 */
  const submitStepUp = async () => {
    if (!/^\d{6}$/.test(totp)) {
      setStepUpError(t('withdraw.stepUpInvalid'))
      return
    }
    setStepUpBusy(true)
    setStepUpError('')
    try {
      const resp = await fetchApi<{ verified?: boolean }>('/api/auth/2fa/step-up', {
        method: 'POST',
        body: JSON.stringify({ code: totp }),
      })
      if (!resp.success) {
        setStepUpError(resp.error || t('withdraw.stepUpFailed'))
        return
      }
      setStepUpOpen(false)
      setTotp('')
      setSuccess(t('withdraw.stepUpSuccess'))
      setLoading(true)
      try {
        await submitWithdraw()
      } finally {
        setLoading(false)
      }
    } catch {
      setStepUpError(t('withdraw.stepUpFailed'))
    } finally {
      setStepUpBusy(false)
    }
  }

  const handleSubmit = async () => {
    const num = Number(amount)
    if (!Number.isFinite(num) || num <= 0) {
      setError(t('withdraw.amountInvalid'))
      return
    }
    if (num < 10) {
      setError(t('withdraw.minAmount'))
      return
    }
    // 二次确认弹窗(对齐原项目提现确认交互:先确认再发起)
    appAlert(t('withdraw.confirmTitle'), t('withdraw.confirmMessage', { amount: num.toFixed(2) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: () => void doWithdraw() },
    ])
  }

  // 弹层取色与共享屏同一出口(getTokens(resolvedTheme)),不再另立一份端内色表。
  // 此前这里按 dark 三元手写了一整套 Tailwind 蓝灰档,并把 CTA 底定死成一枚已废弃的紫靛档:
  // 值与 tokens 不同源 ⇒ tokens.css 改色永不跟随;而深色下 brand.cta 翻成纯白,
  // 配同批写死的浅色前景 ⇒ 提交按钮上的文字在深色模式里对比度 1:1(隐形)。
  const tk = getTokens(resolvedTheme)

  return (
    <View style={styles.root}>
      <SharedWithdrawScreen
        t={t}
        amount={amount}
        bankCardId={bankCardId}
        balance={balance}
        loading={loading}
        error={error}
        success={success}
        onAmountChange={setAmount}
        onBankCardIdChange={setBankCardId}
        onSubmit={handleSubmit}
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
      />
      <BottomPops
        visible={stepUpOpen}
        onClose={() => {
          if (!stepUpBusy) setStepUpOpen(false)
        }}
        title={t('withdraw.stepUpTitle')}
      >
        <View style={styles.panel}>
          <Text style={[styles.hint, { color: tk.text.secondary }]}>
            {t('withdraw.stepUpHint')}
          </Text>
          <TextField
            colorScheme={resolvedTheme}
            style={[
              styles.input,
              {
                backgroundColor: tk.surface.inputBg,
                color: tk.text.primary,
                borderColor: tk.border.light,
              },
            ]}
            value={totp}
            // 只收数字并截 6 位：粘贴带空格/连字符的码也能直接用
            onChangeText={(v) => setTotp(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder={t('withdraw.stepUpPlaceholder')}
            placeholderTextColor={tk.text.secondary}
            editable={!stepUpBusy}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void submitStepUp()}
          />
          {stepUpError ? (
            <Text style={[styles.error, { color: tk.danger.DEFAULT }]}>{stepUpError}</Text>
          ) : null}
          <View style={[sheetButton.row, styles.btnRow]}>
            <Pressable
              accessibilityRole="button"
              style={[sheetButton.base, sheetButton.cancel]}
              onPress={() => setStepUpOpen(false)}
              disabled={stepUpBusy}
            >
              {({ pressed }) => (
                <View
                  style={[styles.pressCell, pressed || stepUpBusy ? sheetButton.pressDim : null]}
                >
                  <Text style={sheetButton.cancelText}>{t('withdraw.stepUpCancel')}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[sheetButton.base, sheetButton.primary]}
              onPress={() => void submitStepUp()}
              disabled={stepUpBusy}
            >
              {({ pressed }) => (
                <View style={[styles.pressCell, pressed ? sheetButton.pressDim : null]}>
                  {stepUpBusy ? (
                    <ActivityIndicator color={tk.brand.ctaForeground} />
                  ) : (
                    <Text style={sheetButton.primaryText}>{t('withdraw.stepUpSubmit')}</Text>
                  )}
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </BottomPops>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: { gap: rnSpacing.md },
  hint: { fontSize: rnType.label.size, lineHeight: rnType.label.lineHeight },
  input: {
    // 描边宽度与常态占位归共享 TextField(聚焦换墨档、零布局跳动),这里只补几何与字档
    borderRadius: rnRadiusFor.control,
    paddingHorizontal: rnSpacing.lg,
    paddingVertical: rnSpacing.md,
    fontSize: rnType.heading.size,
    lineHeight: rnType.heading.lineHeight,
    // 验证码字距:间距族无此档,且它不是几何尺寸(门 270 射程外的合法残留)
    letterSpacing: 8,
    textAlign: 'center',
  },
  error: { fontSize: rnType.label.size },
  btnRow: { marginTop: rnSpacing.xs },
  pressCell: { alignItems: 'center', justifyContent: 'center' },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
