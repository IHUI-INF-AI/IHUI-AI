import type { Metadata } from 'next'
import { NewsletterContent } from './NewsletterContent'

export const metadata: Metadata = {
  title: '订阅 IHUI AI 周报 - AI 工程实战案例 + 独家 prompt 模板',
  description: '每周收到 AI 工程、Agent 开发、RAG、MCP 实战案例。8,392+ 开发者已订阅。',
}

export default function NewsletterPage() {
  return <NewsletterContent />
}
