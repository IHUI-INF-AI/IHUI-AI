// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, Sparkles } from 'lucide-react'
import { useUpdateReady } from '@/hooks/use-update-ready'
import { openExternalUrl } from '@/lib/tauri-bridge'
import { cn } from '@/lib/utils'

/**
 * 更新胶囊（2026-11-24 取代旧 UpdatePrompt 进度横幅）。
 *
 * 只做一件事：新版本已经在磁盘上装好、且当前进程完全没被打断时，右下角常驻一个
 * 胶囊。没有进度环、没有百分比、没有倒计时、没有关闭按钮，也不自动重启。
 * 用户点“立即重启”才交棒；不点也没关系，下次正常打开同样会切到新版。
 */
export function UpdatePrompt() {
  const t = useTranslations('common.update')
  const { status, restarting, restart, rollbackNotice, dismissRollbackNotice } = useUpdateReady()
  const bootstrap = Boolean(status.supported && status.requiresBootstrap && status.available)
  const visible = Boolean(status.supported && status.ready && status.available)
  if (!visible && !bootstrap && !rollbackNotice) return null
  if (!visible && bootstrap) {
    return (
      <div
        className="pointer-events-none fixed inset-x-4 bottom-5 z-[70] flex justify-end sm:inset-x-auto sm:right-6 sm:w-[372px]"
        data-testid="update-bootstrap-pill"
        role="status"
        aria-live="polite"
      >
        <div className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-card backdrop-blur-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cta/10 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-semibold text-foreground">
              {t('bootstrapTitle')}
            </p>
            <p className="mt-0.5 truncate text-label text-muted-foreground">{t('bootstrapBody')}</p>
          </div>
          <button
            type="button"
            onClick={() => void openExternalUrl('https://aizhs.top/')}
            className="h-9 shrink-0 rounded-xl bg-cta px-3.5 text-label font-medium text-cta-foreground transition-colors hover:bg-cta/90"
          >
            {t('bootstrapAction')}
          </button>
        </div>
      </div>
    )
  }
  if (!visible && rollbackNotice) {
    return (
      <div
        className="pointer-events-none fixed inset-x-4 bottom-5 z-[70] flex justify-end sm:inset-x-auto sm:right-6 sm:w-[372px]"
        data-testid="update-rollback-notice"
        role="status"
        aria-live="polite"
      >
        <div className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-card backdrop-blur-md">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning-text">
            <RefreshCw className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-semibold text-foreground">
              {t('rollbackNoticeTitle')}
            </p>
            <p className="mt-0.5 truncate text-label text-muted-foreground">
              {t('rollbackNoticeBody', {
                from: rollbackNotice.from,
                to: rollbackNotice.to,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissRollbackNotice}
            className="h-9 shrink-0 rounded-xl border border-border px-3.5 text-label font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t('rollbackNoticeDismiss')}
          </button>
        </div>
      </div>
    )
  }

  const rollback = status.kind === 'rollback'
  const version = status.available ?? status.current
  const title = rollback ? t('readyRollbackTitle') : t('readyTitle')
  const body = rollback ? t('readyRollbackBody', { version }) : t('readyBody', { version })
  const action = restarting ? t('restarting') : rollback ? t('rollbackNow') : t('readyRestart')

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-5 z-[70] flex justify-end sm:inset-x-auto sm:right-6 sm:w-[372px]"
      data-testid="update-ready-pill"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-border',
          'bg-card/95 p-3 shadow-card backdrop-blur-md',
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cta/10 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 truncate text-label text-muted-foreground">{body}</p>
          {status.mandatory && (
            <p className="mt-1 truncate text-label text-warning-text">{t('mandatoryHint')}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void restart()}
          disabled={restarting}
          className={cn(
            'flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-cta px-3.5',
            'text-label font-medium text-cta-foreground transition-colors hover:bg-cta/90',
            'disabled:cursor-default disabled:opacity-70',
          )}
        >
          {restarting && <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {action}
        </button>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
