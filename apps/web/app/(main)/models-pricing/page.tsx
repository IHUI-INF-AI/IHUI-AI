import type { Metadata } from 'next'
import { ModelsPricingContent } from './ModelsPricingContent'

export const metadata: Metadata = {
  title: '模型定价',
  description:
    '智汇 AI 平台所有模型定价明细:OpenAI / Anthropic / Gemini / DeepSeek / Qwen / 豆包 / Kimi / 智谱 / MiniMax,按厂商分组,支持搜索。',
}

export default function ModelsPricingPage() {
  return <ModelsPricingContent />
}
