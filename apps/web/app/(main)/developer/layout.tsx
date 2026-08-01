'use client'

import { usePathname } from 'next/navigation'
import { Terminal, Key, FileText, Users, Code } from 'lucide-react'

import { CategoryShell, type CategoryNavGroup } from '@/components/layout'

const NAV_GROUPS: CategoryNavGroup[] = [
  {
    label: '开发者',
    items: [
      { href: '/developer', label: '概览', icon: Terminal },
      { href: '/developer/keys', label: 'API 密钥', icon: Key },
      { href: '/developer/logs', label: '日志', icon: FileText },
      { href: '/developer/team', label: '团队', icon: Users },
    ],
  },
  {
    label: '工具',
    items: [
      { href: '/developer/ide', label: '在线 IDE', icon: Code },
    ],
  },
]

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // IDE 页面撑满工作区,不渲染 Shell(2026-07-31 立,用户要求)
  if (pathname === '/developer/ide') {
    return <>{children}</>
  }
  return (
    <CategoryShell
      title="开发者中心"
      description="API 开放平台与开发工具"
      navGroups={NAV_GROUPS}
    >
      {children}
    </CategoryShell>
  )
}
