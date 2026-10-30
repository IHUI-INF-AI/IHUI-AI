// © 2026 IHUI AI (智汇AI) · 版权所有者: 李
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { appAlert, BottomPops } from '../components/BottomPops'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, getBalance } from '@ihui/api-client'
import { WithdrawScreen as SharedWithdrawScreen } from '@ihui/rn-app'
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

  // 面板配色跟随主题（与共享屏 colorScheme 同源，避免深色系统下弹出一张刺眼白卡）
  const dark = resolvedTheme === 'dark'
  const c = {
    hint: dark ? '#9CA3AF' : '#6B7280',
    inputBg: dark ? '#1F2937' : '#F9FAFB',
    inputText: dark ? '#F9FAFB' : '#111827',
    border: dark ? '#374151' : '#E5E7EB',
    cancelBg: dark ? '#374151' : '#F3F4F6',
    cancelText: dark ? '#E5E7EB' : '#374151',
    okBg: '#6366F1',
    error: '#EF4444',
  }

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
          <Text style={[styles.hint, { color: c.hint }]}>{t('withdraw.stepUpHint')}</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: c.inputBg, color: c.inputText, borderColor: c.border },
            ]}
            value={totp}
            // 只收数字并截 6 位：粘贴带空格/连字符的码也能直接用
            onChangeText={(v) => setTotp(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder={t('withdraw.stepUpPlaceholder')}
            placeholderTextColor={c.hint}
            editable={!stepUpBusy}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void submitStepUp()}
          />
          {stepUpError ? (
            <Text style={[styles.error, { color: c.error }]}>{stepUpError}</Text>
          ) : null}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: c.cancelBg }]}
              onPress={() => setStepUpOpen(false)}
              disabled={stepUpBusy}
            >
              <Text style={[styles.btnText, { color: c.cancelText }]}>
                {t('withdraw.stepUpCancel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: c.okBg }]}
              onPress={() => void submitStepUp()}
              disabled={stepUpBusy}
            >
              {stepUpBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.btnText, styles.okText]}>{t('withdraw.stepUpSubmit')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </BottomPops>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: { gap: 12 },
  hint: { fontSize: 13, lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
  },
  error: { fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
  okText: { color: '#fff' },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
