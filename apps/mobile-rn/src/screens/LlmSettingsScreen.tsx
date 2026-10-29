// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LLM 供应商设置(BYOK)页(mobile-rn 端)—— 薄壳,渲染真相源在共享层
 * `packages/app/src/features/llm-settings/LlmSettingsScreen.tsx`(经 `@ihui/rn-app` 具名导出)。
 * 本文件管平台侧:供应商列表取数、BYOK 四步状态机推进、verify-key / create 请求、提示。
 *
 * 端点契约(与 web helpers-v2.ts / byok-wizard.tsx 同源):
 *  - GET  /api/v2/user/llm-providers   ⇒ { groups: [{ providers: UserLlmProvider[] }], total }
 *  - POST /api/llm/verify-key          ⇒ { valid, message? }
 *  - POST /api/v2/user/llm-providers   ⇒ { id, created, name }
 * 厂商清单 = web byok-wizard PROVIDERS 常量的镜像(10 家;改清单须两端同笔)。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import {
  LlmSettingsScreen as SharedLlmSettingsScreen,
  type ByokProviderOption,
  type ByokVerifyState,
  type LlmProviderRowView,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

const WIZARD_PROVIDERS: readonly (ByokProviderOption & {
  apiFormat: 'openai_chat' | 'anthropic_messages'
})[] = [
  {
    code: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModelId: 'gpt-4o-mini',
    apiFormat: 'openai_chat',
  },
  {
    code: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModelId: 'claude-3-5-sonnet-20241022',
    apiFormat: 'anthropic_messages',
  },
  {
    code: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModelId: 'deepseek-chat',
    apiFormat: 'openai_chat',
  },
  {
    code: 'zhipu',
    name: 'Zhipu AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModelId: 'glm-4-flash',
    apiFormat: 'openai_chat',
  },
  {
    code: 'stepfun',
    name: 'StepFun',
    baseUrl: 'https://api.stepfun.com/v1',
    defaultModelId: 'step-1-flash',
    apiFormat: 'openai_chat',
  },
  {
    code: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModelId: 'llama-3.1-8b-instant',
    apiFormat: 'openai_chat',
  },
  {
    code: 'siliconflow',
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModelId: 'Qwen/Qwen2.5-7B-Instruct',
    apiFormat: 'openai_chat',
  },
  {
    code: 'agnes',
    name: 'Agnes',
    baseUrl: 'https://api.agnes-ai.cn/v1',
    defaultModelId: 'agnes-2.5-flash',
    apiFormat: 'openai_chat',
  },
  {
    code: 'cloudflare',
    name: 'Cloudflare Workers AI',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts',
    defaultModelId: '@cf/meta/llama-3.1-8b-instruct',
    apiFormat: 'openai_chat',
  },
  {
    code: 'github',
    name: 'GitHub Models',
    baseUrl: 'https://models.inference.ai.azure.com',
    defaultModelId: 'gpt-4o-mini',
    apiFormat: 'openai_chat',
  },
]

interface UserLlmProvider {
  id: number
  name: string
  baseUrl: string
  enabled: boolean
}

function LlmSettingsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()

  const [providers, setProviders] = useState<LlmProviderRowView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [verifyState, setVerifyState] = useState<ByokVerifyState>('idle')
  const [verifyMsg, setVerifyMsg] = useState('')
  const [actionPending, setActionPending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<{ groups: { providers?: UserLlmProvider[] }[]; total: number }>(
        '/api/v2/user/llm-providers',
      )
      if (!res.success) throw new Error(res.error || 'load failed')
      const rows = (res.data?.groups ?? []).flatMap((g) => g.providers ?? [])
      setProviders(
        rows.map((p) => ({ id: p.id, name: p.name, baseUrl: p.baseUrl, enabled: p.enabled })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onVerify = useCallback(async () => {
    if (step === 0) {
      setStep(1)
      return
    }
    const selected = WIZARD_PROVIDERS.find((p) => p.code === selectedCode)
    if (!selected || !apiKey.trim()) return
    setActionPending(true)
    setVerifyState('verifying')
    setVerifyMsg('')
    try {
      const r = await fetchApi<{ valid: boolean; message?: string }>('/api/llm/verify-key', {
        method: 'POST',
        body: JSON.stringify({ providerCode: selected.code, apiKey }),
      })
      if (r.success && r.data) {
        if (r.data.valid) setVerifyState('success')
        else {
          setVerifyState('failed')
          setVerifyMsg(r.data.message ?? '')
        }
        setStep(2)
      } else {
        setVerifyState('unavailable')
        setVerifyMsg(r.error ?? '')
        setStep(2)
      }
    } catch {
      setVerifyState('unavailable')
      setVerifyMsg('')
      setStep(2)
    } finally {
      setActionPending(false)
    }
  }, [step, selectedCode, apiKey])

  const onActivate = useCallback(async () => {
    const selected = WIZARD_PROVIDERS.find((p) => p.code === selectedCode)
    if (!selected) return
    setActionPending(true)
    try {
      const res = await fetchApi<{ id: number; created: boolean; name: string }>(
        '/api/v2/user/llm-providers',
        {
          method: 'POST',
          body: JSON.stringify({
            providerCode: selected.code,
            name: selected.name,
            apiKey,
            apiFormat: selected.apiFormat,
            baseUrlOverride: undefined,
            providerGroup: 'default',
            sortOrder: 0,
          }),
        },
      )
      if (!res.success) throw new Error(res.error)
      setStep(3)
      void load()
    } catch (e) {
      void appAlert(t('common.error'), e instanceof Error ? e.message : t('byok.activate'))
    } finally {
      setActionPending(false)
    }
  }, [selectedCode, apiKey, load, t])

  const closeWizard = useCallback(() => {
    setWizardOpen(false)
    setStep(0)
    setSelectedCode(null)
    setApiKey('')
    setVerifyState('idle')
    setVerifyMsg('')
  }, [])

  return (
    <SharedLlmSettingsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      providers={providers}
      wizardProviders={WIZARD_PROVIDERS.map(({ code, name, baseUrl, defaultModelId }) => ({
        code,
        name,
        baseUrl,
        defaultModelId,
      }))}
      wizardOpen={wizardOpen}
      wizardStep={step}
      selectedCode={selectedCode}
      apiKey={apiKey}
      verifyState={verifyState}
      verifyMsg={verifyMsg}
      actionPending={actionPending}
      onRetry={() => void load()}
      onNext={() => setStep(1)}
      onWizardOpen={() => setWizardOpen(true)}
      onWizardClose={closeWizard}
      onSelectProvider={setSelectedCode}
      onApiKeyChange={setApiKey}
      onVerify={() => void onVerify()}
      onActivate={() => void onActivate()}
    />
  )
}

export default LlmSettingsScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
