'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Loader2 } from 'lucide-react'
import { toast } from '@/components/common'
import { Modal } from '@/components/feedback'
import { useEnvironmentInfoStore } from '@/stores/environment-info'
import { useAiPanelStore } from '@/stores/ai-panel'
import {
  clearGithubToken,
  pollGithubDeviceToken,
  requestGithubDeviceCode,
  setGithubToken,
} from '@ihui/api-client'

/**
 * GithubConfigDialog — GitHub 连接配置弹窗(2026-08-17,用户需求"跳转网站授权,免手动粘贴 token")。
 *
 * 触发:环境信息弹窗 PR 行"连接 GitHub"入口 → store.githubConfigOpen。
 * 交互(默认走 OAuth Device Flow,手动 token 折叠为高级选项):
 * - 已连接(ghConfigured):绿色徽章 + 仓库 owner/repo + 右侧「清除 Token」
 * - 未连接 → 状态一(idle):主按钮「使用 GitHub 授权」发起 Device Flow
 *          (requestGithubDeviceCode);失败 toast authFail,若 400(未配置 OAuth App)
 *          toast noOAuthConfig 并自动展开手动区
 * - 状态二(auth):展示 user_code + verification_uri +「打开授权页面」;递归 setTimeout
 *          轮询 pollGithubDeviceToken — ok → toast authSuccess + 刷新 + 关闭;
 *          pending → 继续;slow_down → 间隔 +5s;expired / 超时(expiresIn 秒)→ 回状态一
 * - 手动区(折叠,高级):token 输入 + 保存
 */
export function GithubConfigDialog() {
  const t = useTranslations('aiChat.envInfo')
  const tcommon = useTranslations('common')
  const open = useEnvironmentInfoStore((s) => s.githubConfigOpen)
  const closeGithubConfig = useEnvironmentInfoStore((s) => s.closeGithubConfig)
  const githubStatus = useEnvironmentInfoStore((s) => s.githubStatus)
  const fetchGithubStatus = useEnvironmentInfoStore((s) => s.fetchGithubStatus)
  const fetchStatus = useEnvironmentInfoStore((s) => s.fetchStatus)
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)

  const [phase, setPhase] = React.useState<'idle' | 'auth'>('idle')
  const [deviceCode, setDeviceCode] = React.useState('')
  const [userCode, setUserCode] = React.useState('')
  const [verificationUri, setVerificationUri] = React.useState('')
  const [pollInterval, setPollInterval] = React.useState(5)
  const [expiresIn, setExpiresIn] = React.useState(0)
  const [startedAt, setStartedAt] = React.useState(0)
  const [polling, setPolling] = React.useState(false)
  const [showManual, setShowManual] = React.useState(false)
  const [token, setToken] = React.useState('')
  const [busy, setBusy] = React.useState<'save' | 'clear' | 'auth' | null>(null)

  const workspacePath = activeWorkspace?.path ?? null
  const hasToken = githubStatus?.ghConfigured === true
  const repoLabel =
    githubStatus?.owner && githubStatus?.repo ? `${githubStatus.owner}/${githubStatus.repo}` : null

  // 关闭弹窗时重置授权状态,避免下次打开残留轮询/授权码
  React.useEffect(() => {
    if (!open) {
      setPhase('idle')
      setPolling(false)
      setDeviceCode('')
      setUserCode('')
      setVerificationUri('')
      setShowManual(false)
      setToken('')
      setBusy(null)
    }
  }, [open])

  const refresh = () => {
    void fetchGithubStatus(workspacePath)
    void fetchStatus(workspacePath)
  }

  const handleStartAuth = async () => {
    if (busy || !workspacePath) return
    setBusy('auth')
    try {
      const res = await requestGithubDeviceCode({ workspacePath })
      if (!res.success) {
        if (res.status === 400) {
          toast.error(t('noOAuthConfig'))
          setShowManual(true)
        } else {
          toast.error(res.error ?? t('authFail'))
        }
        return
      }
      const d = res.data
      setDeviceCode(d.deviceCode)
      setUserCode(d.userCode)
      setVerificationUri(d.verificationUri)
      setPollInterval(Math.max(1, d.interval))
      setExpiresIn(d.expiresIn)
      setStartedAt(Date.now())
      setPhase('auth')
      setPolling(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('authFail'))
    } finally {
      setBusy(null)
    }
  }

  // Device Flow 轮询:递归 setTimeout(比 setInterval 更易清理),cleanup 取消
  React.useEffect(() => {
    if (!open || phase !== 'auth' || !deviceCode) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    // 局部轮询间隔:slow_down 时累加,不触发 effect 重跑
    let currentInterval = pollInterval * 1000

    const stopAuth = () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      setPhase('idle')
      setPolling(false)
      setDeviceCode('')
      setUserCode('')
      setVerificationUri('')
    }

    const pollOnce = async () => {
      if (cancelled) return
      if (Date.now() - startedAt >= expiresIn * 1000) {
        toast.error(t('authorizeExpired'))
        stopAuth()
        return
      }
      try {
        const res = await pollGithubDeviceToken({ deviceCode })
        if (cancelled) return
        if (!res.success) {
          toast.error(res.error ?? t('authFail'))
          stopAuth()
          return
        }
        if (res.data.status === 'ok') {
          toast.success(t('authSuccess'))
          refresh()
          closeGithubConfig()
          return
        }
        if (res.data.status === 'slow_down') {
          currentInterval += 5000
        } else if (res.data.status === 'expired') {
          toast.error(t('authorizeExpired'))
          stopAuth()
          return
        }
        if (!cancelled) {
          timer = setTimeout(() => void pollOnce(), currentInterval)
        }
      } catch (e) {
        if (cancelled) return
        toast.error(e instanceof Error ? e.message : t('authFail'))
        stopAuth()
      }
    }

    timer = setTimeout(() => void pollOnce(), currentInterval)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // stopAuth/refresh 引用组内 setter 与 store action,均稳定;t 由 next-intl 缓存
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, deviceCode])

  const handleCancelAuth = () => {
    setPhase('idle')
    setPolling(false)
    setDeviceCode('')
    setUserCode('')
    setVerificationUri('')
  }

  const handleCopyCode = async () => {
    if (!userCode) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(userCode)
      } else {
        // 兜底:无 Clipboard API → 临时 textarea + execCommand
        const ta = document.createElement('textarea')
        ta.value = userCode
        ta.setAttribute('readonly', '')
        ta.style.position = 'absolute'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast.success(t('copied'))
    } catch {
      toast.error(t('authFail'))
    }
  }

  const handleOpenAuthPage = () => {
    if (verificationUri) window.open(verificationUri, '_blank')
  }

  const handleSave = async () => {
    if (!workspacePath || !token.trim() || busy) return
    setBusy('save')
    try {
      const res = await setGithubToken({ workspacePath, token: token.trim() })
      if (!res.success) throw new Error(res.error ?? t('tokenSaveFailed'))
      toast.success(t('tokenSaved'))
      closeGithubConfig()
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('tokenSaveFailed'))
    } finally {
      setBusy(null)
    }
  }

  const handleClear = async () => {
    if (busy) return
    setBusy('clear')
    try {
      const res = await clearGithubToken()
      if (!res.success) throw new Error(res.error ?? t('tokenCleared'))
      toast.success(t('tokenCleared'))
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('tokenCleared'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={closeGithubConfig}
      title={t('connectGithub')}
      size="md"
      footer={
        <button
          type="button"
          onClick={() => closeGithubConfig()}
          disabled={busy !== null}
          className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
          data-testid="github-token-cancel"
        >
          {tcommon('cancel')}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {/* 连接状态区 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {hasToken ? (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"
                data-testid="github-status-connected"
              >
                {t('githubConnectedAs')}
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                data-testid="github-status-not-connected"
              >
                {t('notConnected')}
              </span>
            )}
            {repoLabel && (
              <span className="truncate font-mono text-[11px] text-muted-foreground" data-testid="github-repo">
                {repoLabel} · {t('connected')}
              </span>
            )}
          </div>
          {hasToken && (
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={busy !== null}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              data-testid="github-token-clear"
            >
              {busy === 'clear' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {t('tokenClear')}
            </button>
          )}
        </div>

        {!hasToken && phase === 'idle' && (
          <>
            {/* 状态一:未开始 → 主按钮发起 Device Flow */}
            <button
              type="button"
              onClick={() => void handleStartAuth()}
              disabled={busy !== null || !workspacePath}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              data-testid="github-auth-start"
            >
              {busy === 'auth' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {busy === 'auth' ? t('authorizing') : t('authorize')}
            </button>

            {/* 状态三:手动 Token(高级,默认折叠) */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowManual((v) => !v)}
                className="self-start text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {t('manualToken')}
              </button>
              {showManual && (
                <>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={t('tokenPlaceholder')}
                    className="h-8 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
                    data-testid="github-token-input"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="text-[11px] text-muted-foreground" data-testid="github-token-hint">
                    {t('githubTokenHint')}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!token.trim() || busy !== null || !workspacePath}
                    className="inline-flex h-8 items-center justify-center gap-1 self-start rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                    data-testid="github-token-save"
                  >
                    {busy === 'save' && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                    {tcommon('save')}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {!hasToken && phase === 'auth' && (
          <>
            {/* 状态二:等待授权 */}
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t('userCode')}</span>
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent"
                  data-testid="github-copy-code"
                >
                  <Copy className="h-3 w-3" aria-hidden />
                  {t('copyCode')}
                </button>
              </div>
              <code
                className="rounded-md bg-muted px-3 py-2 text-center font-mono text-xl font-semibold tracking-[0.2em]"
                data-testid="github-user-code"
              >
                {userCode}
              </code>
            </div>

            {verificationUri && (
              <a
                href={verificationUri}
                target="_blank"
                rel="noreferrer"
                className="break-all text-xs text-primary underline-offset-2 hover:underline"
                data-testid="github-verification-uri"
              >
                {verificationUri}
              </a>
            )}

            <button
              type="button"
              onClick={handleOpenAuthPage}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-90"
              data-testid="github-open-auth-page"
            >
              {t('openAuthPage')}
            </button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {polling && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              <span>{t('authorizePending')}</span>
            </div>

            <button
              type="button"
              onClick={handleCancelAuth}
              className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {tcommon('cancel')}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

export default GithubConfigDialog
