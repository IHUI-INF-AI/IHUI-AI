// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * /chat/workbench 路由入口(2026-10-28 立)。
 *
 * 登录门与本目录 /chat(page.tsx)完全同口径:
 * - "还没查完"≠"确认未登录":ready=false 时不弹登录框、不画"请登录"引导;
 * - 未登录终态:自动开 LoginDialog(守卫在 store 内全局去重)+ 简洁引导,不跳独立 /login。
 * 深链:?conversationId=xxx 直达某会话(参数名与 /chat 侧栏深链同档,判据在
 * @ihui/shared/ui/chat-workbench-shell-spec);useSearchParams 需 <Suspense> 边界
 * (output:'export' 模式,与 /chat 同因)。
 */
import * as React from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MessageSquare } from 'lucide-react'

import { useAuthStore } from '@/stores/auth'
import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useMounted } from '@/hooks/use-mounted'
import { Button } from '@ihui/ui-react'
import { WorkbenchShell } from '@/components/chat/workbench/workbench-shell'
import { resolveWorkbenchConversationId } from '@ihui/shared/ui/chat-workbench-shell-spec'

function WorkbenchConversationEntry() {
  const searchParams = useSearchParams()
  const conversationId = resolveWorkbenchConversationId(searchParams.get('conversationId'))
  return <WorkbenchShell conversationId={conversationId} />
}

export default function ChatWorkbenchPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { ready } = useAuthBootstrap()
  const open = useLoginDialogStore((s) => s.open)
  const mounted = useMounted()
  const t = useTranslations('chat')
  const tc = useTranslations('common')

  React.useEffect(() => {
    if (mounted && ready && !isAuthenticated) {
      open('login')
    }
  }, [mounted, ready, isAuthenticated, open])

  if (!mounted || !ready) {
    return <div className="px-4 flex h-[calc(100vh-58px)] items-center justify-center" />
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-[calc(100vh-58px)] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquare className="h-7 w-7 text-primary" aria-hidden />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">{t('loginRequiredTitle')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t('loginRequiredDesc')}
          </p>
          <Button type="button" onClick={() => open('login')} className="mt-6">
            <span>{tc('login')}</span>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={null}>
      <WorkbenchConversationEntry />
    </Suspense>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
