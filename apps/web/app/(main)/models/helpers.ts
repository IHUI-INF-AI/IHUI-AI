import type { Provider, Model } from './types'

export const PROVIDERS: Provider[] = ['openai', 'anthropic', 'google', 'meta', 'local']

export const FALLBACK_MODELS: Model[] = [
  {
    id: 'stepfun/step-3.7-flash',
    name: 'Step 3.7 Flash',
    provider: 'meta',
    description: 'model.stepfun-3-7-flash.description',
    contextLength: 128000,
    inputPrice: 0,
    features: ['Plan', 'Fast', 'Chinese-Optimized'],
  },
  {
    id: 'stepfun/step-router-v1',
    name: 'Step Router v1',
    provider: 'meta',
    description: 'model.stepfun-router-v1.description',
    contextLength: 128000,
    inputPrice: 0,
    features: ['Plan', 'Auto-Route'],
  },
  {
    id: 'groq/llama-3.3-70b-versatile',
    name: 'model.groq-llama-3-3-70b.name',
    provider: 'meta',
    description: 'model.groq-llama-3-3-70b.description',
    contextLength: 128000,
    inputPrice: 0,
    features: ['Free', 'Fast', 'Open Source'],
  },
  {
    id: 'gemini/gemini-1.5-flash',
    name: 'model.gemini-1-5-flash.name',
    provider: 'google',
    description: 'model.gemini-1-5-flash.description',
    contextLength: 1000000,
    inputPrice: 0,
    features: ['Free', 'Long Context', 'Multimodal'],
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 2.5,
    features: ['Vision', 'Function Calling', 'Multimodal'],
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'openai',
    description: 'model.gpt-4o-mini.description',
    contextLength: 128000,
    inputPrice: 0.15,
    features: ['Fast', 'Affordable'],
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'model.claude-3-5-sonnet.description',
    contextLength: 200000,
    inputPrice: 3,
    features: ['Reasoning', 'Writing', 'Vision'],
  },
  {
    id: 'gemini-2-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'model.gemini-2-flash.description',
    contextLength: 1000000,
    inputPrice: 0.1,
    features: ['Long Context', 'Multimodal'],
  },
]

export const MODEL_DESCRIPTIONS: Record<string, { description: string; features: string[] }> = {
  'stepfun/step-3.7-flash': {
    description: 'model.stepfun-3-7-flash.description',
    features: ['Plan', 'Fast', 'Chinese-Optimized'],
  },
  'stepfun/step-3.5-flash': {
    description: 'model.stepfun-3-5-flash.description',
    features: ['Plan', 'Fast'],
  },
  'stepfun/step-router-v1': {
    description: 'model.stepfun-router-v1.description',
    features: ['Plan', 'Auto-Route'],
  },
  'agnes/gpt-4o': {
    description: 'model.agnes-gpt-4o.description',
    features: ['Plan', 'Multimodal'],
  },
  'groq/llama-3.3-70b-versatile': {
    description: 'model.groq-llama-3-3-70b.description',
    features: ['Free', 'Fast', 'Open Source'],
  },
  'gemini/gemini-1.5-flash': {
    description: 'model.gemini-1-5-flash.description',
    features: ['Free', 'Long Context', 'Multimodal'],
  },
  'gpt-4o': {
    description: 'model.gpt-4o.description',
    features: ['Vision', 'Function Calling', 'Multimodal'],
  },
  'gpt-4o-mini': { description: 'model.gpt-4o-mini.description', features: ['Fast', 'Affordable'] },
  'claude-3-5-sonnet': {
    description: 'model.claude-3-5-sonnet.description',
    features: ['Reasoning', 'Writing', 'Vision'],
  },
  'gemini-2-flash': {
    description: 'model.gemini-2-flash.description',
    features: ['Long Context', 'Multimodal'],
  },
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
