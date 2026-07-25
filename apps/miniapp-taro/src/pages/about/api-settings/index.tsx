import { logger } from '@/utils/logger'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { BASE_URL } from '@/utils/api-config'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'

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

  const copy = useCallback(
    (text: string) => {
      Taro.setClipboardData({ data: text })
      Taro.showToast({ title: tt('about.apiSettings.copied', '已复制'), icon: 'none' })
    },
    [tt],
  )

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
    <View className="min-h-screen bg-background pb-[60rpx]">
      <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
        <View
          className="flex justify-between items-center p-[32rpx]"
          onClick={() => copy(BASE_URL)}
        >
          <Text className="text-[28rpx] text-foreground">
            {tt('about.apiSettings.apiUrl', 'API 地址')}
          </Text>
          <Text className="text-[26rpx] text-primary max-w-[60%] text-right break-all">
            {BASE_URL}
          </Text>
        </View>
        <View className="flex justify-between items-center p-[32rpx] mt-[16rpx]">
          <Text className="text-[28rpx] text-foreground">
            {tt('about.apiSettings.apiVersion', 'API 版本')}
          </Text>
          <Text className="text-[26rpx] text-muted-foreground max-w-[60%] text-right break-all">
            {config.version}
          </Text>
        </View>
        <View className="flex justify-between items-center p-[32rpx] mt-[16rpx]">
          <Text className="text-[28rpx] text-foreground">
            {tt('about.apiSettings.environment', '运行环境')}
          </Text>
          <Text className="text-[26rpx] text-muted-foreground max-w-[60%] text-right break-all">
            {config.environment}
          </Text>
        </View>
        <View className="flex justify-between items-center p-[32rpx] mt-[16rpx]">
          <Text className="text-[28rpx] text-foreground">
            {tt('about.apiSettings.timeout', '请求超时')}
          </Text>
          <Text className="text-[26rpx] text-muted-foreground max-w-[60%] text-right break-all">
            {config.timeout}
          </Text>
        </View>
      </View>

      <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
        <Text className="block text-[30rpx] font-semibold text-foreground pt-[32rpx] px-[32rpx] pb-[16rpx]">
          {tt('about.apiSettings.cozeTitle', 'Coze API 配置')}
        </Text>
        <View className="py-[16rpx] px-[32rpx]">
          <Text className="block text-[26rpx] text-muted-foreground mb-[12rpx]">
            {tt('about.apiSettings.apiToken', 'API 令牌(Token)')}
          </Text>
          <View className="relative flex items-center">
            <Input
              className="flex-1 h-[80rpx] pr-[80rpx] pl-[20rpx] box-border bg-background border-[2rpx] border-border rounded-[8rpx] text-[26rpx] text-foreground"
              type="text"
              password={!showToken}
              value={apiToken}
              placeholder={tt('about.apiSettings.tokenPlaceholder', '请输入您的 Coze API 令牌')}
              onInput={(e) => setApiToken(e.detail.value)}
            />
            <View
              className="absolute right-[20rpx] top-1/2 -translate-y-1/2 w-[60rpx] h-[60rpx] flex items-center justify-center text-[32rpx]"
              onClick={toggleToken}
            >
              <Text>{showToken ? '🙈' : '👁'}</Text>
            </View>
          </View>
        </View>
        <View className="py-[16rpx] px-[32rpx]">
          <Text className="block text-[26rpx] text-muted-foreground mb-[12rpx]">
            {tt('about.apiSettings.workflowId', '工作流 ID(Workflow ID)')}
          </Text>
          <Input
            className="flex-1 h-[80rpx] px-[20rpx] box-border bg-background border-[2rpx] border-border rounded-[8rpx] text-[26rpx] text-foreground"
            type="text"
            value={workflowId}
            placeholder={tt('about.apiSettings.workflowPlaceholder', '请输入工作流 ID')}
            onInput={(e) => setWorkflowId(e.detail.value)}
          />
        </View>
        <Text className="block py-[16rpx] px-[32rpx] text-[22rpx] text-muted-foreground leading-[1.6]">
          {tt('about.apiSettings.tokenHint', '提示:您可以从 Coze 平台获取 API 令牌和工作流 ID')}
        </Text>
        <View className="flex gap-[16rpx] pt-[16rpx] px-[32rpx] pb-[32rpx]">
          <Button
            className="flex-1 text-[28rpx] h-[80rpx] leading-[80rpx] rounded-[8rpx] m-0 p-0 btn-primary"
            onClick={save}
          >
            {tt('about.apiSettings.saveBtn', '保存设置')}
          </Button>
          <Button
            className="flex-1 text-[28rpx] h-[80rpx] leading-[80rpx] rounded-[8rpx] m-0 p-0 btn-ghost"
            onClick={reset}
          >
            {tt('about.apiSettings.resetBtn', '重置默认')}
          </Button>
        </View>
      </View>

      <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
        <Text className="block text-[30rpx] font-semibold text-foreground pt-[32rpx] px-[32rpx] pb-[16rpx]">
          {tt('about.apiSettings.diagnoseTitle', '网络诊断')}
        </Text>
        <View className="flex items-center justify-between py-[24rpx] px-[32rpx]">
          <Text className="text-[28rpx] text-foreground">
            {tt('about.apiSettings.diagnose', 'API 连通性测试')}
          </Text>
          <Button
            className="text-[26rpx] h-[64rpx] leading-[64rpx] px-[32rpx] bg-primary text-white rounded-[8rpx] m-0 disabled:opacity-60"
            disabled={testing === 'testing'}
            onClick={testConnection}
          >
            {testing === 'testing'
              ? tt('common.loading', '检测中...')
              : tt('about.apiSettings.test', '测试连接')}
          </Button>
        </View>
        {testing === 'success' ? (
          <Text className="block px-[32rpx] pb-[24rpx] text-[24rpx] text-[#10b981]">
            {tt('about.apiSettings.testSuccess', '连接成功')}
          </Text>
        ) : null}
        {testing === 'failed' ? (
          <Text className="block px-[32rpx] pb-[24rpx] text-[24rpx] text-[#ef4444]">
            {tt('about.apiSettings.testFailed', '连接失败,请检查配置')}
          </Text>
        ) : null}
      </View>

      <View className="text-center p-[32rpx]">
        <Text className="text-[22rpx] text-muted-foreground">
          {tt('about.apiSettings.footer', '以上为当前 API 配置信息')}
        </Text>
      </View>
    </View>
  )
}
