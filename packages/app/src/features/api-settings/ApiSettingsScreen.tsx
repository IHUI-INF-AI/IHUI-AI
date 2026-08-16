import { useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  ApiSettingsConfig,
  ApiSettingsScreenProps,
  ApiSettingsTestState,
} from '../../types'

/** API 设置共享屏 — props 注入式跨端组件 */
export type { ApiSettingsConfig, ApiSettingsScreenProps, ApiSettingsTestState }

export function ApiSettingsScreen({
  t,
  config,
  showToken,
  saving,
  testing,
  testMsg,
  toast,
  loading,
  defaultBaseUrl,
  defaultTimeout,
  onConfigChange,
  onToggleShowToken,
  onSave,
  onReset,
  onTest,
  onBack,
  colorScheme = 'light',
}: ApiSettingsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('apiSettings.title')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('apiSettings.cozeTitle')}</Text>

        <Text style={styles.label}>{t('apiSettings.apiToken')}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputFlex]}
            value={config.token}
            secureTextEntry={!showToken}
            placeholder={t('apiSettings.tokenPlaceholder')}
            placeholderTextColor={tk.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(v) => onConfigChange({ token: v })}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={onToggleShowToken}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={styles.eyeText}>{showToken ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{t('apiSettings.baseUrl')}</Text>
        <TextInput
          style={styles.input}
          value={config.baseUrl}
          placeholder={defaultBaseUrl}
          placeholderTextColor={tk.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={(v) => onConfigChange({ baseUrl: v })}
        />

        <Text style={styles.label}>{t('apiSettings.botId')}</Text>
        <TextInput
          style={styles.input}
          value={config.botId}
          placeholder={t('apiSettings.botIdPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={(v) => onConfigChange({ botId: v })}
        />

        <Text style={styles.label}>{t('apiSettings.timeout')}</Text>
        <TextInput
          style={styles.input}
          value={String(config.timeout)}
          placeholder={String(defaultTimeout)}
          placeholderTextColor={tk.text.tertiary}
          keyboardType="numeric"
          onChangeText={(v) => onConfigChange({ timeout: Number(v) || 0 })}
        />

        <Text style={styles.hint}>{t('apiSettings.tokenHint')}</Text>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]}
          onPress={onSave}
          disabled={saving}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={styles.btnTextPrimary}>
            {saving ? t('common.loading') : t('apiSettings.save')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnGhost]}
          onPress={onReset}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Text style={styles.btnTextGhost}>{t('apiSettings.reset')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('apiSettings.diagnoseTitle')}</Text>
        <View style={styles.testRow}>
          <Text style={styles.testLabel}>{t('apiSettings.diagnose')}</Text>
          <TouchableOpacity
            style={[styles.testBtn, testing === 'testing' && styles.testBtnRunning]}
            onPress={onTest}
            disabled={testing === 'testing'}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={styles.testBtnText}>
              {testing === 'testing'
                ? t('common.loading')
                : t('apiSettings.test')}
            </Text>
          </TouchableOpacity>
        </View>
        {testing === 'success' ? (
          <Text style={styles.statusOk}>
            ✓ {testMsg || t('apiSettings.testSuccess')}
          </Text>
        ) : null}
        {testing === 'failed' ? (
          <Text style={styles.statusErr}>
            ✗ {testMsg || t('apiSettings.testFailed')}
          </Text>
        ) : null}
      </View>

      {toast ? <Text style={styles.toast}>{toast}</Text> : null}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    content: { padding: 14, paddingBottom: 32 },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      backgroundColor: tk.surface.bg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    back: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: tk.text.primary,
      marginBottom: 12,
    },
    label: {
      fontSize: 14,
      color: tk.text.secondary,
      marginTop: 8,
      marginBottom: 8,
    },
    input: {
      paddingHorizontal: 12,
      height: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: '#f5f5f5',
      fontSize: 14,
      color: tk.text.primary,
    },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    inputFlex: { flex: 1 },
    eyeBtn: {
      paddingHorizontal: 12,
      height: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: '#f5f5f5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyeText: { fontSize: 16 },
    hint: { fontSize: 11, color: tk.text.tertiary, marginTop: 12 },
    btnRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    btn: { flex: 1, height: 50, justifyContent: 'center', borderRadius: 12, alignItems: 'center' },
    btnPrimary: { backgroundColor: tk.brand.DEFAULT },
    btnGhost: {
      backgroundColor: tk.surface.bg,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    btnDisabled: { opacity: 0.6 },
    btnTextPrimary: { color: tk.surface.light, fontSize: 16, fontWeight: '600' },
    btnTextGhost: { color: tk.text.medium, fontSize: 16, fontWeight: '600' },
    testRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    testLabel: { fontSize: 14, color: tk.text.medium },
    testBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: tk.text.primary,
    },
    testBtnRunning: { opacity: 0.6 },
    testBtnText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    statusOk: { fontSize: 14, color: tk.success.DEFAULT, marginTop: 8 },
    statusErr: { fontSize: 14, color: tk.danger.DEFAULT, marginTop: 8 },
    toast: {
      fontSize: 14,
      color: tk.success.DEFAULT,
      textAlign: 'center',
      marginTop: 8,
    },
    muted: { fontSize: 14, color: tk.text.secondary, marginTop: 8 },
  })
}
