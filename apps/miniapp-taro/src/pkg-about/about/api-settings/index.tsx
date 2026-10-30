// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 镜像 packages/app/src/features/api-settings/ApiSettingsScreen.tsx

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useUiField } from '@/lib/ui-field-registry'
import { BASE_URL } from '@/utils/api-config'
import { get, post } from '@/api'
import { COZE_DEFAULT_BASE_URL, COZE_DEFAULT_TIMEOUT } from '@ihui/shared/constants'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon from '@/components/LineIcon'

interface ApiConfig {
  version: string
  environment: string
  timeout: string
}

const STORAGE_TOKEN_KEY = 'coze_token'
const STORAGE_WORKFLOW_KEY = 'coze_workflow_id'
const STORAGE_BASE_URL_KEY = 'coze_base_url'
const STORAGE_BOT_ID_KEY = 'coze_bot_id'
const STORAGE_TIMEOUT_KEY = 'coze_timeout'
/** 超时字段的默认展示值:与共享屏同一常量源(@ihui/shared/constants),端内不另写一份 */
const DEFAULT_TIMEOUT_TEXT = String(COZE_DEFAULT_TIMEOUT)

/** 配置项标签与输入框样式:与共享屏 card 内 label/input 同一视觉层级,四处字段共用一份 */
const LABEL_CLS = 'block text-[length:28rpx] text-muted-foreground mt-[16rpx] mb-[16rpx]'
const FIELD_BASE =
  'h-[100rpx] px-[24rpx] box-border bg-muted border-[length:2rpx] border-border rounded-sm text-[length:28rpx] text-foreground'
const FIELD_FULL = `w-full ${FIELD_BASE}`

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
    timeout: '-',
  })
  const [apiToken, setApiToken] = useState('')
  const [workflowId, setWorkflowId] = useState('')
  // 共享屏 Coze 配置的三项(接口地址 / Bot ID / 超时):本页原先只有令牌与工作流 ID,
  // 这三项按共享屏同一信息结构补齐,同样落本地存储,重置回默认值。
  const [baseUrl, setBaseUrl] = useState<string>(COZE_DEFAULT_BASE_URL)
  const [botId, setBotId] = useState('')
  const [timeoutText, setTimeoutText] = useState<string>(DEFAULT_TIMEOUT_TEXT)
  // AI 操控通道(2026-09-21):只登记工作流 ID —— API 令牌是凭据(password 属性 + 令牌语义),
  // 按硬规矩连快照都不出现,故不交出写通道。
  useUiField({
    kind: 'input',
    label: tt('about.apiSettings.workflowId', '工作流 ID(Workflow ID)'),
    placeholder: tt('about.apiSettings.workflowPlaceholder', '请输入工作流 ID'),
    inputType: 'text',
    readValue: () => workflowId,
    setValue: setWorkflowId,
  })
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState<TestState>('idle')

  const load = useCallback(async () => {
    try {
      // 真身 = Coze 通道自检读数(GET /api/cozeZhsApi/agents/test/auth-config);
      // 原 /about/api-config 全仓零注册 ⇒ 「运行环境」这一行永远只有 '-'
      const res = await get<{ apiBaseUrl?: string }>('/cozeZhsApi/agents/test/auth-config')
      if (res?.apiBaseUrl) {
        setConfig((prev) => ({ ...prev, environment: res.apiBaseUrl as string }))
      }
    } catch (e) {
      logger.error('about/api-settings', '获取 API 配置', e)
    }
    const savedToken = Taro.getStorageSync(STORAGE_TOKEN_KEY) || ''
    const savedWorkflow = Taro.getStorageSync(STORAGE_WORKFLOW_KEY) || ''
    setApiToken(savedToken)
    setWorkflowId(savedWorkflow)
    setBaseUrl(Taro.getStorageSync(STORAGE_BASE_URL_KEY) || COZE_DEFAULT_BASE_URL)
    setBotId(Taro.getStorageSync(STORAGE_BOT_ID_KEY) || '')
    setTimeoutText(Taro.getStorageSync(STORAGE_TIMEOUT_KEY) || DEFAULT_TIMEOUT_TEXT)
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
    Taro.setStorageSync(STORAGE_BASE_URL_KEY, baseUrl)
    Taro.setStorageSync(STORAGE_BOT_ID_KEY, botId)
    Taro.setStorageSync(STORAGE_TIMEOUT_KEY, timeoutText)
    Taro.showToast({
      title: tt('about.apiSettings.savedTip', '保存成功'),
      icon: 'success',
    })
  }, [apiToken, workflowId, baseUrl, botId, timeoutText, tt])

  const reset = useCallback(() => {
    setApiToken('')
    setWorkflowId('')
    setBaseUrl(COZE_DEFAULT_BASE_URL)
    setBotId('')
    setTimeoutText(DEFAULT_TIMEOUT_TEXT)
    Taro.removeStorageSync(STORAGE_TOKEN_KEY)
    Taro.removeStorageSync(STORAGE_WORKFLOW_KEY)
    Taro.removeStorageSync(STORAGE_BASE_URL_KEY)
    Taro.removeStorageSync(STORAGE_BOT_ID_KEY)
    Taro.removeStorageSync(STORAGE_TIMEOUT_KEY)
    Taro.showToast({
      title: tt('about.apiSettings.resetTip', '已重置为默认值'),
      icon: 'none',
    })
  }, [tt])

  const testConnection = useCallback(async () => {
    setTesting('testing')
    try {
      // 真身 = POST /api/cozeZhsApi/agents/test/fetch-details(服务端用自己的 COZE 凭据打远端,
      // 回 hasRemote + cozeError);原 /about/api-test 全仓零注册,这颗按钮今天怎么点都是"失败",
      // 而且旧写法还把令牌明文交给了一条不存在的路径
      if (!botId) {
        setTesting('failed')
        Taro.showToast({ title: t('apiSettings.testFailed'), icon: 'none' })
        return
      }
      const res = await post<{ hasRemote?: boolean; cozeError?: string }>(
        '/cozeZhsApi/agents/test/fetch-details',
        { bot_id: botId },
      )
      if (res?.hasRemote) {
        setTesting('success')
        Taro.showToast({
          title: t('apiSettings.testSuccess'),
          icon: 'success',
        })
      } else {
        setTesting('failed')
        logger.warn('about/api-settings', '测试连接', res?.cozeError ?? '未取到远端详情')
        Taro.showToast({
          title: t('apiSettings.testFailed'),
          icon: 'none',
        })
      }
    } catch (e) {
      logger.error('about/api-settings', '测试连接', e)
      setTesting('failed')
      Taro.showToast({
        title: t('apiSettings.testFailed'),
        icon: 'none',
      })
    }
  }, [botId, t])

  useDidShow(() => load())

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background px-[28rpx] pt-[28rpx] pb-[64rpx]">
        <Text className="block text-[length:40rpx] font-bold text-foreground mb-[24rpx]">
          {t('apiSettings.title')}
        </Text>
        <View className="bg-card rounded-lg border border-border p-[28rpx] mb-[24rpx] overflow-hidden">
          <View
            className="flex justify-between items-center py-[16rpx]"
            onClick={() => copy(BASE_URL)}
            hoverClass="opacity-60"
          >
            <Text className="text-[length:28rpx] text-muted-foreground">
              {tt('about.apiSettings.apiUrl', 'API 地址')}
            </Text>
            <Text className="text-[length:28rpx] text-foreground max-w-[60%] text-right break-all">
              {BASE_URL}
            </Text>
          </View>
          <View className="flex justify-between items-center py-[16rpx]">
            <Text className="text-[length:28rpx] text-muted-foreground">
              {tt('about.apiSettings.apiVersion', 'API 版本')}
            </Text>
            <Text className="text-[length:28rpx] text-foreground max-w-[60%] text-right break-all">
              {config.version}
            </Text>
          </View>
          <View className="flex justify-between items-center py-[16rpx]">
            <Text className="text-[length:28rpx] text-muted-foreground">
              {tt('about.apiSettings.environment', '运行环境')}
            </Text>
            <Text className="text-[length:28rpx] text-foreground max-w-[60%] text-right break-all">
              {config.environment}
            </Text>
          </View>
        </View>

        <View className="bg-card rounded-lg border border-border p-[28rpx] mb-[24rpx] overflow-hidden">
          <Text className="block text-[length:32rpx] font-semibold text-foreground mb-[24rpx]">
            {t('apiSettings.cozeTitle')}
          </Text>
          <Text className={LABEL_CLS}>{t('apiSettings.apiToken')}</Text>
          <View className="flex items-center gap-[16rpx]">
            <FocusInput
              className={`flex-1 ${FIELD_BASE}`}
              type="text"
              password={!showToken}
              value={apiToken}
              placeholder={t('apiSettings.tokenPlaceholder')}
              onInput={(e) => setApiToken(e.detail.value)}
            />
            <View
              className="h-[100rpx] px-[24rpx] box-border bg-muted border-[length:2rpx] border-border rounded-xl flex items-center justify-center"
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
          <Text className={LABEL_CLS}>{t('apiSettings.baseUrl')}</Text>
          <FocusInput
            className={FIELD_FULL}
            type="text"
            value={baseUrl}
            placeholder={COZE_DEFAULT_BASE_URL}
            onInput={(e) => setBaseUrl(e.detail.value)}
          />
          <Text className={LABEL_CLS}>{t('apiSettings.botId')}</Text>
          <FocusInput
            className={FIELD_FULL}
            type="text"
            value={botId}
            placeholder={t('apiSettings.botIdPlaceholder')}
            onInput={(e) => setBotId(e.detail.value)}
          />
          <Text className={LABEL_CLS}>
            {tt('about.apiSettings.workflowId', '工作流 ID(Workflow ID)')}
          </Text>
          <FocusInput
            className={FIELD_FULL}
            type="text"
            value={workflowId}
            placeholder={tt('about.apiSettings.workflowPlaceholder', '请输入工作流 ID')}
            onInput={(e) => setWorkflowId(e.detail.value)}
          />
          <Text className={LABEL_CLS}>{t('apiSettings.timeout')}</Text>
          <FocusInput
            className={FIELD_FULL}
            type="number"
            value={timeoutText}
            placeholder={DEFAULT_TIMEOUT_TEXT}
            onInput={(e) => setTimeoutText(e.detail.value)}
          />
          <Text className="block text-[length:22rpx] text-[var(--color-text-tertiary)] mt-[24rpx]">
            {t('apiSettings.tokenHint')}
          </Text>
        </View>

        <View className="flex gap-[24rpx] mb-[24rpx]">
          <Button
            className="flex-1 text-[length:32rpx] font-semibold h-[100rpx] leading-[100rpx] rounded-sm m-0 p-0 after:border-0 bg-primary text-[var(--color-primary-foreground)]"
            onClick={save}
          >
            {t('apiSettings.save')}
          </Button>
          <Button
            className="flex-1 text-[length:32rpx] font-semibold h-[100rpx] leading-[100rpx] rounded-sm m-0 p-0 after:border-0 bg-background border-[length:2rpx] border-border text-[var(--color-text-medium)]"
            onClick={reset}
          >
            {t('apiSettings.reset')}
          </Button>
        </View>

        <View className="bg-card rounded-lg border border-border p-[28rpx] overflow-hidden">
          <Text className="block text-[length:32rpx] font-semibold text-foreground mb-[24rpx]">
            {t('apiSettings.diagnoseTitle')}
          </Text>
          <View className="flex items-center justify-between">
            <Text className="text-[length:28rpx] text-[var(--color-text-medium)]">
              {t('apiSettings.diagnose')}
            </Text>
            <Button
              className="text-[length:28rpx] font-semibold h-[64rpx] leading-[64rpx] px-[20rpx] py-0 bg-foreground text-background rounded-sm m-0 after:border-0 disabled:opacity-60"
              disabled={testing === 'testing'}
              onClick={testConnection}
            >
              {testing === 'testing' ? tt('common.detecting', '检测中...') : t('apiSettings.test')}
            </Button>
          </View>
          {testing === 'success' ? (
            <Text className="block mt-[16rpx] text-[length:28rpx] text-success">
              {t('apiSettings.testSuccess')}
            </Text>
          ) : null}
          {testing === 'failed' ? (
            <Text className="block mt-[16rpx] text-[length:28rpx] text-destructive">
              {t('apiSettings.testFailed')}
            </Text>
          ) : null}
        </View>

        <View className="text-center pt-[16rpx]">
          <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
            {tt('about.apiSettings.footer', '以上为当前 API 配置信息')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
