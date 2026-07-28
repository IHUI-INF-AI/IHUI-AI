import * as React from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { MainShell } from '@/components/layout/MainShell'

// 2026-07-28 P1-4 SEO 资产补全:
// (main) 路由组下没有 page.tsx,根页面由 (marketing) 路由组提供。
// 此处为 (main) 路由组所有页面提供 page-specific 默认 metadata:
// - AI 对话 / Agent 工作台 / 内容创作 / 教育学习 / 社区互动等高频场景
// - 关键词覆盖 Agent 市场 / RAG / MCP / 多模型调度 / 知识库
// - keywords 与根 layout 互补,定向 (main) 工作区场景
// 子页面(如 about/page.tsx / pricing/page.tsx)继承 template '%s | IHUI AI'。
export const metadata: Metadata = {
  title: { default: '工作区 — AI 对话 / Agent / RAG / 内容创作 | IHUI AI', template: '%s | IHUI AI' },
  description:
    'IHUI AI 工作区 — 集成 AI 对话、Agent 工作台、知识库 RAG、内容创作、教育学习、社区互动的一站式 AI 操作系统。支持 Web / API / CLI / Desktop / Extension / Mobile / Miniapp 8 端同源,Apache 2.0 开源,支持私有化部署。',
  keywords: [
    'AI 工作区',
    'AI 对话',
    'AI 智能体工作台',
    'Agent 工作台',
    '知识库 RAG',
    '内容创作 AI',
    '教育学习 AI',
    '社区 AI 互动',
    'AI Agent',
    'AI 智能体',
    'MCP 工具',
    '多模型调度',
    'AI 工作流',
    '团队协作',
    'AI 操作系统',
  ],
  openGraph: {
    type: 'website',
    title: '工作区 — IHUI AI',
    description:
      'IHUI AI 工作区 — 一站式 AI 操作系统,集成 AI 对话、Agent 工作台、知识库 RAG、内容创作、教育学习、社区互动,支持 8 端同源。',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'IHUI AI 工作区',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '工作区 — IHUI AI',
    description:
      'IHUI AI 工作区 — 一站式 AI 操作系统,集成 AI 对话、Agent 工作台、知识库 RAG、内容创作、教育学习、社区互动,支持 8 端同源。',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('common')
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-popover focus:rounded focus:bg-background focus:px-4 focus:py-2 focus:shadow"
      >
        {t('skipToMain')}
      </a>
      <MainShell>{children}</MainShell>
    </>
  )
}
