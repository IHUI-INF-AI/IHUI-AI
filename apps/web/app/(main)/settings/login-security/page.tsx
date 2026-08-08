'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast as sonnerToast } from 'sonner'
import {
  LogIn,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  Copy,
  Check,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Switch,
  Button,
  Input,
  Label,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import {
  fetchLoginPreferences,
  saveLoginPreferences,
  type LoginPreferences,
} from '@/lib/login-preferences'
import { startAutoRefresh, stopAutoRefresh } from '@/lib/tokenUtils'
import { fetchApi } from '@/lib/api'

/** 记住天数(与后端 refresh TTL 对齐) */
const REMEMBER_DAYS = 30

/* ============ MFA 类型 ============ */

interface MfaStatusData {
  enabled: boolean
  enabledAt: string | null
  backupCodesRemaining: number
}

interface MfaSetupData {
  secret: string
  qrUri: string
  qrDataUrl: string
}

interface MfaEnableData {
  enabled: boolean
  recoveryCodes: string[]
}

/* ============ Passkey 类型 ============ */

/**
 * 后端 /api/auth/passkey/register/options 返回的选项 JSON 形态。
 * @simplewebauthn/server 生成的 options 中 challenge / user.id /
 * excludeCredentials[].id 均为 base64url 字符串,navigator.credentials.create
 * 需要 BufferSource,故前端需在传入前转换。
 */
interface PasskeyRegistrationOptionsJSON {
  rp?: { name?: string; id?: string }
  user?: { id: string; name?: string; displayName?: string }
  challenge: string
  pubKeyCredParams?: Array<{ type: string; alg: number }>
  timeout?: number
  attestation?: string
  excludeCredentials?: Array<{ id: string; type: string; transports?: string[] }>
  authenticatorSelection?: {
    authenticatorAttachment?: string
    residentKey?: string
    requireResidentKey?: boolean
    userVerification?: string
  }
  extensions?: Record<string, unknown>
}

interface PasskeyRegisterOptionsData {
  options: PasskeyRegistrationOptionsJSON
  challengeId: string
}

/** navigator.credentials.create 结果的 JSON 可序列化形态(转发给 register/verify)。 */
interface SerializedRegistrationCredential {
  id: string
  rawId: string
  type: string
  response: {
    clientDataJSON: string
    attestationObject: string
    transports: string[]
  }
  clientExtensionResults: AuthenticationExtensionsClientOutputs
}

interface PasskeyRegisterVerifyData {
  verified: boolean
  credentialId: string
}

/* ============ WebAuthn 编码辅助 ============ */

/** base64url 字符串 → Uint8Array(challenge / credentialId 等需在 create 前转换)。 */
function base64urlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Uint8Array → base64url 字符串(create 结果序列化时用)。 */
function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 后端 JSON 选项 → navigator.credentials.create 所需的 PublicKeyCredentialCreationOptions。 */
function toPublicKeyCredentialCreationOptions(
  json: PasskeyRegistrationOptionsJSON,
): PublicKeyCredentialCreationOptions {
  const options: PublicKeyCredentialCreationOptions = {
    rp: (json.rp ?? { name: '', id: window.location.hostname }) as PublicKeyCredentialRpEntity,
    user: {
      id: base64urlToUint8Array(json.user?.id ?? ''),
      name: json.user?.name ?? '',
      displayName: json.user?.displayName ?? '',
    },
    challenge: base64urlToUint8Array(json.challenge),
    pubKeyCredParams: (json.pubKeyCredParams ?? []) as PublicKeyCredentialParameters[],
    excludeCredentials: (json.excludeCredentials ?? []).map((c) => ({
      type: 'public-key' as const,
      id: base64urlToUint8Array(c.id),
      ...(c.transports ? { transports: c.transports as AuthenticatorTransport[] } : {}),
    })),
  }
  if (json.timeout !== undefined) options.timeout = json.timeout
  if (json.attestation) options.attestation = json.attestation as AttestationConveyancePreference
  if (json.authenticatorSelection) {
    options.authenticatorSelection = json.authenticatorSelection as AuthenticatorSelectionCriteria
  }
  if (json.extensions) options.extensions = json.extensions as AuthenticationExtensionsClientInputs
  return options
}

/** 将 create 返回的 PublicKeyCredential 序列化为后端可解析的 JSON 形态。 */
function serializeRegistrationCredential(
  cred: PublicKeyCredential,
): SerializedRegistrationCredential {
  const att = cred.response as AuthenticatorAttestationResponse
  return {
    id: cred.id,
    rawId: uint8ArrayToBase64url(new Uint8Array(cred.rawId)),
    type: cred.type,
    response: {
      clientDataJSON: uint8ArrayToBase64url(new Uint8Array(att.clientDataJSON)),
      attestationObject: uint8ArrayToBase64url(new Uint8Array(att.attestationObject)),
      transports: typeof att.getTransports === 'function' ? att.getTransports() : [],
    },
    clientExtensionResults: cred.getClientExtensionResults(),
  }
}

/** 时间展示:ISO → 本地可读格式。 */
function formatDateTime(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

export default function LoginSecurityPage() {
  const t = useTranslations('settings')
  const s = useTranslations('eduAi.security')

  const [prefs, setPrefs] = React.useState<LoginPreferences>({
    autoLogin: false,
    autoRenew: true,
  })
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [toast, setToast] = React.useState<'ok' | 'err' | null>(null)

  // MFA 状态
  const [mfaStatus, setMfaStatus] = React.useState<MfaStatusData | null>(null)
  const [mfaLoading, setMfaLoading] = React.useState(true)
  const [mfaSetup, setMfaSetup] = React.useState<MfaSetupData | null>(null)
  const [mfaToken, setMfaToken] = React.useState('')
  const [mfaBusy, setMfaBusy] = React.useState(false)
  const [mfaError, setMfaError] = React.useState<string | null>(null)
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null)
  const [recoveryDialogOpen, setRecoveryDialogOpen] = React.useState(false)
  const [recoveryCanClose, setRecoveryCanClose] = React.useState(false)
  const [disableOpen, setDisableOpen] = React.useState(false)
  const [disablePassword, setDisablePassword] = React.useState('')
  const [disableError, setDisableError] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  // Passkey 状态
  const [passkeyBusy, setPasskeyBusy] = React.useState(false)
  const [passkeyError, setPasskeyError] = React.useState<string | null>(null)

  // 初始化:从后端拉取偏好
  React.useEffect(() => {
    let active = true
    void (async () => {
      const p = await fetchLoginPreferences()
      if (active) {
        setPrefs(p)
        setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // 初始化:拉取 MFA 状态(刷新页面恢复)
  React.useEffect(() => {
    let active = true
    void (async () => {
      const res = await fetchApi<MfaStatusData>('/api/mfa/status')
      if (active && res.success) {
        setMfaStatus(res.data)
        if (!res.data.enabled) setMfaSetup(null)
      }
      if (active) setMfaLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  // 恢复码弹窗:2 秒后才能关闭(强制保存提醒)
  React.useEffect(() => {
    if (!recoveryDialogOpen) {
      setRecoveryCanClose(false)
      return
    }
    const timer = setTimeout(() => setRecoveryCanClose(true), 2000)
    return () => clearTimeout(timer)
  }, [recoveryDialogOpen])

  const showToast = (kind: 'ok' | 'err') => {
    setToast(kind)
    setTimeout(() => setToast(null), 2000)
  }

  const update = async (next: Partial<LoginPreferences>) => {
    setSaving(true)
    const merged = { ...prefs, ...next }
    setPrefs(merged)
    const saved = await saveLoginPreferences(next)
    setSaving(false)
    if (saved) {
      setPrefs(saved)
      showToast('ok')
      // autoRenew 切换:实时启停自动续期
      if (next.autoRenew !== undefined) {
        if (next.autoRenew) startAutoRefresh()
        else stopAutoRefresh()
      }
    } else {
      showToast('err')
      setPrefs(prefs) // 回滚
    }
  }

  const loadMfaStatus = React.useCallback(async () => {
    const res = await fetchApi<MfaStatusData>('/api/mfa/status')
    if (res.success) setMfaStatus(res.data)
  }, [])

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      sonnerToast.success(s('success'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      sonnerToast.error(s('error'))
    }
  }

  /* ============ MFA 操作 ============ */

  const startMfaSetup = async () => {
    setMfaBusy(true)
    setMfaError(null)
    setMfaToken('')
    const res = await fetchApi<MfaSetupData>('/api/mfa/setup', { method: 'POST' })
    setMfaBusy(false)
    if (res.success) setMfaSetup(res.data)
    else setMfaError(res.error)
  }

  const enableMfa = async () => {
    if (!mfaSetup || mfaToken.trim().length !== 6) return
    setMfaBusy(true)
    setMfaError(null)
    const res = await fetchApi<MfaEnableData>('/api/mfa/enable', {
      method: 'POST',
      body: JSON.stringify({ secret: mfaSetup.secret, token: mfaToken.trim() }),
    })
    setMfaBusy(false)
    if (res.success) {
      setRecoveryCodes(res.data.recoveryCodes)
      setRecoveryDialogOpen(true)
      setMfaSetup(null)
      setMfaToken('')
      sonnerToast.success(s('success'))
      void loadMfaStatus()
    } else {
      setMfaError(res.error)
    }
  }

  const regenerateRecoveryCodes = async () => {
    setMfaBusy(true)
    setMfaError(null)
    const res = await fetchApi<{ recoveryCodes: string[] }>('/api/mfa/recovery-codes', {
      method: 'POST',
    })
    setMfaBusy(false)
    if (res.success) {
      setRecoveryCodes(res.data.recoveryCodes)
      setRecoveryDialogOpen(true)
      void loadMfaStatus()
    } else {
      setMfaError(res.error)
    }
  }

  const disableMfa = async () => {
    if (!disablePassword) return
    setMfaBusy(true)
    setDisableError(null)
    const res = await fetchApi<{ enabled: boolean }>('/api/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password: disablePassword }),
    })
    setMfaBusy(false)
    if (res.success) {
      setDisableOpen(false)
      setDisablePassword('')
      sonnerToast.success(s('success'))
      void loadMfaStatus()
    } else {
      setDisableError(res.error)
    }
  }

  const copyRecoveryCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      sonnerToast.success(s('success'))
    } catch {
      sonnerToast.error(s('error'))
    }
  }

  /* ============ Passkey 操作 ============ */

  const addPasskey = async () => {
    setPasskeyBusy(true)
    setPasskeyError(null)
    try {
      // WebAuthn 仅 secure context(https / localhost)可用
      if (
        typeof navigator === 'undefined' ||
        typeof navigator.credentials === 'undefined' ||
        typeof window.PublicKeyCredential === 'undefined'
      ) {
        setPasskeyError(s('passkeyNotSupported'))
        return
      }
      // 1. 获取注册选项(challenge 为 base64url 字符串)
      const optRes = await fetchApi<PasskeyRegisterOptionsData>(
        '/api/auth/passkey/register/options',
        { method: 'POST' },
      )
      if (!optRes.success) {
        setPasskeyError(optRes.error)
        return
      }
      const { options, challengeId } = optRes.data

      // 2. 转换二进制字段后调用浏览器 WebAuthn
      const creationOptions = toPublicKeyCredentialCreationOptions(options)
      const credential = (await navigator.credentials.create({
        publicKey: creationOptions,
      })) as PublicKeyCredential | null
      if (!credential) {
        setPasskeyError(s('error'))
        return
      }

      // 3. 序列化响应并发送验证
      const response = serializeRegistrationCredential(credential)
      const verifyRes = await fetchApi<PasskeyRegisterVerifyData>(
        '/api/auth/passkey/register/verify',
        {
          method: 'POST',
          body: JSON.stringify({ challengeId, response }),
        },
      )
      if (!verifyRes.success) {
        setPasskeyError(verifyRes.error)
        return
      }
      sonnerToast.success(s('success'))
    } catch (e) {
      setPasskeyError(e instanceof Error ? e.message : String(e))
    } finally {
      setPasskeyBusy(false)
    }
  }

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      {/* 自动登录 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogIn className="h-4 w-4" />
            {t('loginSecurity.autoLoginTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('loginSecurity.autoLoginDesc')}</p>
              <p className="text-xs text-muted-foreground">
                {t('loginSecurity.rememberDays', { days: REMEMBER_DAYS })}
              </p>
            </div>
            {loading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={prefs.autoLogin}
                disabled={saving}
                onCheckedChange={(v) => update({ autoLogin: v })}
                aria-label={t('loginSecurity.autoLoginTitle')}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* 自动续期 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" />
            {t('loginSecurity.autoRenewTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t('loginSecurity.autoRenewDesc')}</p>
              <p className="text-xs text-muted-foreground">
                {prefs.autoRenew ? t('loginSecurity.autoRenewOn') : t('loginSecurity.autoRenewOff')}
              </p>
            </div>
            {loading ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={prefs.autoRenew}
                disabled={saving}
                onCheckedChange={(v) => update({ autoRenew: v })}
                aria-label={t('loginSecurity.autoRenewTitle')}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* 两步验证(MFA) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            {s('mfaTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{s('mfaDesc')}</p>

          {mfaLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : mfaStatus?.enabled ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {s('mfaEnabled')}
                </Badge>
                {mfaStatus.enabledAt && (
                  <span className="text-xs text-muted-foreground">
                    {s('enabledAt')}: {formatDateTime(mfaStatus.enabledAt)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {s('backupCodesRemaining')}: {mfaStatus.backupCodesRemaining}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={regenerateRecoveryCodes}
                  disabled={mfaBusy}
                >
                  {mfaBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {s('regenerateCodes')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDisableError(null)
                    setDisablePassword('')
                    setDisableOpen(true)
                  }}
                  disabled={mfaBusy}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {s('disableMfa')}
                </Button>
              </div>
            </>
          ) : mfaSetup ? (
            <>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                {mfaSetup.qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL 二维码无需 next/image 优化
                  <img
                    src={mfaSetup.qrDataUrl}
                    alt={s('scanQr')}
                    className="h-36 w-36 shrink-0 rounded-md border"
                  />
                )}
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-muted-foreground">{s('scanQr')}</p>
                  <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                    <code className="flex-1 break-all font-mono text-xs">{mfaSetup.secret}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyText(mfaSetup.secret)}
                      className="shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {s('copySecret')}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="mfa-token">{s('verifyCode')}</Label>
                  <Input
                    id="mfa-token"
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    inputMode="numeric"
                    placeholder="123456"
                    disabled={mfaBusy}
                  />
                </div>
                <Button onClick={enableMfa} disabled={mfaBusy || mfaToken.trim().length !== 6}>
                  {mfaBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {s('enableConfirm')}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMfaSetup(null)}
                disabled={mfaBusy}
              >
                {s('cancel')}
              </Button>
            </>
          ) : (
            <Button onClick={startMfaSetup} disabled={mfaBusy}>
              {mfaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {s('enableMfa')}
            </Button>
          )}

          {mfaError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {mfaError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Passkey 免密登录 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            {s('passkeyTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{s('passkeyDesc')}</p>
          <Button onClick={addPasskey} disabled={passkeyBusy} size="sm">
            {passkeyBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {s('addPasskey')}
          </Button>
          {passkeyError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {passkeyError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-notification -translate-x-1/2 rounded-md px-4 py-2 text-sm shadow-md ${
            toast === 'ok'
              ? 'bg-foreground text-background'
              : 'bg-destructive text-destructive-foreground'
          }`}
        >
          {toast === 'ok' ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              {t('loginSecurity.saveSuccess')}
            </span>
          ) : (
            t('loginSecurity.saveFailed')
          )}
        </div>
      )}

      {/* 恢复码弹窗(仅显示一次) */}
      <Dialog
        open={recoveryDialogOpen}
        onOpenChange={(o) => {
          if (!o && recoveryCanClose) setRecoveryDialogOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{s('backupCodes')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{s('saveCodesWarning')}</p>
            </div>
            {recoveryCodes && (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {recoveryCodes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => copyRecoveryCode(code)}
                    title={s('copySecret')}
                    className="cursor-pointer rounded-md border bg-muted/30 px-3 py-1.5 text-left font-mono text-xs hover:bg-muted/60"
                  >
                    {code}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setRecoveryDialogOpen(false)} disabled={!recoveryCanClose} className="w-full min-[640px]:w-auto">
              {s('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 禁用两步验证弹窗 */}
      <Dialog
        open={disableOpen}
        onOpenChange={(o) => {
          if (!o && !mfaBusy) setDisableOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{s('disableMfa')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="mfa-password">{s('enterPassword')}</Label>
              <Input
                id="mfa-password"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                disabled={mfaBusy}
                autoComplete="current-password"
              />
            </div>
            {disableError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {disableError}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDisableOpen(false)}
              disabled={mfaBusy}
              className="flex-1 min-[640px]:flex-none"
            >
              {s('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={disableMfa}
              disabled={mfaBusy || !disablePassword}
              className="flex-1 min-[640px]:flex-none"
            >
              {mfaBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {s('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
