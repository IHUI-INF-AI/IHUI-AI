'use client'

/**
 * /chat 路由(2026-07-28 重构 / 2026-07-31 升级):
 * - AI 对话的实际承载组件是全局 docked 的 AISidePanel,通过 useAiPanelStore.open 控制
 * - /chat 路由本身只是 AI 面板的快捷入口,不应在主工作区重复渲染"任务列表"等 AI 相关 UI
 *   (用户反馈:右侧"任务列表"几行文字与 AI 面板完全重复,属于冗余)
 * - 已登录时,/chat 复用 /home 的工作区首页内容(已自动打开 AI 面板,体验一致)
 *   保持 /chat URL 仍可访问,导航/书签/SEO 都不破坏
 *
 * 2026-07-31 修复(用户反馈 web 端登录弹窗"乱七八糟"挡住 AI 对话内容):
 * - 未登录时,/chat 路由不再复用 /home(避免 marketing 首页 + AI 面板被弹窗挡的内容混乱)
 * - 改为显示简洁的"请登录"友好引导 + 自动打开 LoginDialog
 * - 登录后切换为 home 内容(包含 AISidePanel),体验一致
 * - 不跳独立 /login 路由(用户偏好"弹窗而非独立页",与 user profile 偏好一致)
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { MessageSquare, Sparkles } from 'lucide-react'

import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useMounted } from '@/hooks/use-mounted'
import { Button } from '@ihui/ui-react'

import WorkAreaHomePage from '../home/page'

export default function ChatPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const open = useLoginDialogStore((s) => s.open)
  const mounted = useMounted()
  const t = useTranslations('chat')
  const tc = useTranslations('common')

  // 未登录:挂载后自动打开 LoginDialog
  // 守卫:openGuard 在 @/lib/login-dialog-trigger 中已实现(全局去重,防并发弹窗)
  React.useEffect(() => {
    if (mounted && !isAuthenticated) {
      open('login')
    }
  }, [mounted, isAuthenticated, open])

  // hydration-safe:挂载前显示极简占位,避免 SSR/CSR 不一致
  if (!mounted) {
    return <div className="flex h-[calc(100vh-58px)] items-center justify-center" />
  }

  // 未登录:显示友好引导(替代 marketing 首页,避免被弹窗挡的内容混乱)
  if (!isAuthenticated) {
    return (
      <div className="flex h-[calc(100vh-58px)] items-center justify-center px-4 min-[768px]:px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquare className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            {t('loginRequiredTitle') || '登录后开始 AI 对话'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t('loginRequiredDesc') ||
              '登录后即可与 AI 智能体对话,支持多模型切换、附件上传、深度思考等功能'}
          </p>
          <Button type="button" onClick={() => open('login')} className="mt-6 gap-1.5">
            <Sparkles className="h-4 w-4" />
            <span>{tc('login')}</span>
          </Button>
        </div>
      </div>
    )
  }

  // 已登录:显示 home 内容(包含 AISidePanel)
  return <WorkAreaHomePage />
}
