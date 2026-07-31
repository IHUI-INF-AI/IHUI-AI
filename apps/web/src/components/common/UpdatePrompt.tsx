'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { X, RefreshCw, Check, AlertCircle, Sparkles, Download } from 'lucide-react'
import { useUpdater } from '@/hooks/use-updater'
import { cn } from '@/lib/utils'
import { formatFileSize } from '@/lib/tauri-bridge'

/** 进度环半径(circumference ≈ 100,便于 strokeDasharray 计算)。 */
const RING_R = 15.915
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R

/**
 * UpdatePrompt — 桌面端应用更新下拉提示窗(2026-07-31 立,平台独占:仅桌面端)。
 *
 * 设计(v2 增强动效版):
 * - 从屏幕顶部滑入 + 缩放 + 淡入(0.45s 弹性入场)
 * - 整卡发光呼吸:品牌色光晕 2.4s 周期脉冲扩散
 * - 卡片边框旋转光环:conic-gradient 渐变 4s/圈沿边框旋转
 * - 按钮旋转光环:conic-gradient 双段光环 2.5s/圈 + 外发光模糊
 * - 图标微脉动:2s 周期 1→1.08 缩放
 * - 无顶部彩条(已移除,改为整卡动效)
 *
 * 状态:
 * - available:下拉窗 + 旋转光环"立即更新"按钮
 * - downloading:进度环 + 百分比 + 下载量
 * - installing:旋转图标 + "安装中"
 * - done:勾选动画 + "重启应用"按钮
 * - error:错误提示 + "重试"按钮
 *
 * 浏览器端 useUpdater 返回 idle,组件渲染 null。
 * AGENTS.md §4 UI 约束:compact 紧凑、rounded-xl、无蓝色发光边框、无分割线、无渐变遮罩。
 */
export function UpdatePrompt() {
  const t = useTranslations('common.update')
  const updater = useUpdater()
  const [dismissed, setDismissed] = React.useState(false)

  const { status, session, progress, downloaded, total, error } = updater

  // 下拉窗可见条件:有可用更新且未被用户关闭(下载/安装中不可关闭)
  const canDismiss = status === 'available' || status === 'error' || status === 'done'
  const visible =
    !dismissed &&
    (status === 'available' ||
      status === 'downloading' ||
      status === 'installing' ||
      status === 'done' ||
      status === 'error')

  // 状态变化时重置 dismissed(新检查周期)
  React.useEffect(() => {
    if (status === 'available' || status === 'checking') {
      setDismissed(false)
    }
  }, [status])

  const handleDismiss = React.useCallback(() => {
    if (!canDismiss) return
    setDismissed(true)
    if (status === 'error') {
      updater.dismiss()
    }
  }, [canDismiss, status, updater])

  const handleUpdate = React.useCallback(() => {
    void updater.downloadAndInstall()
  }, [updater])

  const handleRestart = React.useCallback(() => {
    void updater.restart()
  }, [updater])

  const handleRetry = React.useCallback(() => {
    void updater.checkForUpdate(false)
  }, [updater])

  if (!visible) return null

  const version = session?.info.version ?? ''
  const notes = session?.info.notes ?? ''
  const percent = Math.round(progress * 100)
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress)

  // 是否显示持续性动效(available 状态时整卡+按钮+图标都有动效)
  const isAnimated = status === 'available'

  return (
    <div
      className={cn(
        'fixed left-1/2 top-4 z-modal w-80 max-w-[calc(100vw-2rem)]',
        '-translate-x-1/2',
      )}
      role="alert"
      aria-live="assertive"
    >
      <div
        className={cn(
          'animate-update-slide-in update-orbit-border overflow-hidden rounded-xl border border-border bg-card',
          isAnimated && 'update-card-glow',
        )}
      >
        <div className="relative z-10 p-4">
          {/* 头部:图标 + 标题 + 版本号 + 关闭按钮 */}
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                status === 'error'
                  ? 'bg-red-500/10 text-red-500'
                  : status === 'done'
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-primary/10 text-primary',
                isAnimated && 'animate-update-icon-pulse',
              )}
            >
              {status === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : status === 'done' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight text-foreground">
                {status === 'error'
                  ? t('error')
                  : status === 'done'
                    ? t('done')
                    : t('available')}
              </p>
              {version && status !== 'error' && (
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                  v{version}
                </p>
              )}
            </div>

            {canDismiss && (
              <button
                onClick={handleDismiss}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={t('dismiss')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* 更新说明(release notes,最多 3 行) */}
          {notes && status !== 'error' && status !== 'done' && (
            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground line-clamp-3">
              {notes}
            </p>
          )}

          {/* 错误信息 */}
          {status === 'error' && (
            <p className="mt-2.5 text-xs leading-relaxed text-red-500/80">
              {error === 'check_failed' ? t('checkFailed') : t('errorDesc')}
            </p>
          )}

          {/* 操作按钮区 */}
          <div className="mt-3.5 flex items-center gap-2.5">
            {status === 'available' && (
              <div className="update-btn-orbit-glow flex-1">
                <button
                  onClick={handleUpdate}
                  className={cn(
                    'update-btn-orbit flex h-9 w-full items-center justify-center gap-1.5',
                    'rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground',
                    'transition-colors hover:brightness-110 active:brightness-95',
                    'focus:outline-none',
                  )}
                >
                  <Download className="h-4 w-4" />
                  <span>{t('updateNow')}</span>
                </button>
              </div>
            )}

            {status === 'downloading' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-primary/10 px-4">
                {/* 进度环 */}
                <svg
                  className="h-5 w-5 -rotate-90"
                  viewBox="0 0 36 36"
                  fill="none"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r={RING_R}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-primary/20"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r={RING_R}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={dashOffset}
                    className="text-primary transition-[stroke-dashoffset] duration-300 ease-out"
                  />
                </svg>
                <span className="text-sm font-medium text-primary tabular-nums">
                  {percent}%
                </span>
                {total > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatFileSize(downloaded)} / {formatFileSize(total)}
                  </span>
                )}
              </div>
            )}

            {status === 'installing' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-primary/10 px-4">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium text-primary">
                  {t('installing')}
                </span>
              </div>
            )}

            {status === 'done' && (
              <button
                onClick={handleRestart}
                className={cn(
                  'flex h-9 flex-1 items-center justify-center gap-1.5',
                  'rounded-lg bg-green-600 px-4 text-sm font-medium text-white',
                  'transition-colors hover:bg-green-600/90 active:bg-green-600/80',
                  'focus:outline-none focus-visible:bg-green-600/90',
                )}
              >
                <RefreshCw className="h-4 w-4" />
                <span>{t('restart')}</span>
              </button>
            )}

            {status === 'error' && (
              <button
                onClick={handleRetry}
                className={cn(
                  'flex h-9 flex-1 items-center justify-center gap-1.5',
                  'rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground',
                  'transition-colors hover:bg-primary/90 active:bg-primary/80',
                )}
              >
                <RefreshCw className="h-4 w-4" />
                <span>{t('retry')}</span>
              </button>
            )}
          </div>

          {/* 下载进度条(细线,downloading/installing 时显示) */}
          {(status === 'downloading' || status === 'installing') && (
            <div className="mt-2 h-0.5 w-full overflow-hidden rounded-sm bg-primary/10">
              <div
                className={cn(
                  'h-full rounded-sm bg-primary transition-[width] duration-300 ease-out',
                  status === 'installing' && 'animate-update-ring-pulse',
                )}
                style={{ width: `${Math.max(progress * 100, 2)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
