'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Shield, FileText, Lock, ArrowUpRight, CornerDownLeft } from 'lucide-react'

import { Dialog, DialogContent, DialogTitle, DialogDescription, Button } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface AgreementNoticeDialogProps {
  open: boolean
  onAgree: () => void
  onCancel: () => void
}

/**
 * 登录协议确认弹窗(2026-07-21 立)
 *
 * 触发场景:登录表单提交但未勾选"我已阅读并同意"复选框时弹出。
 *
 * 键盘交互流(2026-07-21 立,3 步 Enter):
 *   1. 表单按 Enter → 触发 onSubmit → 检测未同意 → 打开本弹窗
 *   2. 弹窗打开后:document 级 keydown 监听器捕获 Enter → 调用 onAgree
 *      (等价于点击"同意"按钮)→ 父组件把 agreed 置 true + 关闭弹窗
 *      视觉上同时尝试把焦点设到"同意"按钮(给用户焦点环反馈)
 *   3. 焦点回到原输入框,再按 Enter → 触发表单 onSubmit → agreed=true 走真实登录
 *
 * 视觉规范(2026-07-21 精品化):
 *   - 容器 max-w-[420px] rounded-xl p-7 配 subtle 双层阴影
 *   - 顶部圆形 shield icon(48px bg-primary/10) + 标题 + 副标题
 *   - 中段:两条协议卡片(FileText/Lock 图标 + 标题 + ArrowUpRight),hover 描边变 primary
 *   - 安全提示:Lock 小图标 + 加密说明
 *   - 底部:两按钮 + Enter 键提示徽章(教学键盘流)
 */
export function AgreementNoticeDialog({ open, onAgree, onCancel }: AgreementNoticeDialogProps) {
  const t = useTranslations('auth')
  const agreeBtnRef = React.useRef<HTMLButtonElement>(null)

  // 弹窗打开时聚焦"同意并继续"按钮(视觉反馈),并装 document 级 Enter 监听
  // (核心:即使焦点没成功设到按钮,Enter 也能直接触发同意)
  React.useEffect(() => {
    if (!open) return

    // 视觉:尝试把焦点设到"同意"按钮(失败也不影响功能)
    const focusAgree = () => {
      const btn = agreeBtnRef.current
      if (btn && document.activeElement !== btn) {
        try {
          btn.focus()
        } catch {
          /* noop */
        }
      }
    }
    const raf = requestAnimationFrame(focusAgree)
    const t1 = window.setTimeout(focusAgree, 50)
    const t2 = window.setTimeout(focusAgree, 200)

    // 核心:document 级 keydown 监听,Enter 直接触发同意
    // 不依赖焦点位置,鲁棒性 100%
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const target = e.target as HTMLElement | null
      // 排除:多行文本输入(contenteditable)
      if (target?.tagName === 'TEXTAREA' || target?.isContentEditable) return
      // 排除:链接(让默认行为触发跳转)
      if (target?.closest('a')) return
      // 排除:Disagree 按钮(让默认行为触发取消)
      if (target?.closest('[data-testid="agreement-notice-disagree"]')) return
      e.preventDefault()
      e.stopPropagation()
      onAgree()
    }
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open, onAgree])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        className={cn(
          'sm:rounded-xl gap-0 p-0 max-w-[420px] w-[calc(100%-2rem)]',
          'border-0 bg-transparent shadow-none',
        )}
      >
        <div
          className={cn(
            'login-scope relative w-full max-w-[420px] rounded-xl border border-border bg-card p-7',
            'shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.04)]',
          )}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={cn(
                'mb-4 flex h-12 w-12 items-center justify-center rounded-full',
                'bg-primary/10 text-primary ring-1 ring-primary/20',
              )}
            >
              <Shield className="h-6 w-6" strokeWidth={2} />
            </div>
            <DialogTitle className="text-base font-semibold leading-none tracking-tight">
              {t('agreementNoticeTitle')}
            </DialogTitle>
            <DialogDescription className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t('agreementNoticeDesc')}
            </DialogDescription>
          </div>

          {/* 两条协议卡片 */}
          <div className="mt-5 space-y-2">
            <Link
              href="/agreement/user-agreement"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="agreement-notice-terms"
              className={cn(
                'group flex items-center gap-3 rounded-md border border-border bg-background',
                'px-3 py-2.5 text-sm transition-all duration-200',
                'hover:border-primary/40 hover:bg-accent/40',
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                <FileText className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 truncate text-left font-medium text-foreground">
                {t('termsOfService')}
              </span>
              <ArrowUpRight
                className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={2}
              />
            </Link>
            <Link
              href="/agreement/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="agreement-notice-privacy"
              className={cn(
                'group flex items-center gap-3 rounded-md border border-border bg-background',
                'px-3 py-2.5 text-sm transition-all duration-200',
                'hover:border-primary/40 hover:bg-accent/40',
              )}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                <Lock className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 truncate text-left font-medium text-foreground">
                {t('privacyPolicy')}
              </span>
              <ArrowUpRight
                className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={2}
              />
            </Link>
          </div>

          {/* 安全提示条 */}
          <div className="mt-4 flex items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] leading-none text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" />
            <span>{t('agreementNoticeSafe')}</span>
          </div>

          {/* 双按钮 + Enter 键提示 */}
          <div className="mt-5 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-10 flex-1"
              onClick={onCancel}
              data-testid="agreement-notice-disagree"
            >
              {t('agreementNoticeDisagree')}
            </Button>
            <Button
              ref={agreeBtnRef}
              type="button"
              variant="default"
              className="h-10 flex-1 gap-1.5"
              onClick={onAgree}
              data-testid="agreement-notice-agree"
            >
              <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
              {t('agreementNoticeAgree')}
            </Button>
          </div>
          <p className="mt-3 text-center text-[11px] leading-none text-muted-foreground">
            {t('agreementNoticeEnterHint')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
