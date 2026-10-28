// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * Passkey(WebAuthn)登录入口(G-874,2026-10-22 立)
 *
 * 平台特有:依赖浏览器 DOM 的 WebAuthn API(PublicKeyCredential / navigator.credentials)。
 * 小程序与 RN 无 WebAuthn 能力,本入口只由 web 端注入 apiClient.passkeyAuthOptions/Verify 后
 * 才渲染;小程序端按 §9 平台豁免(不改小程序代码)。
 *
 * 闭环:POST /api/auth/passkey/auth/options → @simplewebauthn/browser startAuthentication
 *       → POST /api/auth/passkey/auth/verify → onSuccess(LoginResult)。
 * 三态用户可见反馈:成功(onSuccess 交给调用方落地会话)、用户取消(NotAllowedError/AbortError)、
 * 浏览器不支持(PublicKeyCredential 缺失)。
 */

import * as React from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'

import { Button } from '../button'
import { cn } from '../../lib/utils'
import type { LoginApiClient, LoginResult } from './types'

export interface PasskeyLoginButtonProps {
  /** i18n 翻译函数(与 LoginForm 同一个,复用 web 词表既有键) */
  t: (key: string, params?: Record<string, string | number>) => string
  apiClient: LoginApiClient
  onSuccess?: (result: LoginResult) => void | Promise<void>
  className?: string
}

/** WebAuthn 仅在 secure context(https / localhost)且浏览器实现完整时可用。 */
function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials !== 'undefined'
  )
}

/** 用户取消 WebAuthn 仪式时浏览器抛出的错误名(不同内核一致)。 */
function isUserCancelled(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('name' in error)) return false
  const name = (error as { name?: unknown }).name
  return name === 'NotAllowedError' || name === 'AbortError'
}

export function PasskeyLoginButton({
  t,
  apiClient,
  onSuccess,
  className,
}: PasskeyLoginButtonProps) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleClick = async () => {
    const getOptions = apiClient.passkeyAuthOptions
    const verify = apiClient.passkeyAuthVerify
    if (!getOptions || !verify) return
    if (!isPasskeySupported()) {
      setError(t('eduAi.security.passkeyNotSupported'))
      return
    }

    setBusy(true)
    setError(null)
    try {
      const optionsRes = await getOptions()
      if (!optionsRes.success) {
        setError(optionsRes.error || t('auth.loginFailed'))
        return
      }
      // 懒加载:避免 Next.js SSR 阶段求值浏览器专用模块
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const assertion = await startAuthentication({
        optionsJSON: optionsRes.data.options as PublicKeyCredentialRequestOptionsJSON,
      })
      const verifyRes = await verify(optionsRes.data.challengeId, assertion)
      if (!verifyRes.success) {
        setError(verifyRes.error || t('auth.loginFailed'))
        return
      }
      await onSuccess?.(verifyRes.data)
    } catch (e) {
      setError(
        isUserCancelled(e)
          ? t('auth.thirdParty.loginCancelled', { platform: 'Passkey' })
          : t('auth.loginFailed'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('space-y-1', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleClick}
        disabled={busy}
        data-testid="login-passkey-button"
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
        <span>{t('eduAi.security.passkeyTitle')}</span>
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert" data-testid="login-passkey-error">
          {error}
        </p>
      )}
    </div>
  )
}
