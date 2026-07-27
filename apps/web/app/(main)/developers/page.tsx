import type { Metadata } from 'next'
import { DevelopersContent } from './DevelopersContent'

export const metadata: Metadata = {
  title: '开发者门户 — 智汇 AI | OpenAI 兼容 API',
  description:
    '为开发者提供 OpenAI 兼容 API、9 大厂商模型、4 档配额,支持 Bearer Token 鉴权与多语言 SDK。',
  alternates: { canonical: '/developers' },
}

export default function DevelopersPage() {
  return <DevelopersContent />
}
