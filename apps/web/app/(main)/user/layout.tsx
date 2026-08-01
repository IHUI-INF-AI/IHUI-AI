import * as React from 'react'
import {
  User,
  ShieldCheck,
  Lock,
  FileText,
  HelpCircle,
  MessageSquare,
  Users,
  UserCheck,
  UserPlus,
  ClipboardList,
  FileQuestion,
  Download,
} from 'lucide-react'
import { CategoryShell, type CategoryNavGroup } from '@/components/layout'

/**
 * user 模块统一侧边栏分组(2026-08-01 立,改用 CategoryShell)
 *
 * 分组:账户 / 内容 / 互动 / 学习,共 12 个子页面。
 * 标题与 label 硬编码中文(user 命名空间缺少 title/navGroup 等聚合 key,
 *  子页面 .title 已存在但为统一性一并硬编码;不新增 i18n 翻译文件)。
 */
const NAV_GROUPS: CategoryNavGroup[] = [
  {
    label: '账户',
    items: [
      { href: '/user/profile', label: '个人资料', icon: User },
      { href: '/user/realname', label: '实名认证', icon: ShieldCheck },
      { href: '/user/security', label: '账号安全', icon: Lock },
    ],
  },
  {
    label: '内容',
    items: [
      { href: '/user/articles', label: '我的文章', icon: FileText },
      { href: '/user/ask', label: '我的提问', icon: HelpCircle },
      { href: '/user/comment', label: '我的评论', icon: MessageSquare },
      { href: '/user/circle', label: '我的圈子', icon: Users },
    ],
  },
  {
    label: '互动',
    items: [
      { href: '/user/fans', label: '我的粉丝', icon: UserCheck },
      { href: '/user/follow', label: '我的关注', icon: UserPlus },
      { href: '/user/sign-up', label: '我的报名', icon: ClipboardList },
    ],
  },
  {
    label: '学习',
    items: [
      { href: '/user/exam', label: '我的考试', icon: FileQuestion },
      { href: '/user/resource', label: '我的资源', icon: Download },
    ],
  },
]

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <CategoryShell
      title="个人中心"
      description="管理个人信息、内容与互动"
      navGroups={NAV_GROUPS}
    >
      {children}
    </CategoryShell>
  )
}
