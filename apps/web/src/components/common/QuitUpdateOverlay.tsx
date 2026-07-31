'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, Download, Check } from 'lucide-react'
import { useQuitUpdateGuard } from '@/hooks/use-quit-update-guard'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/tauri-bridge'

/**
 * QuitUpdateOverlay — 退出时自动更新遮罩(2026-07-31 立,平台独占:仅桌面端)。
 *
 * 当用户退出应用(托盘"退出" / Ctrl+Q)时拦截退出流程,显示全屏遮罩:
 * - checking: 检查更新中(旋转图标 + "正在检查更新...")
 * - downloading: 下载更新中(进度条 + 百分比 + 下载量)
 * - restarting: 更新完成,正在重启(勾选图标 + "正在重启...")
 * - quitting: 正常退出中(旋转图标 + "正在退出...")
 *
 * checking / downloading 状态不显示任何按钮(强制更新,不可跳过)。
 * restarting / quitting 状态同样无按钮(进程即将结束)。
 *
 * 浏览器端 useQuitUpdateGuard 返回 visible=false,组件渲染 null。
 * AGENTS.md §4 UI 约束:rounded-xl、无蓝色发光边框、无分割线、无渐变遮罩。
 */
export function QuitUpdateOverlay() {
  const t = useTranslations('common.update')
  const guard = useQuitUpdateGuard()
  const { visible, status, progress, downloaded, total } = guard

  if (!visible || !status) return null

  const percent = Math.round(progress * 100)
  const isChecking = status === 'checking'
  const isDownloading = status === 'downloading'
  const isRestarting = status === 'restarting'

  const statusText = isChecking
    ? t('quitChecking')
    : isDownloading
      ? t('quitDownloading')
      : isRestarting
        ? t('quitRestarting')
        : t('quitQuitting')

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="alertdialog"
      aria-live="assertive"
      aria-label={statusText}
    >
      <div className="animate-update-slide-in w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="p-5">
          {/* 图标 + 状态文字 */}
          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl',
                isRestarting
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-primary/10 text-primary',
              )}
            >
              {isRestarting ? (
                <Check className="h-6 w-6" />
              ) : isDownloading ? (
                <Download className="h-6 w-6" />
              ) : (
                <RefreshCw className="h-6 w-6 animate-spin" />
              )}
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">
                {statusText}
              </p>
              {isDownloading && total > 0 && (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {percent}% · {formatFileSize(downloaded)} / {formatFileSize(total)}
                </p>
              )}
            </div>
          </div>

          {/* 下载进度条 */}
          {isDownloading && (
            <div className="mt-4 h-1 w-full overflow-hidden rounded-sm bg-primary/10">
              <div
                className="h-full rounded-sm bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(progress * 100, 2)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
