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
}: RegisterScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

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
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 32 },
    header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, marginBottom: 12 },
    back: { fontSize: 14, color: tk.text.secondary, marginRight: 12 },
    title: { fontSize: 22, fontWeight: '600', color: tk.text.primary },
    card: { padding: 16, backgroundColor: tk.surface.light, borderRadius: 8 },
    label: { fontSize: 12, fontWeight: '600', color: tk.text.secondary, marginBottom: 4, marginTop: 12 },
    input: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: tk.text.primary,
    },
    error: { fontSize: 13, color: tk.danger.DEFAULT, marginTop: 12 },
    submitBtn: {
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    submitText: { color: tk.surface.light, fontSize: 15, fontWeight: '600' },
  })
}
