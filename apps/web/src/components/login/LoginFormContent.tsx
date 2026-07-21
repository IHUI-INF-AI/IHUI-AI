'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { ThirdPartyLoginButtons } from './ThirdPartyLoginButtons'
import { QrCodeLogin } from './QrCodeLogin'
import { PasswordLoginForm } from './PasswordLoginForm'
import { EmailCodeLoginForm } from './EmailCodeLoginForm'
import { PhoneCodeLoginForm } from './PhoneCodeLoginForm'
import { AgreementNoticeDialog } from './AgreementNoticeDialog'
import { useLoginDialogStore } from '@/stores/login-dialog'

type LoginTab = 'email' | 'phone' | 'password' | 'qr'

interface LoginFormContentProps {
  onSuccess?: () => void
}

export function LoginFormContent({ onSuccess }: LoginFormContentProps) {
  const t = useTranslations('auth')
  const qc = useQueryClient()
  const setMode = useLoginDialogStore((s) => s.setMode)
  const [tab, setTab] = React.useState<LoginTab>('email')
  const [agreed, setAgreed] = React.useState(false)
  const [showAgreeErr, setShowAgreeErr] = React.useState(false)
  const [noticeOpen, setNoticeOpen] = React.useState(false)
  // 记录弹窗打开前的焦点元素(用于关闭后恢复,修 3 步 Enter 第 3 步焦点丢失问题,2026-07-21)
  const lastFocusRef = React.useRef<HTMLElement | null>(null)

  // 协议未勾选 → 改为弹出精美通知窗(2026-07-21 立,3 步 Enter 键盘流)
  // 第 1 步 Enter:触发此回调 → 记录当前焦点 → 打开通知窗(Agree 按钮自动聚焦)
  // 第 2 步 Enter:弹窗内 Agree 按钮激活 → setAgreed(true) + 关闭通知窗 + 恢复焦点
  // 第 3 步 Enter:焦点已回到原 input → 表单 onSubmit → agreed=true 走真实登录
  const handleRequireAgree = React.useCallback(() => {
    // 记录当前焦点元素(用户正在输入的 input),弹窗关闭后恢复
    lastFocusRef.current = (document.activeElement as HTMLElement) || null
    setShowAgreeErr(true)
    setNoticeOpen(true)
  }, [])

  const handleNoticeAgree = React.useCallback(() => {
    setAgreed(true)
    setShowAgreeErr(false)
    setNoticeOpen(false)
    // 弹窗关闭后,恢复焦点到原 input,让用户再按 Enter 能触发 form submit
    // (Radix Dialog focus trap 卸载后焦点会丢失到 body,不恢复则第 3 步 Enter 无目标)
    setTimeout(() => {
      const target = lastFocusRef.current
      if (target && document.contains(target)) {
        target.focus()
      } else {
        // 兜底:聚焦表单第一个可输入 input
        const form = document.querySelector('form')
        const firstInput = form?.querySelector(
          'input:not([type="hidden"]):not([disabled])',
        ) as HTMLInputElement | null
        firstInput?.focus()
      }
    }, 100)
  }, [])

  const handleNoticeCancel = React.useCallback(() => {
    setNoticeOpen(false)
  }, [])

  const handleSuccess = () => {
    onSuccess?.()
    qc.invalidateQueries({ queryKey: ['header'] })
    qc.invalidateQueries({ queryKey: ['announcements'] })
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as LoginTab)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="email" data-testid="login-tab-email">
            {t('emailLogin')}
          </TabsTrigger>
          <TabsTrigger value="phone" data-testid="login-tab-phone">
            {t('phoneCodeLogin')}
          </TabsTrigger>
          <TabsTrigger value="password" data-testid="login-tab-password">
            {t('passwordLogin')}
          </TabsTrigger>
          <TabsTrigger value="qr" data-testid="login-tab-qr">
            {t('qrLogin')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <EmailCodeLoginForm
            active={tab === 'email'}
            onSuccess={handleSuccess}
            agreed={agreed}
            onAgreedChange={(v) => {
              setAgreed(v)
              if (v) setShowAgreeErr(false)
            }}
            onRequireAgree={handleRequireAgree}
            showAgreeErr={showAgreeErr}
          />
        </TabsContent>

        <TabsContent value="phone">
          <PhoneCodeLoginForm
            active={tab === 'phone'}
            onSuccess={handleSuccess}
            agreed={agreed}
            onAgreedChange={(v) => {
              setAgreed(v)
              if (v) setShowAgreeErr(false)
            }}
            onRequireAgree={handleRequireAgree}
            showAgreeErr={showAgreeErr}
          />
        </TabsContent>

        <TabsContent value="password">
          <PasswordLoginForm
            active={tab === 'password'}
            onSuccess={handleSuccess}
            agreed={agreed}
            onAgreedChange={(v) => {
              setAgreed(v)
              if (v) setShowAgreeErr(false)
            }}
            onRequireAgree={handleRequireAgree}
            showAgreeErr={showAgreeErr}
          />
        </TabsContent>

        <TabsContent value="qr">
          <QrCodeLogin onSwitchMethod={() => setTab('email')} />
        </TabsContent>
      </Tabs>

      <ThirdPartyLoginButtons />

      <p className="text-center text-sm text-muted-foreground">
        {t('noAccount')}{' '}
        <button
          type="button"
          onClick={() => setMode('register')}
          className="font-medium text-primary hover:underline"
        >
          {t('registerNow')}
        </button>
      </p>

      <AgreementNoticeDialog
        open={noticeOpen}
        onAgree={handleNoticeAgree}
        onCancel={handleNoticeCancel}
      />
    </div>
  )
}
