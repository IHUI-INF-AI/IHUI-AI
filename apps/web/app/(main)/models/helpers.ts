import type { Provider, Model } from './types'

export const PROVIDERS: Provider[] = ['openai', 'anthropic', 'google', 'meta', 'local']

export const FALLBACK_MODELS: Model[] = [
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

export const MODEL_DESCRIPTIONS: Record<string, { description: string; features: string[] }> = {
  'stepfun/step-3.7-flash': {
    description: 'StepFun 阶跃星辰最新模型,已配置 plan 套餐',
    features: ['Plan', 'Fast', 'Chinese-Optimized'],
  },
  'stepfun/step-3.5-flash': { description: 'StepFun 3.5 快速版', features: ['Plan', 'Fast'] },
  'stepfun/step-router-v1': {
    description: 'StepFun 智能路由,自动选择最优模型',
    features: ['Plan', 'Auto-Route'],
  },
  'agnes/gpt-4o': { description: 'Agnes AI 代理的 GPT-4o', features: ['Plan', 'Multimodal'] },
  'groq/llama-3.3-70b-versatile': {
    description: '免费 30 RPM,速度极快',
    features: ['Free', 'Fast', 'Open Source'],
  },
  'gemini/gemini-1.5-flash': {
    description: '免费 15 RPM,100 万 token 上下文',
    features: ['Free', 'Long Context', 'Multimodal'],
  },
  'gpt-4o': {
    description: '均衡的多模态旗舰模型',
    features: ['Vision', 'Function Calling', 'Multimodal'],
  },
  'gpt-4o-mini': { description: '快速经济的轻量模型', features: ['Fast', 'Affordable'] },
  'claude-3-5-sonnet': {
    description: '强推理与长文写作',
    features: ['Reasoning', 'Writing', 'Vision'],
  },
  'gemini-2-flash': { description: '超长上下文多模态', features: ['Long Context', 'Multimodal'] },
}

export async function fetchModels(): Promise<Model[]> {
  try {
    const res = await fetch(
      `${process.env.AI_SERVICE_URL ?? 'http://localhost:8000'}/api/llm/models`,
      {
        next: { revalidate: 300 },
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as {
      models: Array<{
        id: string
        name: string
        provider: Provider
        context_length: number
        input_price: number
      }>
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
    return FALLBACK_MODELS
  }
}
