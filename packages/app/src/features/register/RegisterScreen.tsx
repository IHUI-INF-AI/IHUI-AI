import { useMemo } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { RegisterScreenProps } from '../../types'

/** 注册共享屏 — props 注入式跨端组件(wrapper 负责 register API 调用 + 自动登录) */
export type { RegisterScreenProps }

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
}: RegisterScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const onBrandText = tk.brand.DEFAULT === '#FFFFFF' ? '#000000' : '#FFFFFF'

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
