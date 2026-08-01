'use client'

import { CategoryShell, type CategoryNavGroup } from '@/components/layout'
import { BarChart3, Bot, FileText, Gift, Key, Layers, MessageSquare, Sparkles, Users } from 'lucide-react'

const NAV_GROUPS: CategoryNavGroup[] = [
  {
    label: '模型',
    items: [
      { href: '/models', label: '概览', icon: Bot },
      { href: '/models/groups', label: '模型分组', icon: Layers },
      { href: '/models/skills', label: '技能', icon: Sparkles },
    ],
  },
  {
    label: '使用',
    items: [
      { href: '/models/chats', label: '对话', icon: MessageSquare },
      { href: '/models/usage', label: '用量', icon: BarChart3 },
      { href: '/models/logs', label: '日志', icon: FileText },
    ],
  },
  {
    label: '密钥',
    items: [
      { href: '/models/keys', label: 'API 密钥', icon: Key },
      { href: '/models/redeem', label: '兑换码', icon: Gift },
    ],
  },
  {
    label: '用户',
    items: [
      { href: '/models/users', label: '用户管理', icon: Users },
    ],
  },
]

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  return (
    <CategoryShell
      title="模型中心"
      description="模型管理与用量统计"
      navGroups={NAV_GROUPS}
    >
      {children}
    </CategoryShell>
  )
}
