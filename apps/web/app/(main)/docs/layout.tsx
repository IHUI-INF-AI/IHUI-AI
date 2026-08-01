'use client'
import { CategoryShell, type CategoryNavGroup } from '@/components/layout'
import { BookOpen, Bot, Code, Wrench, Database, Server } from 'lucide-react'

const NAV_GROUPS: CategoryNavGroup[] = [
  {
    label: '文档',
    items: [
      { href: '/docs', label: '概览', icon: BookOpen },
      { href: '/docs/agent', label: 'Agent 开发', icon: Bot },
      { href: '/docs/api', label: 'API 文档', icon: Code },
    ],
  },
  {
    label: '工具',
    items: [
      { href: '/docs/mcp', label: 'MCP 协议', icon: Wrench },
      { href: '/docs/rag', label: 'RAG 检索', icon: Database },
      { href: '/docs/self-host', label: '私有化部署', icon: Server },
    ],
  },
]

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <CategoryShell
      title="开发文档"
      description="平台开发与集成指南"
      navGroups={NAV_GROUPS}
    >
      {children}
    </CategoryShell>
  )
}
