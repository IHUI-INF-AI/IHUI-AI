'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, Bot, FileText, Cpu, Code2, LayoutGrid } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Feature Center 导航组件，高亮当前路由 */
const NAV_ITEMS = [
  { href: '/feature-center', label: '概览', icon: LayoutGrid },
  { href: '/feature-center/apis', label: 'API', icon: Package },
  { href: '/feature-center/agents', label: 'Agent', icon: Bot },
  { href: '/feature-center/documents', label: '文档', icon: FileText },
  { href: '/feature-center/models', label: '模型', icon: Cpu },
  { href: '/feature-center/sdks', label: 'SDK', icon: Code2 },
] as const

export function FeatureCenterNav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive =
          item.href === '/feature-center' ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
