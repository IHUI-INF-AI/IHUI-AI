import { logger } from '@/utils/logger'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { BASE_URL } from '@/utils/request'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface ApiConfig {
  version: string
  environment: string
  timeout: string
}

const STORAGE_TOKEN_KEY = 'coze_token'
const STORAGE_WORKFLOW_KEY = 'coze_workflow_id'
const DEFAULT_TIMEOUT = '15000ms'

type TestState = 'idle' | 'testing' | 'success' | 'failed'

export default function ApiSettings() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [config, setConfig] = useState<ApiConfig>({
    version: '-',
    environment: '-',
    timeout: DEFAULT_TIMEOUT,
  })
  const [apiToken, setApiToken] = useState('')
  const [workflowId, setWorkflowId] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState<TestState>('idle')

  const load = useCallback(async () => {
    try {
      const res = await get<ApiConfig>('/about/api-config')
      if (res) setConfig(res)
    } catch (e) {
      logger.error('about/api-settings', '获取 API 配置', e)
    }
    const savedToken = Taro.getStorageSync(STORAGE_TOKEN_KEY) || ''
    const savedWorkflow = Taro.getStorageSync(STORAGE_WORKFLOW_KEY) || ''
    setApiToken(savedToken)
    setWorkflowId(savedWorkflow)
  }, [])

  const copy = useCallback((text: string) => {
    Taro.setClipboardData({ data: text })
    Taro.showToast({ title: tt('about.apiSettings.copied', '已复制'), icon: 'none' })
  }, [tt])

  const toggleToken = useCallback(() => {
    setShowToken((prev) => !prev)
  }, [])

  const save = useCallback(() => {
    if (!apiToken || !workflowId) {
      Taro.showToast({
        title: tt('about.apiSettings.requiredTip', '请填写完整的 API 配置'),
        icon: 'none',
      })
      return
    }
    Taro.setStorageSync(STORAGE_TOKEN_KEY, apiToken)
    Taro.setStorageSync(STORAGE_WORKFLOW_KEY, workflowId)
    Taro.showToast({
      title: tt('about.apiSettings.savedTip', '保存成功'),
      icon: 'success',
    })
  }, [apiToken, workflowId, tt])

  const reset = useCallback(() => {
    setApiToken('')
    setWorkflowId('')
    Taro.removeStorageSync(STORAGE_TOKEN_KEY)
    Taro.removeStorageSync(STORAGE_WORKFLOW_KEY)
    Taro.showToast({
      title: tt('about.apiSettings.resetTip', '已重置为默认值'),
      icon: 'none',
    })
  }, [tt])

  const testConnection = useCallback(async () => {
    setTesting('testing')
    try {
      const res = await post<{ ok?: boolean; version?: string }>('/about/api-test', {
        token: apiToken,
        workflowId,
      })
      if (res && (res.ok || res.version)) {
        setTesting('success')
        Taro.showToast({
          title: tt('about.apiSettings.testSuccess', '连接成功'),
          icon: 'success',
        })
      } else {
        setTesting('failed')
      }
    } catch (e) {
      logger.error('about/api-settings', '测试连接', e)
      setTesting('failed')
      Taro.showToast({
        title: tt('about.apiSettings.testFailed', '连接失败'),
        icon: 'none',
      })
    }
  }, [apiToken, workflowId, tt])

  useDidShow(() => load())

  return (
    <View className="page">
      <View className="card">
        <View className="row" onClick={() => copy(BASE_URL)}>
          <Text className="label">{tt('about.apiSettings.apiUrl', 'API 地址')}</Text>
          <Text className="value link">{BASE_URL}</Text>
        </View>
        <View className="row">
          <Text className="label">{tt('about.apiSettings.apiVersion', 'API 版本')}</Text>
          <Text className="value">{config.version}</Text>
        </View>
        <View className="row">
          <Text className="label">{tt('about.apiSettings.environment', '运行环境')}</Text>
          <Text className="value">{config.environment}</Text>
        </View>
        <View className="row last">
          <Text className="label">{tt('about.apiSettings.timeout', '请求超时')}</Text>
          <Text className="value">{config.timeout}</Text>
        </View>
      </View>

      <View className="card">
        <Text className="section-title">
          {tt('about.apiSettings.cozeTitle', 'Coze API 配置')}
        </Text>
        <View className="input-group">
          <Text className="input-label">
            {tt('about.apiSettings.apiToken', 'API 令牌(Token)')}
          </Text>
          <View className="input-wrap">
            <Input
              className="input"
              type="text"
              password={!showToken}
              value={apiToken}
              placeholder={tt('about.apiSettings.tokenPlaceholder', '请输入您的 Coze API 令牌')}
              onInput={(e) => setApiToken(e.detail.value)}
            />
            <View className="input-action" onClick={toggleToken}>
              <Text>{showToken ? '🙈' : '👁'}</Text>
            </View>
          </View>
        </View>
        <View className="input-group">
          <Text className="input-label">
            {tt('about.apiSettings.workflowId', '工作流 ID(Workflow ID)')}
          </Text>
          <Input
            className="input full"
            type="text"
            value={workflowId}
            placeholder={tt('about.apiSettings.workflowPlaceholder', '请输入工作流 ID')}
            onInput={(e) => setWorkflowId(e.detail.value)}
          />
        </View>
        <Text className="hint">
          {tt(
            'about.apiSettings.tokenHint',
            '提示:您可以从 Coze 平台获取 API 令牌和工作流 ID',
          )}
        </Text>
        <View className="btn-row">
          <Button className="btn btn-primary" onClick={save}>
            {tt('about.apiSettings.saveBtn', '保存设置')}
          </Button>
          <Button className="btn btn-ghost" onClick={reset}>
            {tt('about.apiSettings.resetBtn', '重置默认')}
          </Button>
        </View>
      </View>

      <View className="card">
        <Text className="section-title">
          {tt('about.apiSettings.diagnoseTitle', '网络诊断')}
        </Text>
        <View className="test-row">
          <Text className="test-label">
            {tt('about.apiSettings.diagnose', 'API 连通性测试')}
          </Text>
          <Button
            className={`test-btn test-btn-${testing}`}
            disabled={testing === 'testing'}
            onClick={testConnection}
          >
            {testing === 'testing'
              ? tt('common.loading', '检测中...')
              : tt('about.apiSettings.test', '测试连接')}
          </Button>
        </View>
        {testing === 'success' ? (
          <Text className="test-status status-success">
            {tt('about.apiSettings.testSuccess', '连接成功')}
          </Text>
        ) : null}
        {testing === 'failed' ? (
          <Text className="test-status status-failed">
            {tt('about.apiSettings.testFailed', '连接失败,请检查配置')}
          </Text>
        ) : null}
      </View>

      <View className="tips">
        <Text>{tt('about.apiSettings.footer', '以上为当前 API 配置信息')}</Text>
      </View>
    </View>
  )
}
