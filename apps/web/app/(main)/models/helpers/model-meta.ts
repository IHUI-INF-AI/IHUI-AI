import type { PresetPrompt } from '../types'
import { FALLBACK_MODELS } from './fallback-models'

export const HIGHLIGHT_MODEL_IDS = new Set<string>([
  'stepfun/step-3.7-flash',
  'stepfun/step-3.5-flash',
  'stepfun/step-router-v1',
  'gpt-4o',
  'gpt-4o-mini',
  'o3',
  'claude-3-7-sonnet',
  'claude-opus-4',
  'claude-sonnet-4',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'deepseek-chat',
  'deepseek-reasoner',
  'qwen-max',
  'qwen-plus',
  'glm-4.5',
  'kimi-k2',
  'grok-3',
  'llama-3.3-70b-versatile',
  // === 2026-07 新模型(旗舰 + 新势力置顶推荐) ===
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'claude-sonnet-5',
  'claude-opus-4.8',
  'gemini-3.5-pro',
  'grok-4.5',
  'deepseek-v4-pro',
  'glm-5.2',
  'qwen3.7-max',
  'hunyuan-hy3',
  'kimi-k3',
  'ornith-1.0',
  'codebrain-1',
  'mai-thinking-1',
])

export const MODEL_DESCRIPTIONS: Record<string, { description: string; features: string[] }> = {
  'stepfun/step-router-v1': {
    description: 'StepFun 智能路由,默认主力,适合 tool calling',
    features: ['Plan', 'Auto-Route'],
  },
  'stepfun/step-3.7-flash': {
    description: 'model.stepfun-3-7-flash.description',
    features: ['Plan', 'Fast', 'Chinese-Optimized'],
  },
  'stepfun/step-3.5-flash': {
    description: 'model.stepfun-3-5-flash.description',
    features: ['Plan', 'Fast'],
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
  'openrouter/auto': {
    description: 'model.openrouter-auto.description',
    features: ['Free', 'Auto-Route', 'Multi-Provider'],
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

export const PRESET_PROMPTS: PresetPrompt[] = [
  {
    key: 'greet',
    label: '打招呼',
    content: '你好,请简单介绍一下你自己,以及你最擅长处理哪类任务?',
  },
  {
    key: 'creative',
    label: '创意写作',
    content: '请用 200 字以内,写一段关于"清晨海边"的散文,要求意境优美,语言精炼。',
  },
  {
    key: 'translate',
    label: '中英翻译',
    content: '请将下面这句中文翻译成英文:"科技的发展应当服务于人类福祉,而非取代人类的判断与情感。"',
  },
  {
    key: 'code',
    label: '编程示例',
    content:
      '请用 TypeScript 写一个函数 debounce,接受函数和等待时间,返回防抖后的函数。要求含类型注解。',
  },
]

export const LIVE_2026_MODELS: Array<{
  id: string
  name: string
  description: string
  releasedAt?: string
  provider: string
}> = FALLBACK_MODELS.slice(0, 6).map((m) => ({
  id: m.id,
  name: m.name,
  description: m.description ?? '',
  releasedAt: (m as { releasedAt?: string }).releasedAt,
  provider: m.provider,
}))
