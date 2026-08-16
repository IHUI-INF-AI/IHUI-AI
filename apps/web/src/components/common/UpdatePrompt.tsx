'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, Check, AlertCircle, Sparkles } from 'lucide-react'
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
 * 状态(强制更新,无按钮,纯展示进度):
 * - available:下拉窗 + "正在准备更新..."(自动进入下载)
 * - downloading:进度环 + 百分比 + 下载量
 * - installing:旋转图标 + "安装中"
 * - done:勾选 + "即将自动重启..."(60 秒倒计时,提供"稍后重启" / "立即重启"按钮)
 * - error:错误提示 + "自动重试中..."(最多3次,之后自动消失)
 *
 * 浏览器端 useUpdater 返回 idle,组件渲染 null。
 * AGENTS.md §4 UI 约束:compact 紧凑、rounded-xl、无蓝色发光边框、无分割线、无渐变遮罩。
 */
export function UpdatePrompt() {
  const t = useTranslations('common.update')
  const updater = useUpdater()

  const { status, session, progress, downloaded, total, error, retryCount, maxRetries } = updater
  const { restartNow, postponeRestart, restartCountdown } = updater
  // 强制更新:弹窗始终可见(不可关闭),直到更新完成自动重启或失败后自动重试/自动消失
  const visible =
    status === 'available' ||
    status === 'downloading' ||
    status === 'installing' ||
    status === 'done' ||
    status === 'error'

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
          {/* 头部:图标 + 标题 + 版本号 */}
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
                {status === 'error' ? t('error') : status === 'done' ? t('done') : t('available')}
              </p>
              {version && status !== 'error' && (
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">v{version}</p>
              )}
            </div>
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

          {/* 状态展示区(强制更新:无按钮,纯展示进度) */}
          <div className="mt-3.5 flex items-center gap-2.5">
            {status === 'available' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-primary/10 px-4">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium text-primary">{t('preparing')}</span>
              </div>
            )}

            {status === 'downloading' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-primary/10 px-4">
                {/* 进度环 */}
                <svg className="h-5 w-5 -rotate-90" viewBox="0 0 36 36" fill="none">
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
                <span className="text-sm font-medium text-primary tabular-nums">{percent}%</span>
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
                <span className="text-sm font-medium text-primary">{t('installing')}</span>
              </div>
            )}

            {status === 'done' && (
              <div className="flex flex-col gap-2">
                <div className="flex h-9 items-center justify-center gap-2 rounded-lg bg-green-600/10 px-4">
                  <span className="text-sm font-medium text-green-600 tabular-nums">
                    {t('autoRestartIn', { countdown: restartCountdown })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void postponeRestart()}
                    className="h-8 flex-1 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {t('restartLater')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void restartNow()}
                    className="h-8 flex-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {t('restartNow')}
                  </button>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-red-500/10 px-4">
                {retryCount < maxRetries ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-red-500" />
                    <span className="text-sm font-medium text-red-500">{t('autoRetrying')}</span>
                  </>
                ) : (
                  <span className="text-sm font-medium text-red-500">
                    {error === 'check_failed' ? t('checkFailed') : t('errorDesc')}
                  </span>
                )}
              </div>
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
