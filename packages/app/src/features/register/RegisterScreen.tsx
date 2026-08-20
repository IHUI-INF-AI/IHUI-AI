import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { RegisterScreenProps } from '../../types'

/** 注册共享屏 — props 注入式跨端组件(wrapper 负责 register API 调用 + 自动登录) */
export type { RegisterScreenProps }

/**
 * 注册验证码可选注入 props(接入点):
 * 共享层只负责 UI + 60s 倒计时,发送短信的真实 API 由 wrapper 通过 onSendCode 注入。
 * 建议实现:`onSendCode: () => sendSmsCode(account, 'register')`(@ihui/api-client)。
 * 未注入 onSendCode 时发送按钮禁用,避免伪造接口调用。
 * 注册提交时验证码需由 wrapper 传给 register()(api-client register 有 code 参数)。
 */
export interface RegisterCodeOptions {
  /** 验证码值(受控;未注入时组件内部维护) */
  code?: string
  /** 验证码变更回调(受控) */
  onCodeChange?: (text: string) => void
  /** 发送验证码回调(发送成功后组件启动 60s 倒计时) */
  onSendCode?: () => Promise<void>
  /** 发送倒计时秒数(受控;未注入时组件内部维护) */
  countdown?: number
  /** 发送中标志(受控) */
  sendingCode?: boolean
}

export function RegisterScreen({
  t,
  account,
  password,
  confirmPassword,
  loading,
  error,
  onAccountChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onRegister,
  onBack,
  colorScheme = 'light',
  enableAgreement = false,
  agreed = false,
  onAgreedChange,
  showAgreeErr = false,
  onOpenTerms,
  onOpenPrivacy,
  // ===== 注册验证码(可选注入,未注入时组件内部维护) =====
  code: codeProp,
  onCodeChange,
  onSendCode,
  countdown: countdownProp,
  sendingCode: sendingCodeProp,
}: RegisterScreenProps & RegisterCodeOptions) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const onBrandText = tk.brand.DEFAULT === '#FFFFFF' ? '#000000' : '#FFFFFF'

  // ===== 验证码内部兜底状态(外部注入 prop 时优先使用注入值) =====
  const [codeState, setCodeState] = useState('')
  const [countdownState, setCountdownState] = useState(0)
  const [sendingState, setSendingState] = useState(false)
  const [codeSendError, setCodeSendError] = useState('')

  const code = codeProp ?? codeState
  const handleCodeChange = onCodeChange ?? setCodeState
  const countdown = countdownProp ?? countdownState
  const sending = sendingCodeProp ?? sendingState

  // 内部 60s 倒计时(仅外部未注入 countdown 时,由发送成功后启动)
  useEffect(() => {
    if (countdownProp !== undefined || countdownState <= 0) return
    const timer = setTimeout(() => setCountdownState((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdownProp, countdownState])

  const handleSendCode = async () => {
    if (!onSendCode || countdown > 0 || sending) return
    setCodeSendError('')
    setSendingState(true)
    try {
      await onSendCode()
      if (countdownProp === undefined) setCountdownState(60)
    } catch {
      setCodeSendError(t('register.sendCodeFailed'))
    } finally {
      setSendingState(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('register.title')}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>{t('register.phone')}</Text>
        <TextInput
          style={styles.input}
          value={account}
          onChangeText={onAccountChange}
          placeholder={t('register.phonePlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          autoCapitalize="none"
        />
        <Text style={styles.label}>{t('register.code')}</Text>
        <View style={styles.codeRow}>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={handleCodeChange}
            placeholder={t('register.codePlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            keyboardType="number-pad"
            maxLength={6}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.codeBtn, (countdown > 0 || sending || !onSendCode) && styles.codeBtnDisabled]}
            onPress={() => void handleSendCode()}
            disabled={countdown > 0 || sending || !onSendCode}
          >
            <Text style={styles.codeBtnText}>
              {countdown > 0 ? t('register.resendIn', { countdown }) : t('register.sendCode')}
            </Text>
          </TouchableOpacity>
        </View>
        {codeSendError ? <Text style={styles.error}>{codeSendError}</Text> : null}
        <Text style={styles.label}>{t('register.password')}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={onPasswordChange}
          placeholder={t('register.passwordPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          secureTextEntry
        />
        <Text style={styles.label}>{t('register.confirmPassword')}</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={onConfirmPasswordChange}
          placeholder={t('register.confirmPasswordPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {enableAgreement ? (
          <View style={styles.agreementRow}>
            <View style={styles.agreementRowMain}>
              <TouchableOpacity
                style={[
                  styles.checkbox,
                  agreed ? styles.checkboxChecked : styles.checkboxUnchecked,
                  showAgreeErr && !agreed ? styles.checkboxError : null,
                ]}
                onPress={() => onAgreedChange?.(!agreed)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                accessibilityLabel={t('auth.agreePrefix')}
              >
                {agreed ? <Text style={[styles.checkmark, { color: onBrandText }]}>✓</Text> : null}
              </TouchableOpacity>
              <Text style={styles.agreementText}>
                {t('auth.agreePrefix')}
                <Text
                  style={styles.agreementLink}
                  onPress={onOpenTerms}
                  accessibilityRole="link"
                  accessibilityLabel={t('auth.termsOfService')}
                >
                  {t('auth.termsOfService')}
                </Text>
                {t('auth.and')}
                <Text
                  style={styles.agreementLink}
                  onPress={onOpenPrivacy}
                  accessibilityRole="link"
                  accessibilityLabel={t('auth.privacyPolicy')}
                >
                  {t('auth.privacyPolicy')}
                </Text>
              </Text>
            </View>
            {showAgreeErr && !agreed ? (
              <Text style={styles.agreementErrorText}>{t('auth.agreeRequired')}</Text>
            ) : null}
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.btnDisabled]}
          onPress={onRegister}
          disabled={loading}
        >
          <Text style={styles.submitText}>
            {loading ? t('register.registering') : t('register.submit')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
      paddingHorizontal: 10,
      paddingTop: 48,
      paddingBottom: 32,
    },
    header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginBottom: 12 },
    back: { fontSize: 16, color: tk.text.secondary, marginRight: 12 },
    title: { fontSize: 22, fontWeight: '700', color: tk.text.primary },
    card: { padding: 14, backgroundColor: tk.surface.light, borderRadius: 12 },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: tk.text.secondary,
      marginBottom: 8,
      marginTop: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 50,
      backgroundColor: '#f5f5f5',
      fontSize: 16,
      color: tk.text.primary,
    },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    codeInput: { flex: 1 },
    codeBtn: {
      height: 50,
      paddingHorizontal: 14,
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.surface.light,
    },
    codeBtnDisabled: { opacity: 0.5 },
    codeBtnText: { color: tk.brand.DEFAULT, fontSize: 14, fontWeight: '600' },
    error: { fontSize: 14, color: tk.danger.DEFAULT, marginTop: 12 },
    // ===== 协议同意行(对齐 LoginScreen AgreementRow 样式) =====
    agreementRow: { marginTop: 16 },
    agreementRowMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    checkbox: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1,
      marginTop: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxUnchecked: {
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    checkboxChecked: {
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.brand.DEFAULT,
    },
    checkboxError: { borderColor: 'rgba(220, 38, 38, 1)' },
    checkmark: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
    agreementText: { flex: 1, fontSize: 14, lineHeight: 18, color: tk.text.secondary },
    agreementLink: { color: tk.brand.DEFAULT },
    agreementErrorText: { fontSize: 14, color: 'rgba(220, 38, 38, 1)', marginTop: 8 },
    submitBtn: {
      marginTop: 16,
      height: 50,
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    submitText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
  })
}
