/**
 * API 设置页 — mobile-rn wrapper(2026-07-29 重构为 shared component)
 * 配置 Coze 平台连接:PAT/API Key、Base URL、默认 bot_id、超时。
 * 平台逻辑(load/save/reset/test)留 wrapper,UI 交 SharedApiSettingsScreen。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  ApiSettingsScreen as SharedApiSettingsScreen,
  type ApiSettingsConfig,
  type ApiSettingsTestState,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import {
  COZE_DEFAULT_BASE_URL,
  COZE_DEFAULT_TIMEOUT,
  clearCozeConfig,
  loadCozeConfig,
  saveCozeConfig,
  testConnection,
} from '../api/coze'

type Nav = NativeStackNavigationProp<RootStackParamList>

export function ApiSettingsScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const [config, setConfig] = useState<ApiSettingsConfig>({
    token: '',
    baseUrl: COZE_DEFAULT_BASE_URL,
    botId: '',
    timeout: COZE_DEFAULT_TIMEOUT,
  })
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<ApiSettingsTestState>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        setConfig(await loadCozeConfig())
      } catch {
        /* 默认值已初始化 */
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleConfigChange = useCallback((patch: Partial<ApiSettingsConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  const save = useCallback(async () => {
    if (!config.token.trim()) {
      setToast(t('apiSettings.tokenRequired'))
      return
    }
    setSaving(true)
    setToast('')
    try {
      await saveCozeConfig(config)
      setToast(t('apiSettings.saved'))
    } catch {
      setToast(t('apiSettings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }, [config, t])

  const reset = useCallback(async () => {
    await clearCozeConfig()
    setConfig({
      token: '',
      baseUrl: COZE_DEFAULT_BASE_URL,
      botId: '',
      timeout: COZE_DEFAULT_TIMEOUT,
    })
    setToast(t('apiSettings.resetDone'))
    setTesting('idle')
    setTestMsg('')
  }, [t])

  const test = useCallback(async () => {
    setTesting('testing')
    setTestMsg('')
    try {
      await saveCozeConfig(config)
      const r = await testConnection()
      setTesting(r.ok ? 'success' : 'failed')
      setTestMsg(r.message)
    } catch (e) {
      setTesting('failed')
      setTestMsg(e instanceof Error ? e.message : t('apiSettings.testFailed'))
    }
  }, [config, t])

  return (
    <SharedApiSettingsScreen
      t={t}
      config={config}
      showToken={showToken}
      saving={saving}
      testing={testing}
      testMsg={testMsg}
      toast={toast}
      loading={loading}
      defaultBaseUrl={COZE_DEFAULT_BASE_URL}
      defaultTimeout={COZE_DEFAULT_TIMEOUT}
      onConfigChange={handleConfigChange}
      onToggleShowToken={() => setShowToken((p) => !p)}
      onSave={save}
      onReset={reset}
      onTest={test}
      onBack={() => navigation.goBack()}
    />
  )
}
