// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageClient from './PageClient'

export const metadata: Metadata = {
  title: 'MCP 商店 — 内置 MCP Server 一键注册 | IHUI AI',
  description:
    '浏览智汇 AI 内置 MCP Server 目录(Filesystem/Git/Fetch/Memory/PostgreSQL/GitHub 等),一键注册扩展 Agent 工具能力。',
  alternates: { canonical: '/mcp-store' },
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  )
}
