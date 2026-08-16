import { useMemo } from 'react'
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { SettingsAccountScreenProps } from '../../types'

/** 账号设置共享屏 — props 注入式跨端组件(wrapper 负责 GET/PUT /account) */
export type { SettingsAccountScreenProps }

export function SettingsAccountScreen({
  t,
  account,
  loading,
  saving,
  error,
  toast,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onSave,
  onBack,
  colorScheme = 'light',
}: SettingsAccountScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading || !account) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.text.primary} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{t('common.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{t('settingsAccount.title')}</Text>
      <Text style={styles.label}>{t('settingsAccount.name')}</Text>
      <TextInput
        style={styles.input}
        value={account.name}
        onChangeText={onNameChange}
        placeholderTextColor={tk.text.tertiary}
      />
      <Text style={styles.label}>{t('settingsAccount.email')}</Text>
      <TextInput
        style={styles.input}
        value={account.email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor={tk.text.tertiary}
      />
      <Text style={styles.label}>{t('settingsAccount.phone')}</Text>
      <TextInput
        style={styles.input}
        value={account.phone}
        onChangeText={onPhoneChange}
        keyboardType="phone-pad"
        placeholderTextColor={tk.text.tertiary}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {toast ? <Text style={styles.toast}>{toast}</Text> : null}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.btnDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={tk.surface.light} />
        ) : (
          <Text style={styles.saveText}>{t('settingsAccount.save')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
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
    back: { fontSize: 16, color: tk.text.secondary },
    title: {
      marginTop: 8,
      fontSize: 22,
      fontWeight: '700',
      color: tk.text.primary,
      marginBottom: 8,
    },
    label: { marginTop: 12, fontSize: 14, color: tk.text.secondary },
    input: {
      marginTop: 8,
      paddingHorizontal: 12,
      height: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: '#f5f5f5',
      fontSize: 16,
      color: tk.text.primary,
    },
    error: { marginTop: 12, fontSize: 14, color: tk.danger.DEFAULT },
    toast: { marginTop: 12, fontSize: 14, color: tk.success.DEFAULT },
    saveBtn: {
      marginTop: 16,
      height: 50,
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    saveText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14 },
    muted: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
  })
}
