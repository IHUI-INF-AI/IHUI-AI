import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Bot, Cpu, Sparkles, Zap } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ihui/ui'

type Provider = 'openai' | 'anthropic' | 'google' | 'meta' | 'local'

interface Model {
  id: string
  name: string
  provider: Provider
  description: string
  contextLength: number
  inputPrice: number // USD / 1M tokens，0 表示免费
  features: string[]
}

const PROVIDERS: Provider[] = ['openai', 'anthropic', 'google', 'meta', 'local']

// 硬编码 fallback(AI service 不可用时使用)
const FALLBACK_MODELS: Model[] = [
  // 用户 plan 套餐(已配置,优先使用)
  {
    id: 'stepfun/step-3.7-flash',
    name: 'Step 3.7 Flash',
    provider: 'meta',
    description: 'StepFun 阶跃星辰最新模型,已配置 plan 套餐',
    contextLength: 128000,
    inputPrice: 0,
    features: ['Plan', 'Fast', 'Chinese-Optimized'],
  },
  {
    id: 'stepfun/step-router-v1',
    name: 'Step Router v1',
    provider: 'meta',
    description: 'StepFun 智能路由,自动选择最优模型',
    contextLength: 128000,
    inputPrice: 0,
    features: ['Plan', 'Auto-Route'],
  },
  // 免费 provider(备选)
  {
    id: 'groq/llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B (Groq 免费)',
    provider: 'meta',
    description: '免费 30 RPM,速度极快,只需 Groq API key',
    contextLength: 128000,
    inputPrice: 0,
    features: ['Free', 'Fast', 'Open Source'],
  },
  {
    id: 'gemini/gemini-1.5-flash',
    name: 'Gemini 1.5 Flash (免费)',
    provider: 'google',
    description: '免费 15 RPM,100 万 token 上下文',
    contextLength: 1000000,
    inputPrice: 0,
    features: ['Free', 'Long Context', 'Multimodal'],
  },
  // 付费 provider
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: '均衡的多模态旗舰模型',
    contextLength: 128000,
    inputPrice: 2.5,
    features: ['Vision', 'Function Calling', 'Multimodal'],
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'openai',
    description: '快速经济的轻量模型',
    contextLength: 128000,
    inputPrice: 0.15,
    features: ['Fast', 'Affordable'],
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: '强推理与长文写作',
    contextLength: 200000,
    inputPrice: 3,
    features: ['Reasoning', 'Writing', 'Vision'],
  },
  {
    id: 'gemini-2-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: '超长上下文多模态',
    contextLength: 1000000,
    inputPrice: 0.1,
    features: ['Long Context', 'Multimodal'],
  },
]

// 描述映射(AI service 只返回基础字段,描述/features 在前端补充)
const MODEL_DESCRIPTIONS: Record<string, { description: string; features: string[] }> = {
  'stepfun/step-3.7-flash': { description: 'StepFun 阶跃星辰最新模型,已配置 plan 套餐', features: ['Plan', 'Fast', 'Chinese-Optimized'] },
  'stepfun/step-3.5-flash': { description: 'StepFun 3.5 快速版', features: ['Plan', 'Fast'] },
  'stepfun/step-router-v1': { description: 'StepFun 智能路由,自动选择最优模型', features: ['Plan', 'Auto-Route'] },
  'agnes/gpt-4o': { description: 'Agnes AI 代理的 GPT-4o', features: ['Plan', 'Multimodal'] },
  'groq/llama-3.3-70b-versatile': { description: '免费 30 RPM,速度极快', features: ['Free', 'Fast', 'Open Source'] },
  'gemini/gemini-1.5-flash': { description: '免费 15 RPM,100 万 token 上下文', features: ['Free', 'Long Context', 'Multimodal'] },
  'gpt-4o': { description: '均衡的多模态旗舰模型', features: ['Vision', 'Function Calling', 'Multimodal'] },
  'gpt-4o-mini': { description: '快速经济的轻量模型', features: ['Fast', 'Affordable'] },
  'claude-3-5-sonnet': { description: '强推理与长文写作', features: ['Reasoning', 'Writing', 'Vision'] },
  'gemini-2-flash': { description: '超长上下文多模态', features: ['Long Context', 'Multimodal'] },
}

/**
 * 从 AI service 动态获取模型列表。
 * 失败时降级为 FALLBACK_MODELS(确保页面始终可用)。
 */
async function fetchModels(): Promise<Model[]> {
  try {
    // 服务端 fetch,直接请求 AI service(运行时读取 AI_SERVICE_URL 环境变量)
    const res = await fetch(`${process.env.AI_SERVICE_URL ?? 'http://localhost:8000'}/api/llm/models`, {
      next: { revalidate: 300 }, // 缓存 5 分钟
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as {
      models: Array<{ id: string; name: string; provider: Provider; context_length: number; input_price: number }>
    }
    return data.models.map((m) => {
      const desc = MODEL_DESCRIPTIONS[m.id] ?? { description: '', features: [] }
      return {
        id: m.id,
        name: m.name,
        provider: m.provider,
        description: desc.description,
        contextLength: m.context_length,
        inputPrice: m.input_price,
        features: desc.features,
      }
    })
  } catch {
    // AI service 不可用时降级
    return FALLBACK_MODELS
  }
}

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>
}) {
  const t = await getTranslations('models')
  const locale = await getLocale()
  const { provider } = await searchParams

  // 从 AI service 动态获取模型列表(失败降级 FALLBACK_MODELS)
  const MODELS = await fetchModels()

  const active: Provider | 'all' =
    provider && (PROVIDERS as string[]).includes(provider) ? (provider as Provider) : 'all'

  const list = active === 'all' ? MODELS : MODELS.filter((m) => m.provider === active)

  const priceFmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
  const ctxFmt = new Intl.NumberFormat(locale, { notation: 'compact' })

  const tabs: { key: Provider | 'all'; label: string }[] = [
    { key: 'all', label: t('all') },
    ...PROVIDERS.map((p) => ({ key: p, label: t(`providers.${p}`) })),
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Bot className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b">
        {tabs.map((tab) => {
          const isActive = tab.key === active
          const href = tab.key === 'all' ? '/models' : `/models?provider=${tab.key}`
          return (
            <Link
              key={tab.key}
              href={href}
              className={cn(
                'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((m) => (
          <Card key={m.id} className="flex flex-col transition-colors hover:border-primary/40">
            <CardHeader>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="text-xs text-muted-foreground">{t(`providers.${m.provider}`)}</span>
              </div>
              <CardTitle className="text-base">{m.name}</CardTitle>
              <CardDescription>{m.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-3 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Cpu className="h-3.5 w-3.5" />
                  {t('contextLength')}
                </span>
                <span className="font-medium text-foreground">{ctxFmt.format(m.contextLength)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {t('price')}
                </span>
                <span className="font-medium text-foreground">
                  {m.inputPrice === 0 ? t('free') : `${priceFmt.format(m.inputPrice)}${t('perMillion')}`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {m.features.map((f) => (
                  <span
                    key={f}
                    className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
