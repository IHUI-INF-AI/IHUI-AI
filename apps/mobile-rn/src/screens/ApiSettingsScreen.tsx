/**
 * API 设置页 — mobile-rn 端(2026-07-24 立)
 * 配置 Coze 平台连接:PAT/API Key、Base URL、默认 bot_id、超时。
 * 参考 miniapp-taro 的 about/api-settings + mobile-rn SettingsAccountScreen 风格。
 */
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { Loading } from '@ihui/ui-native'
import type { RootStackParamList } from '../navigation/RootNavigator'
import {
  COZE_DEFAULT_BASE_URL, COZE_DEFAULT_TIMEOUT, clearCozeConfig,
  loadCozeConfig, saveCozeConfig, testConnection, type CozeConfig,
} from '../api/coze'

type Nav = NativeStackNavigationProp<RootStackParamList>
type TestState = 'idle' | 'testing' | 'success' | 'failed'

export function ApiSettingsScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])
  const [config, setConfig] = useState<CozeConfig>({ token: '', baseUrl: COZE_DEFAULT_BASE_URL, botId: '', timeout: COZE_DEFAULT_TIMEOUT })
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<TestState>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try { setConfig(await loadCozeConfig()) } catch { /* 默认值已初始化 */ } finally { setLoading(false) }
    })()
  }, [])

  const save = useCallback(async () => {
    if (!config.token.trim()) { setToast(tt('apiSettings.tokenRequired', '请先填写 API 令牌')); return }
    setSaving(true); setToast('')
    try { await saveCozeConfig(config); setToast(tt('apiSettings.saved', '保存成功')) }
    catch { setToast(tt('apiSettings.saveFailed', '保存失败')) }
    finally { setSaving(false) }
  }, [config, tt])

  const reset = useCallback(async () => {
    await clearCozeConfig()
    setConfig({ token: '', baseUrl: COZE_DEFAULT_BASE_URL, botId: '', timeout: COZE_DEFAULT_TIMEOUT })
    setToast(tt('apiSettings.reset', '已重置为默认值')); setTesting('idle'); setTestMsg('')
  }, [tt])

  const test = useCallback(async () => {
    setTesting('testing'); setTestMsg('')
    try {
      await saveCozeConfig(config)
      const r = await testConnection()
      setTesting(r.ok ? 'success' : 'failed'); setTestMsg(r.message)
    } catch (e) {
      setTesting('failed'); setTestMsg(e instanceof Error ? e.message : '测试失败')
    }
  }, [config])

  if (loading) {
    return (<View style={s.center}><Loading /><Text style={s.muted}>{tt('common.loading', '加载中...')}</Text></View>)
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={s.back}>{tt('common.back', '返回')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{tt('apiSettings.title', 'API 设置')}</Text>
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>{tt('apiSettings.cozeTitle', 'Coze API 配置')}</Text>

        <Text style={s.label}>{tt('apiSettings.apiToken', 'API 令牌 (PAT)')}</Text>
        <View style={s.inputRow}>
          <TextInput
            style={[s.input, s.inputFlex]} value={config.token} secureTextEntry={!showToken}
            placeholder={tt('apiSettings.tokenPlaceholder', '请输入 Coze API 令牌')}
            placeholderTextColor="#9CA3AF" autoCapitalize="none" autoCorrect={false}
            onChangeText={(v) => setConfig({ ...config, token: v })}
          />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowToken((p) => !p)} accessibilityRole="button">
            <Text style={s.eyeText}>{showToken ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>{tt('apiSettings.baseUrl', 'Base URL')}</Text>
        <TextInput
          style={s.input} value={config.baseUrl} placeholder={COZE_DEFAULT_BASE_URL}
          placeholderTextColor="#9CA3AF" autoCapitalize="none" autoCorrect={false} keyboardType="url"
          onChangeText={(v) => setConfig({ ...config, baseUrl: v })}
        />

        <Text style={s.label}>{tt('apiSettings.botId', '默认 Bot ID')}</Text>
        <TextInput
          style={s.input} value={config.botId}
          placeholder={tt('apiSettings.botIdPlaceholder', '可选,默认对话使用的 Bot ID')}
          placeholderTextColor="#9CA3AF" autoCapitalize="none" autoCorrect={false}
          onChangeText={(v) => setConfig({ ...config, botId: v })}
        />

        <Text style={s.label}>{tt('apiSettings.timeout', '超时 (毫秒)')}</Text>
        <TextInput
          style={s.input} value={String(config.timeout)} placeholder={String(COZE_DEFAULT_TIMEOUT)}
          placeholderTextColor="#9CA3AF" keyboardType="numeric"
          onChangeText={(v) => setConfig({ ...config, timeout: Number(v) || 0 })}
        />

        <Text style={s.hint}>{tt('apiSettings.tokenHint', '提示:可从 Coze 平台 → 个人中心 → API 令牌获取 PAT')}</Text>
      </View>

      <View style={s.btnRow}>
        <TouchableOpacity style={[s.btn, s.btnPrimary, saving && s.btnDisabled]} onPress={save} disabled={saving} accessibilityRole="button">
          {saving ? <Loading color="#FFFFFF" /> : <Text style={s.btnTextPrimary}>{tt('apiSettings.save', '保存设置')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={reset} accessibilityRole="button">
          <Text style={s.btnTextGhost}>{tt('apiSettings.reset', '重置默认')}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        <Text style={s.sectionTitle}>{tt('apiSettings.diagnoseTitle', '连通性测试')}</Text>
        <View style={s.testRow}>
          <Text style={s.testLabel}>{tt('apiSettings.diagnose', 'API 连通性')}</Text>
          <TouchableOpacity
            style={[s.testBtn, testing === 'testing' && s.testBtnRunning]}
            onPress={test} disabled={testing === 'testing'} accessibilityRole="button"
          >
            <Text style={s.testBtnText}>
              {testing === 'testing' ? tt('common.loading', '检测中...') : tt('apiSettings.test', '测试连接')}
            </Text>
          </TouchableOpacity>
        </View>
        {testing === 'success' ? <Text style={s.statusOk}>✓ {testMsg || tt('apiSettings.testSuccess', '连接成功')}</Text> : null}
        {testing === 'failed' ? <Text style={s.statusErr}>✗ {testMsg || tt('apiSettings.testFailed', '连接失败')}</Text> : null}
      </View>

      {toast ? <Text style={s.toast}>{toast}</Text> : null}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  back: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  card: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 12 },
  label: { fontSize: 12, color: '#6B7280', marginTop: 8, marginBottom: 4 },
  input: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', fontSize: 13, color: '#111827' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputFlex: { flex: 1 },
  eyeBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  eyeText: { fontSize: 14 },
  hint: { fontSize: 11, color: '#9CA3AF', marginTop: 12 },
  btnRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#10B981' },
  btnGhost: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  btnDisabled: { opacity: 0.6 },
  btnTextPrimary: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  btnTextGhost: { color: '#374151', fontSize: 14, fontWeight: '600' },
  testRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  testLabel: { fontSize: 13, color: '#374151' },
  testBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#111827' },
  testBtnRunning: { opacity: 0.6 },
  testBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  statusOk: { fontSize: 12, color: '#10B981', marginTop: 8 },
  statusErr: { fontSize: 12, color: '#DC2626', marginTop: 8 },
  toast: { fontSize: 12, color: '#10B981', textAlign: 'center', marginTop: 4 },
  muted: { fontSize: 12, color: '#6B7280', marginTop: 8 },
})
