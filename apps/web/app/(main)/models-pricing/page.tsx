import type { Metadata } from 'next'
import { ModelsPricingContent } from './ModelsPricingContent'

export const metadata: Metadata = {
  title: '模型定价',
  description:
    '智汇 AI 平台 176 个大模型价格表:OpenAI / Anthropic / Google / DeepSeek / 通义千问 / 智谱 / 豆包 / Kimi / MiniMax 等厂商官方价格,支持搜索与厂商筛选。',
}

export default function ModelsPricingPage() {
  return <ModelsPricingContent />
}
