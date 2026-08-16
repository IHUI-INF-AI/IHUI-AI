import { useMemo } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AgentSettingScreenProps } from '../../types'

/** Agent 设置共享屏 — props 注入式跨端组件(表单,状态由 wrapper 管理) */
export type { AgentSettingScreenProps }

export function AgentSettingScreen({
  t,
  setting,
  loading,
  saving,
  error,
  toast,
  onChange,
  onSave,
  onBack,
  colorScheme = 'light',
}: AgentSettingScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading || !setting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tk.brand.DEFAULT} />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('agentSetting.title')}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{t('agentSetting.name')}</Text>
        <TextInput
          style={styles.input}
          value={setting.name}
          onChangeText={(v) => onChange({ name: v })}
          placeholderTextColor={tk.text.tertiary}
        />
        <Text style={styles.label}>{t('agentSetting.model')}</Text>
        <TextInput
          style={styles.input}
          value={setting.model}
          onChangeText={(v) => onChange({ model: v })}
          placeholderTextColor={tk.text.tertiary}
        />
        <Text style={styles.label}>
          {t('agentSetting.temperature')}: {setting.temperature.toFixed(2)}
        </Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={String(setting.temperature)}
          onChangeText={(v) => onChange({ temperature: Number(v) || 0 })}
          placeholderTextColor={tk.text.tertiary}
        />
        <View style={styles.switchRow}>
          <Text style={styles.label}>{t('agentSetting.enabled')}</Text>
          <Switch
            value={setting.enabled}
            onValueChange={(v) => onChange({ enabled: v })}
            thumbColor={tk.brand.DEFAULT}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {toast ? <Text style={styles.toast}>{toast}</Text> : null}
        <TouchableOpacity
          style={[styles.saveBtn, saving ? styles.saveBtnDisabled : null]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? t('common.loading') : t('agentSetting.save')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    body: { padding: 14 },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    label: { marginTop: 8, fontSize: 14, color: tk.text.secondary },
    input: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: tk.text.primary,
      backgroundColor: '#f5f5f5',
    },
    switchRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    error: { marginTop: 8, fontSize: 14, color: tk.error.text },
    toast: { marginTop: 8, fontSize: 14, color: tk.brand.DEFAULT },
    saveBtn: {
      marginTop: 16,
      height: 50,
      borderRadius: 12,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: tk.surface.bg,
    },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
  })
}
