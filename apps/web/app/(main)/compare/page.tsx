import type { Metadata } from 'next'
import { CompareContent } from './CompareContent'

export const metadata: Metadata = {
  title: 'IHUI-AI vs 竞品对比 — 开源 8 端 AI 平台',
  description: 'IHUI-AI vs ChatGPT Plus / Dify / LangChain / Coze / FastGPT 全面对比。开源 Apache 2.0、8 端同源、176 模型、LangGraph+MCP+A2A 三栈。私有化部署、SaaS、API 计费。',
}

export default function ComparePage() {
  return <CompareContent />
}
