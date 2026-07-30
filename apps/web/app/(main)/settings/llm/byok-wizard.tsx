'use client'

/**
 * BYOK 一键配置向导 — 小白用户 4 步配置 API Key 开始挣钱
 *
 * 步骤:① 选厂商 → ② 填 Key → ③ 自动验证 → ④ 激活抽成
 * 挂载方式:浮动按钮(FAB),点击打开 Dialog 向导
 * 激活:调用 createProviderV2 创建真实 provider 配置,平台自动开启 5-20% 抽成
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Wand2,
  Eye,
  EyeOff,
  ClipboardPaste,
  Loader2,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Label,
} from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { fetchApi } from '@/lib/api'
import { createProviderV2 } from './helpers-v2'
import type { ProviderFormState } from './types-v2'

// =============================================================================
// 厂商列表(8+ 厂商,免费/付费徽章)
// =============================================================================

interface WizardProvider {
  code: string
  name: string
  free: boolean
  apiFormat: ProviderFormState['apiFormat']
  baseUrl: string
  defaultModelId: string
  signupUrl: string
}

const PROVIDERS: readonly WizardProvider[] = [
  { code: 'openai', name: 'OpenAI', free: false, apiFormat: 'openai_chat', baseUrl: 'https://api.openai.com/v1', defaultModelId: 'gpt-4o-mini', signupUrl: 'https://platform.openai.com/api-keys' },
  { code: 'anthropic', name: 'Anthropic', free: false, apiFormat: 'anthropic_messages', baseUrl: 'https://api.anthropic.com', defaultModelId: 'claude-3-5-sonnet-20241022', signupUrl: 'https://console.anthropic.com/settings/keys' },
  { code: 'deepseek', name: 'DeepSeek', free: false, apiFormat: 'openai_chat', baseUrl: 'https://api.deepseek.com/v1', defaultModelId: 'deepseek-chat', signupUrl: 'https://platform.deepseek.com/api_keys' },
  { code: 'zhipu', name: 'Zhipu AI', free: false, apiFormat: 'openai_chat', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', defaultModelId: 'glm-4-flash', signupUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  { code: 'stepfun', name: 'StepFun', free: false, apiFormat: 'openai_chat', baseUrl: 'https://api.stepfun.com/v1', defaultModelId: 'step-1-flash', signupUrl: 'https://platform.stepfun.com/interface-key' },
  { code: 'groq', name: 'Groq', free: false, apiFormat: 'openai_chat', baseUrl: 'https://api.groq.com/openai/v1', defaultModelId: 'llama-3.1-8b-instant', signupUrl: 'https://console.groq.com/keys' },
  { code: 'siliconflow', name: 'SiliconFlow', free: false, apiFormat: 'openai_chat', baseUrl: 'https://api.siliconflow.cn/v1', defaultModelId: 'Qwen/Qwen2.5-7B-Instruct', signupUrl: 'https://cloud.siliconflow.cn/account/ak' },
  { code: 'agnes', name: 'Agnes', free: false, apiFormat: 'openai_chat', baseUrl: 'https://api.agnes.ai/v1', defaultModelId: 'agnes-chat', signupUrl: 'https://agnes.ai/api-keys' },
  { code: 'cloudflare', name: 'Cloudflare Workers AI', free: true, apiFormat: 'openai_chat', baseUrl: 'https://api.cloudflare.com/client/v4/accounts', defaultModelId: '@cf/meta/llama-3.1-8b-instruct', signupUrl: 'https://dash.cloudflare.com' },
  { code: 'github', name: 'GitHub Models', free: true, apiFormat: 'openai_chat', baseUrl: 'https://models.inference.ai.azure.com', defaultModelId: 'gpt-4o-mini', signupUrl: 'https://github.com/settings/tokens' },
] as const

// =============================================================================
// 验证结果类型
// =============================================================================

type VerifyState = 'idle' | 'verifying' | 'success' | 'failed' | 'unavailable'

interface VerifyResponse {
  valid: boolean
  message?: string
}

function isVerifyResponse(v: unknown): v is VerifyResponse {
  return typeof v === 'object' && v !== null && 'valid' in v && typeof (v as VerifyResponse).valid === 'boolean'
}

// =============================================================================
// 向导主组件
// =============================================================================

const STEPS = [0, 1, 2, 3] as const

export function ByokWizard() {
  const t = useTranslations('byokWizard')
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState(0)
  const [selected, setSelected] = React.useState<WizardProvider | null>(null)
  const [apiKey, setApiKey] = React.useState('')
  const [showKey, setShowKey] = React.useState(false)
  const [verifyState, setVerifyState] = React.useState<VerifyState>('idle')
  const [verifyMsg, setVerifyMsg] = React.useState('')

  function reset() {
    setStep(0)
    setSelected(null)
    setApiKey('')
    setShowKey(false)
    setVerifyState('idle')
    setVerifyMsg('')
  }

  function closeDialog() {
    setOpen(false)
    setTimeout(reset, 200)
  }

  // 步骤 3:验证 API Key
  async function handleVerify() {
    if (!selected) return
    setVerifyState('verifying')
    setVerifyMsg('')
    try {
      const r = await fetchApi<unknown>('/api/llm/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerCode: selected.code, apiKey }),
      })
      if (r.success && isVerifyResponse(r.data)) {
        if (r.data.valid) {
          setVerifyState('success')
        } else {
          setVerifyState('failed')
          setVerifyMsg(r.data.message ?? t('verifyFailed'))
        }
      } else {
        // 端点未就绪(404/网络错误)→ 允许跳过验证
        setVerifyState('unavailable')
      }
    } catch {
      setVerifyState('unavailable')
    }
  }

  // 步骤 4:激活(创建 provider,平台自动开启抽成)
  const activateMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('no provider')
      const form: ProviderFormState = {
        id: null,
        providerCode: selected.code,
        name: selected.name,
        apiKey: apiKey.trim(),
        baseUrlOverride: selected.baseUrl,
        apiFormat: selected.apiFormat,
        providerGroup: 'default',
        groupLabel: '默认',
        description: '',
        enabled: true,
      }
      return createProviderV2(form)
    },
    onSuccess: () => {
      toast.success(t('successToast'))
      setOpen(false)
      setTimeout(() => {
        reset()
        router.push('/earnings')
      }, 300)
    },
    onError: (e: Error) => toast.error(t('activateFailed'), { description: e.message }),
  })

  const canNext =
    step === 0
      ? selected !== null
      : step === 1
        ? selected?.free || apiKey.trim().length > 0
        : step === 2
          ? verifyState === 'success' || verifyState === 'unavailable'
          : false

  function next() {
    if (step === 2 && verifyState === 'idle') {
      handleVerify()
      return
    }
    if (step < 3) setStep(step + 1)
  }

  function prev() {
    if (step > 0) setStep(step - 1)
  }

  const stepTitles = [t('step1Title'), t('step2Title'), t('step3Title'), t('step4Title')]

  return (
    <>
      {/* 浮动触发按钮 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-emerald-700"
      >
        <Wand2 className="h-4 w-4" />
        {t('trigger')}
      </button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent className="max-w-lg gap-0 p-0 sm:rounded-lg">
          <DialogHeader className="space-y-2 border-b p-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              {t('title')}
            </DialogTitle>
            <DialogDescription className="text-xs">{t('subtitle')}</DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center justify-between gap-1 px-4 py-3">
            {STEPS.map((s) => (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={
                      s < step
                        ? 'flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white'
                        : s === step
                          ? 'flex h-7 w-7 items-center justify-center rounded-md border-2 border-emerald-600 text-emerald-600 dark:text-emerald-400'
                          : 'flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground'
                    }
                  >
                    {s < step ? <Check className="h-3.5 w-3.5" /> : s + 1}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{stepTitles[s]}</span>
                </div>
                {s < 3 && <div className="mb-4 h-px flex-1 bg-border" />}
              </React.Fragment>
            ))}
          </div>

          {/* 步骤内容 */}
          <div className="max-h-[55vh] overflow-y-auto p-4">
            {/* 步骤 1:选厂商 */}
            {step === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t('step1Desc')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => setSelected(p)}
                      className={
                        selected?.code === p.code
                          ? 'flex flex-col items-start gap-1 rounded-md border-2 border-emerald-500 bg-emerald-50/50 p-2.5 text-left dark:bg-emerald-950/20'
                          : 'flex flex-col items-start gap-1 rounded-md border border-border p-2.5 text-left transition-colors hover:border-emerald-400 hover:bg-accent'
                      }
                    >
                      <span className="text-sm font-medium">{p.name}</span>
                      <span
                        className={
                          p.free
                            ? 'rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'
                            : 'rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400'
                        }
                      >
                        {p.free ? t('freeBadge') : t('paidBadge')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 步骤 2:填 API Key */}
            {step === 1 && selected && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t('step2Desc')}</p>
                {selected.free ? (
                  <div className="rounded-md bg-emerald-50/60 p-3 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                    {t('freeNoKey')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs">{t('apiKeyLabel')}</Label>
                      <Tooltip content={t('apiKeyHelp')}>
                        <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                      </Tooltip>
                    </div>
                    <div className="relative">
                      <Input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={t('apiKeyPlaceholder')}
                        className="pr-20"
                      />
                      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="rounded-sm p-1 text-muted-foreground hover:bg-accent"
                        >
                          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText()
                              setApiKey(text.trim())
                            } catch {
                              toast.error(t('pasteFailed'))
                            }
                          }}
                          className="rounded-sm p-1 text-muted-foreground hover:bg-accent"
                        >
                          <ClipboardPaste className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <a
                      href={selected.signupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      {t('getApiKey')}
                      <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 步骤 3:自动验证 */}
            {step === 2 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t('step3Desc')}</p>
                {verifyState === 'idle' && (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                    <Button onClick={handleVerify} size="sm" variant="outline">
                      {t('startVerify')}
                    </Button>
                  </div>
                )}
                {verifyState === 'verifying' && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs text-muted-foreground">{t('verifying')}</p>
                  </div>
                )}
                {verifyState === 'success' && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <div className="rounded-md bg-emerald-500/10 p-2">
                      <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {t('verified')}
                    </p>
                  </div>
                )}
                {verifyState === 'failed' && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <div className="rounded-md bg-red-500/10 p-2">
                      <X className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      {t('verifyFailed')}
                    </p>
                    {verifyMsg && <p className="text-xs text-muted-foreground">{verifyMsg}</p>}
                    <Button onClick={handleVerify} size="sm" variant="outline">
                      {t('verifyRetry')}
                    </Button>
                  </div>
                )}
                {verifyState === 'unavailable' && (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <div className="rounded-md bg-amber-500/10 p-2">
                      <HelpCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      {t('verifyUnavailable')}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('verifyUnavailableDesc')}</p>
                  </div>
                )}
              </div>
            )}

            {/* 步骤 4:激活抽成 */}
            {step === 3 && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t('step4Desc')}</p>
                <div className="rounded-md border p-3 text-xs">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">{t('providerLabel')}</span>
                    <span className="font-medium">{selected?.name}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">{t('apiKeyLabel')}</span>
                    <span className="font-medium">
                      {selected?.free ? t('freeNoKey') : apiKey ? '••••••••' : '—'}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-md bg-emerald-50/60 p-3 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{t('commissionNote')}</p>
                </div>
                {activateMut.isPending && (
                  <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('activating')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 底部导航 */}
          <div className="flex items-center justify-between border-t p-4">
            <Button onClick={prev} size="sm" variant="ghost" disabled={step === 0}>
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              {t('prev')}
            </Button>
            {step < 3 ? (
              <Button onClick={next} size="sm" disabled={!canNext}>
                {step === 2 && verifyState === 'idle' ? t('startVerify') : t('next')}
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                onClick={() => activateMut.mutate()}
                size="sm"
                disabled={activateMut.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                {t('activate')}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
