'use client'

import * as React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@ihui/ui'
import { useTranslations } from 'next-intl'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { LoginFormContent } from './LoginFormContent'
import { RegisterFormContent } from './RegisterFormContent'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export function LoginDialog() {
  const t = useTranslations('auth')
  const router = useRouter()
  const isOpen = useLoginDialogStore((s) => s.isOpen)
  const mode = useLoginDialogStore((s) => s.mode)
  const close = useLoginDialogStore((s) => s.close)
  const setMode = useLoginDialogStore((s) => s.setMode)

  const handleLoginSuccess = React.useCallback(() => {
    const redirectUrl = useLoginDialogStore.getState().redirectUrl
    close()
    if (redirectUrl && redirectUrl !== window.location.pathname + window.location.search) {
      router.push(redirectUrl)
    }
  }, [close, router])

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="
          sm:rounded-xl
          gap-0
          p-0
          max-w-[460px]
          w-[calc(100%-2rem)]
          max-h-[95vh]
          overflow-y-auto
          shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.08)]
        "
      >
        <DialogTitle className="sr-only">
          {mode === 'login'
            ? t('loginTitle')
            : mode === 'register'
              ? t('registerTitle')
              : t('forgotPassword')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {mode === 'login'
            ? t('loginSubtitle')
            : mode === 'register'
              ? t('registerSubtitle')
              : t('forgotSubtitle')}
        </DialogDescription>

        <div className="flex items-center justify-center gap-3 px-6 pt-5 pb-5 bg-gradient-to-b from-background to-muted/40 rounded-t-xl">
          {/* 顶部 logo 与 welcome 图左右并排布局(M-66,2026-07-19):
              - flex row,items-center 让 logo 与 welcome 视觉中心对齐
              - logo 固定 52×52(w-[52px] h-[52px],与原 80×80 同比缩小以腾出 welcome 横向空间)
              - welcome 区 h-[52px] w-full max-w-[348px] 绝对定位叠加 light/dark 两版本
              - 52 + gap-3(12) + 348 = 412,刚好等于 dialog 容器 460 - 2*24 内宽
              - 欢迎图自然宽 52*447/67 ≈ 347px,正好填满 348 容器且不变形
              - (M-67,2026-07-19) logo 加 translate-y 微调,精确计算:
                  · logo.png 是 2534×2534 黑底方形,内容范围 23.5%-76.4%,内容高度 52.9% 容器高度
                  · welcome.svg 主文字 y 范围 20.625-55(占 viewBox 67 高度的 30.8%-82.1%,偏下 14.9%)
                  · welcome 文字在 52 容器中:顶 16px 留白,底 9.3px 留白 → 文字中心 70.4
                  · logo 内容在 52 容器中:顶 12.2px 留白,底 12.3px 留白 → 内容中心 50%(box 中心)
                  · box 顶 baseline 对齐(translate-y=0):logo 顶 41 = welcome 顶 41,但内容中心差 4.9px(logo 内容靠上)
                  · (M-68,2026-07-19) 改为 translate-y-[5px] 二次调优:
                      logo 顶 46,box 中心 72.1,内容中心 70.5 ≈ welcome 文字中心 70.4
                      让 box 整体下移 5px("logo 偏高"反馈 → 整体下沉),同时让 logo 内部内容与 welcome 文字**几乎完美对齐**(0.1px)
                      box 中心差 5px = "logo 整体略低 5px",与 box 内容中心差 0.1px 的视觉对齐形成"差不多高度"双指标平衡
                  · 父级 padding 同步改 pt-5 pb-5 对称,腾出 5px 让 logo 下移不溢出 */}
          <Image
            src="/images/logo.png?v=20260719-login"
            alt="IHUI AI"
            width={52}
            height={52}
            className="h-[52px] w-[52px] shrink-0 select-none rounded-xl translate-y-[5px]"
            draggable={false}
            unoptimized
            priority
          />
          <div className="relative h-[52px] w-full max-w-[348px]">
            <Image
              src="/images/welcome.svg"
              alt="Welcome to IHUI AI"
              width={447}
              height={67}
              className="welcome-img absolute inset-0 m-auto h-full w-auto"
              loading="eager"
              unoptimized
            />
            <Image
              src="/images/baiwelcome.svg"
              alt=""
              aria-hidden="true"
              width={447}
              height={67}
              className="welcome-img-dark absolute inset-0 m-auto h-full w-auto"
              loading="eager"
              unoptimized
            />
          </div>
        </div>

        <div className="px-6 pb-6 pt-4">
          {mode === 'login' ? (
            <LoginFormContent onSuccess={handleLoginSuccess} />
          ) : mode === 'register' ? (
            <RegisterFormContent onSuccess={() => setMode('login')} />
          ) : (
            <ForgotPasswordForm />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
