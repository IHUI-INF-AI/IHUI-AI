// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/llm-settings/LlmSettingsScreen.tsx
// 供应商列表 + BYOK 四步向导(① 选厂商 → ② 填 Key → ③ 验证 → ④ 激活)镜像 RN 共享屏;
// 小程序形态差异:RN 用 Modal 承载向导,此处用内联步骤条(小程序弹层能力弱)。
// 端点与 RN 薄壳同源:GET /api/v2/user/llm-providers、POST /api/llm/verify-key、
// POST /api/v2/user/llm-providers;厂商清单镜像 web byok-wizard PROVIDERS 常量(10 家)。
import { useCallback, useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import BackChevron from '@/components/BackChevron'
import { EmptyState, ScreenSkeleton } from '@/components/ScreenStates.taro'

interface ProviderRow {
  id: number | string
  name: string
  baseUrl: string
  enabled: boolean
}

const WIZARD_PROVIDERS: ReadonlyArray<{
  code: string
  name: string
  apiFormat: 'openai_chat' | 'anthropic_messages'
}> = [
  { code: 'openai', name: 'OpenAI', apiFormat: 'openai_chat' },
  { code: 'anthropic', name: 'Anthropic', apiFormat: 'anthropic_messages' },
  { code: 'deepseek', name: 'DeepSeek', apiFormat: 'openai_chat' },
  { code: 'zhipu', name: 'Zhipu AI', apiFormat: 'openai_chat' },
  { code: 'stepfun', name: 'StepFun', apiFormat: 'openai_chat' },
  { code: 'groq', name: 'Groq', apiFormat: 'openai_chat' },
  { code: 'siliconflow', name: 'SiliconFlow', apiFormat: 'openai_chat' },
  { code: 'agnes', name: 'Agnes', apiFormat: 'openai_chat' },
  { code: 'cloudflare', name: 'Cloudflare Workers AI', apiFormat: 'openai_chat' },
  { code: 'github', name: 'GitHub Models', apiFormat: 'openai_chat' },
]

type VerifyState = 'idle' | 'verifying' | 'success' | 'failed' | 'unavailable'

export default function LlmSettingsPage() {
  const { t } = useI18n()
  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [verifyState, setVerifyState] = useState<VerifyState>('idle')
  const [verifyMsg, setVerifyMsg] = useState('')
  const [pending, setPending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<{ groups?: { providers?: ProviderRow[] }[]; total?: number }>(
        '/v2/user/llm-providers',
      )
      const rows = (res?.groups ?? []).flatMap((g) => g.providers ?? [])
      setProviders(rows)
    } catch {
      Taro.showToast({ title: t('common.loadFailed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [t])

  useDidShow(() => {
    void load()
  })

  const onVerify = useCallback(async () => {
    if (step === 0) {
      if (!selectedCode) return
      setStep(1)
      return
    }
    const selected = WIZARD_PROVIDERS.find((p) => p.code === selectedCode)
    if (!selected || !apiKey.trim()) return
    setPending(true)
    setVerifyState('verifying')
    try {
      const r = await post<{ valid: boolean; message?: string }>('/llm/verify-key', {
        providerCode: selected.code,
        apiKey,
      })
      if (r?.valid) setVerifyState('success')
      else {
        setVerifyState('failed')
        setVerifyMsg(r?.message ?? '')
      }
      setStep(2)
    } catch {
      setVerifyState('unavailable')
      setStep(2)
    } finally {
      setPending(false)
    }
  }, [step, selectedCode, apiKey])

  const onActivate = useCallback(async () => {
    const selected = WIZARD_PROVIDERS.find((p) => p.code === selectedCode)
    if (!selected) return
    setPending(true)
    try {
      await post('/v2/user/llm-providers', {
        providerCode: selected.code,
        name: selected.name,
        apiKey,
        apiFormat: selected.apiFormat,
        providerGroup: 'default',
        sortOrder: 0,
      })
      setStep(3)
      void load()
    } catch {
      Taro.showToast({ title: t('common.loadFailed'), icon: 'none' })
    } finally {
      setPending(false)
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
    <ThemeRoot>
      <View className="min-h-screen bg-background p-4">
        <View className="flex items-center gap-3 py-3">
          <BackChevron />
          <Text className="text-xl font-bold text-foreground flex-1">{t('llmSettings.title')}</Text>
          <Button
            size="mini"
            className="bg-cta text-cta-foreground rounded-md"
            onClick={() => setWizardOpen(true)}
          >
            {t('byok.fab')}
          </Button>
        </View>

        {loading ? (
          <ScreenSkeleton variant="card" />
        ) : providers.length === 0 ? (
          <EmptyState title={t('llmSettings.empty')} desc={t('llmSettings.emptyDesc')} />
        ) : (
          <View className="space-y-3">
            {providers.map((p) => (
              <View
                key={String(p.id)}
                className="rounded-lg border border-border bg-card p-4 space-y-1"
              >
                <View className="flex items-center justify-between gap-2">
                  <Text className="text-base font-semibold text-foreground">{p.name}</Text>
                  <Text
                    className={`text-xs font-semibold ${p.enabled ? 'text-emerald-600' : 'text-muted-foreground'}`}
                  >
                    {p.enabled ? t('llmSettings.enabled') : t('llmSettings.disabled')}
                  </Text>
                </View>
                <Text className="text-xs text-muted-foreground">{p.baseUrl}</Text>
              </View>
            ))}
          </View>
        )}

        {wizardOpen ? (
          <View className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3">
            <View className="flex items-center justify-between">
              <Text className="text-base font-semibold text-foreground">{t('byok.title')}</Text>
              <Button size="mini" onClick={closeWizard}>
                {t('common.close')}
              </Button>
            </View>
            <View className="flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  className={`flex-1 h-1 rounded-xs ${i <= step ? 'bg-cta' : 'bg-muted'}`}
                />
              ))}
            </View>
            <Text className="text-sm font-semibold text-foreground">
              {t(`byok.step${step + 1}Title`)}
            </Text>

            {step === 0 ? (
              <View className="flex flex-wrap gap-2">
                {WIZARD_PROVIDERS.map((p) => (
                  <Button
                    key={p.code}
                    size="mini"
                    className={
                      selectedCode === p.code
                        ? 'bg-cta text-cta-foreground rounded-md'
                        : 'rounded-md'
                    }
                    onClick={() => setSelectedCode(p.code)}
                  >
                    {p.name}
                  </Button>
                ))}
              </View>
            ) : null}

            {step === 1 ? (
              <Input
                value={apiKey}
                onInput={(e) => setApiKey(e.detail.value)}
                placeholder={t('byok.keyPlaceholder')}
                password
                className="rounded-md border border-border bg-muted px-3 h-[44px] text-sm"
              />
            ) : null}

            {step === 2 ? (
              <Text
                className={`text-sm ${
                  verifyState === 'success'
                    ? 'text-emerald-600'
                    : verifyState === 'verifying'
                      ? 'text-muted-foreground'
                      : 'text-destructive'
                }`}
              >
                {verifyState === 'success'
                  ? t('byok.verifySuccess')
                  : verifyState === 'verifying'
                    ? t('byok.verifying')
                    : verifyMsg || t('byok.verifyFailed')}
              </Text>
            ) : null}

            {step === 3 ? (
              <Text className="text-sm text-muted-foreground">{t('byok.doneDesc')}</Text>
            ) : null}

            <Button
              size="mini"
              className="bg-cta text-cta-foreground rounded-md"
              disabled={
                pending ||
                (step === 0 && !selectedCode) ||
                (step === 1 && !apiKey.trim()) ||
                (step === 2 && !(verifyState === 'success' || verifyState === 'unavailable'))
              }
              onClick={() => {
                if (step === 3) closeWizard()
                else if (step === 2) void onActivate()
                else void onVerify()
              }}
            >
              {t(
                step === 3
                  ? 'common.close'
                  : step === 2
                    ? 'byok.activate'
                    : step === 1
                      ? 'byok.verify'
                      : 'byok.next',
              )}
            </Button>
          </View>
        ) : null}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
