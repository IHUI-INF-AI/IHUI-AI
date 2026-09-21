// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { BASE_URL } from '@/utils/api-config'
import { get, post } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'

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
    <ThemeRoot>
      <View className="min-h-screen bg-background px-[28rpx] pt-[28rpx] pb-[64rpx]">
        <View className="bg-card rounded-[24rpx] border border-border p-[28rpx] mb-[24rpx] overflow-hidden">
          <View
            className="flex justify-between items-center py-[16rpx]"
            onClick={() => copy(BASE_URL)}
            hoverClass="opacity-60"
          >
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('about.apiSettings.apiUrl', 'API 地址')}
            </Text>
            <Text className="text-[28rpx] text-foreground max-w-[60%] text-right break-all">
              {BASE_URL}
            </Text>
          </View>
          <View className="flex justify-between items-center py-[16rpx]">
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('about.apiSettings.apiVersion', 'API 版本')}
            </Text>
            <Text className="text-[28rpx] text-foreground max-w-[60%] text-right break-all">
              {config.version}
            </Text>
          </View>
          <View className="flex justify-between items-center py-[16rpx]">
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('about.apiSettings.environment', '运行环境')}
            </Text>
            <Text className="text-[28rpx] text-foreground max-w-[60%] text-right break-all">
              {config.environment}
            </Text>
          </View>
          <View className="flex justify-between items-center py-[16rpx]">
            <Text className="text-[28rpx] text-muted-foreground">
              {tt('about.apiSettings.timeout', '请求超时')}
            </Text>
            <Text className="text-[28rpx] text-foreground max-w-[60%] text-right break-all">
              {config.timeout}
            </Text>
          </View>
        </View>

        <View className="bg-card rounded-[24rpx] border border-border p-[28rpx] mb-[24rpx] overflow-hidden">
          <Text className="block text-[32rpx] font-semibold text-foreground mb-[24rpx]">
            {tt('about.apiSettings.cozeTitle', 'Coze API 配置')}
          </Text>
          <Text className="block text-[28rpx] text-muted-foreground mt-[16rpx] mb-[16rpx]">
            {tt('about.apiSettings.apiToken', 'API 令牌(Token)')}
          </Text>
          <View className="flex items-center gap-[16rpx]">
            <Input
              className="flex-1 h-[100rpx] px-[24rpx] box-border bg-muted border-[2rpx] border-border rounded-[24rpx] text-[28rpx] text-foreground"
              type="text"
              password={!showToken}
              value={apiToken}
              placeholder={tt('about.apiSettings.tokenPlaceholder', '请输入您的 Coze API 令牌')}
              onInput={(e) => setApiToken(e.detail.value)}
            />
            <View
              className="h-[100rpx] px-[24rpx] box-border bg-muted border-[2rpx] border-border rounded-[24rpx] flex items-center justify-center"
              onClick={toggleToken}
              hoverClass="opacity-60"
            >
              <LineIcon
                name={showToken ? 'eye-off' : 'eye'}
                size={32}
                color="var(--color-text-medium)"
              />
            </View>
          </View>
          <Text className="block text-[28rpx] text-muted-foreground mt-[16rpx] mb-[16rpx]">
            {tt('about.apiSettings.workflowId', '工作流 ID(Workflow ID)')}
          </Text>
          <Input
            className="w-full h-[100rpx] px-[24rpx] box-border bg-muted border-[2rpx] border-border rounded-[24rpx] text-[28rpx] text-foreground"
            type="text"
            value={workflowId}
            placeholder={tt('about.apiSettings.workflowPlaceholder', '请输入工作流 ID')}
            onInput={(e) => setWorkflowId(e.detail.value)}
          />
          <Text className="block text-[22rpx] text-[var(--color-text-tertiary)] mt-[24rpx]">
            {tt('about.apiSettings.tokenHint', '提示:您可以从 Coze 平台获取 API 令牌和工作流 ID')}
          </Text>
        </View>

        <View className="flex gap-[24rpx] mb-[24rpx]">
          <Button
            className="flex-1 text-[32rpx] font-semibold h-[100rpx] leading-[100rpx] rounded-[24rpx] m-0 p-0 after:border-0 bg-primary text-[var(--color-primary-foreground)]"
            onClick={save}
          >
            {tt('about.apiSettings.saveBtn', '保存设置')}
          </Button>
          <Button
            className="flex-1 text-[32rpx] font-semibold h-[100rpx] leading-[100rpx] rounded-[24rpx] m-0 p-0 after:border-0 bg-background border-[2rpx] border-border text-[var(--color-text-medium)]"
            onClick={reset}
          >
            {tt('about.apiSettings.resetBtn', '重置默认')}
          </Button>
        </View>

        <View className="bg-card rounded-[24rpx] border border-border p-[28rpx] overflow-hidden">
          <Text className="block text-[32rpx] font-semibold text-foreground mb-[24rpx]">
            {tt('about.apiSettings.diagnoseTitle', '网络诊断')}
          </Text>
          <View className="flex items-center justify-between">
            <Text className="text-[28rpx] text-[var(--color-text-medium)]">
              {tt('about.apiSettings.diagnose', 'API 连通性测试')}
            </Text>
            <Button
              className="text-[28rpx] font-semibold h-[64rpx] leading-[64rpx] px-[20rpx] py-0 bg-foreground text-background rounded-[24rpx] m-0 after:border-0 disabled:opacity-60"
              disabled={testing === 'testing'}
              onClick={testConnection}
            >
              {testing === 'testing'
                ? tt('common.loading', '检测中...')
                : tt('about.apiSettings.test', '测试连接')}
            </Button>
          </View>
          {testing === 'success' ? (
            <Text className="block mt-[16rpx] text-[28rpx] text-success">
              {tt('about.apiSettings.testSuccess', '连接成功')}
            </Text>
          ) : null}
          {testing === 'failed' ? (
            <Text className="block mt-[16rpx] text-[28rpx] text-destructive">
              {tt('about.apiSettings.testFailed', '连接失败,请检查配置')}
            </Text>
          ) : null}
        </View>

        <View className="text-center pt-[16rpx]">
          <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
            {tt('about.apiSettings.footer', '以上为当前 API 配置信息')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
