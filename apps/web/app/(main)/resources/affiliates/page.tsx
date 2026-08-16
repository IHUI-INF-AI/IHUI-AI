import type { Metadata } from 'next'
import { AffiliatesContent } from './AffiliatesContent'

export const metadata: Metadata = {
  title: '推荐 AI 工具 — IHUI AI Affiliate 资源',
  description:
    'IHUI AI 精选 10 个 AI 开发必备工具:OpenAI、Anthropic Claude、Google Gemini、Vercel、Railway、Supabase、Pinecone、LangSmith、Cursor、GitHub Copilot。',
  alternates: {
    canonical: '/resources/affiliates',
  },
  openGraph: {
    title: '推荐 AI 工具 — IHUI AI',
    description: '精选 10 个 AI 开发必备工具,通过推荐链接注册不增加额外费用,支持项目持续开发。',
    url: 'https://aizhs.top/resources/affiliates',
    type: 'website',
  },
}

export default function AffiliatesPage() {
  return <AffiliatesContent />
}
