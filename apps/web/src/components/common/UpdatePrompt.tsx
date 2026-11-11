// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/** D194 错误分型(2026-09-30 立):revoked = 版本已撤回/资产 404,check-failed = 检查失败,其余通用 */
export type UpdateErrorKind = 'revoked' | 'check-failed' | 'generic'

/**
 * D194 更新错误判据(纯函数):feed/资产 404、平台键缺失、"包已下架"都判 revoked ——
 * 这类错误重试永远失败,界面必须如实说"这个版本已不再提供",不得并显"网络失败请重试"。
 * check_failed / check_timeout 是 useUpdater 的内部检查失败码,单独分型。
 */
export function classifyUpdateError(error: string | null | undefined): UpdateErrorKind {
  if (!error) return 'generic'
  if (error === 'check_failed' || error === 'check_timeout') return 'check-failed'
  const lowered = error.toLowerCase()
  if (
    lowered.includes('404') ||
    lowered.includes('no longer available') ||
    lowered.startsWith('unsupported target ')
  ) {
    return 'revoked'
  }
  return 'generic'
}

/**
 * UpdatePrompt — 桌面端应用更新下拉提示窗(2026-07-31 立,平台独占:仅桌面端)。
 *
 * 设计(2026-11-12 视觉收口后的真实形态):
 * - 从顶部滑入 + 缩放 + 淡入(0.45s 弹性入场,`animate-update-slide-in`)
 * - 图标微脉动:仅 available 态,2s 周期 1→1.08 缩放
 * - 卡片本体**没有任何发光/旋转光环** —— 旧注释曾写"整卡发光呼吸 + conic-gradient
 *   旋转边框",但那些 CSS 从未与 AGENTS.md §4「不要蓝色发光边框」兼容,且 ::before
 *   外发光会被卡片自身的 overflow-hidden 裁掉。现口径:一层实线 border + bg-card,
 *   颜色全部走 --color-* 令牌,明暗主题自动反转。
 * - 位置让开桌面端自绘顶栏(decorations:false,顶栏约 50px):top-14 起,不压标签栏与拖动区
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
  // up-to-date(2026-09-21):托盘手动检查发现已是最新时的反馈提示,4 秒后自动消失
  const visible =
    status === 'available' ||
    status === 'downloading' ||
    status === 'installing' ||
    status === 'done' ||
    status === 'up-to-date' ||
    status === 'error'

  if (!visible) return null

  const version = session?.info.version ?? ''
  const notes = session?.info.notes ?? ''
  const percent = Math.round(progress * 100)
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress)

  // 是否显示持续性动效(available 状态时整卡+按钮+图标都有动效)
  const isAnimated = status === 'available'

  // D194:错误分型 —— revoked 显示"这个版本已不再提供。",check-failed 显示检查失败,
  // 两者都不得并显通用失败文案("更新过程中出现错误,请重试"计数必须为 0)
  const errorKind = classifyUpdateError(error)
  const errorText =
    errorKind === 'revoked'
      ? t('revoked')
      : errorKind === 'check-failed'
        ? t('checkFailed')
        : t('errorDesc')

  return (
    <div
      className={cn(
        // top-14(56px)让开自绘顶栏:GlobalTopBar 是 pt-1/pb-1 + h-9(桌面 8+36+6≈50px),
        // 旧值 top-4 会把卡片压在标签栏与窗口拖动区上,窄窗口下直接盖住前两个标签。
        'fixed left-1/2 top-14 z-modal w-80 max-w-[calc(100vw-2rem)]',
        '-translate-x-1/2',
      )}
      role="alert"
      // role=alert 已隐含 aria-live=assertive,不再重复声明;进度条那行单独 aria-live=off
      // (百分比每 tick 变一次,整卡 assertive 会把读屏用户刷成连播)。
      aria-atomic="false"
    >
      <div
        className={cn(
          // 旧版的 update-orbit-border / update-card-glow 已在 globals.css 整族删除
          // (硬编码靛蓝 rgba(129,140,248,…) 发光,违反 §4),类名一并去掉,避免留下死类引用。
          'animate-update-slide-in overflow-hidden rounded-xl border border-border bg-card',
        )}
      >
        <div className="relative z-10 p-3">
          {/* 头部:图标 + 标题 + 版本号 */}
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                status === 'error'
                  ? 'bg-danger/10 text-danger-text'
                  : status === 'done' || status === 'up-to-date'
                    ? 'bg-success/10 text-success-text'
                    : 'bg-primary/10 text-primary',
                isAnimated && 'animate-update-icon-pulse',
              )}
            >
              {status === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : status === 'done' || status === 'up-to-date' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="truncate text-body font-semibold leading-tight text-foreground">
                {status === 'error'
                  ? t('error')
                  : status === 'up-to-date'
                    ? t('upToDate')
                    : status === 'done'
                      ? t('done')
                      : t('available')}
              </p>
              {version && status !== 'error' && (
                <p className="text-label text-muted-foreground leading-tight mt-0.5">v{version}</p>
              )}
            </div>
          </div>

          {/* 更新说明(release notes,最多 3 行) */}
          {notes && status !== 'error' && status !== 'done' && (
            <p className="mt-2.5 text-label leading-relaxed text-muted-foreground line-clamp-3">
              {notes}
            </p>
          )}

          {/* 错误信息(D194:按 classifyUpdateError 分型取词,撤回态不并显通用失败) */}
          {status === 'error' && (
            <p className="mt-2.5 text-label leading-relaxed text-danger-text">{errorText}</p>
          )}

          {/* 状态展示区(强制更新:无按钮,纯展示进度) */}
          <div className="mt-3.5 flex items-center gap-2.5">
            {status === 'up-to-date' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-success/10 px-4">
                <span className="truncate text-body font-medium text-success-text">
                  {t('upToDateDesc')}
                </span>
              </div>
            )}

            {status === 'available' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-cta/10 px-4">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span className="text-body font-medium text-primary">{t('preparing')}</span>
              </div>
            )}

            {status === 'downloading' && (
              <div
                className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-cta/10 px-4"
                aria-live="off"
              >
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
                <span className="text-body font-medium text-primary tabular-nums">{percent}%</span>
                {total > 0 && (
                  <span className="text-label text-muted-foreground tabular-nums">
                    {formatFileSize(downloaded)} / {formatFileSize(total)}
                  </span>
                )}
              </div>
            )}

            {status === 'installing' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-cta/10 px-4">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span className="text-body font-medium text-primary">{t('installing')}</span>
              </div>
            )}

            {status === 'done' && (
              <div className="flex flex-col gap-2">
                <div className="flex h-9 items-center justify-center gap-2 rounded-lg bg-success/10 px-4">
                  <span className="truncate text-body font-medium text-success-text tabular-nums">
                    {t('autoRestartIn', { countdown: restartCountdown })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void postponeRestart()}
                    className="h-8 flex-1 rounded-sm border border-border bg-card px-3 text-label font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {t('restartLater')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void restartNow()}
                    className="h-8 flex-1 rounded-sm bg-cta px-3 text-label font-medium text-cta-foreground transition-colors hover:bg-cta/90"
                  >
                    {t('restartNow')}
                  </button>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-danger/10 px-4">
                {retryCount < maxRetries ? (
                  <>
                    <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-danger-text" />
                    <span className="truncate text-body font-medium text-danger-text">
                      {t('autoRetrying')}
                    </span>
                  </>
                ) : (
                  <span className="truncate text-body font-medium text-danger-text">{errorText}</span>
                )}
              </div>
            )}
          </div>

          {/* 下载进度条(细线,downloading/installing 时显示) */}
          {(status === 'downloading' || status === 'installing') && (
            <div className="mt-2 h-0.5 w-full overflow-hidden rounded-sm bg-cta/10">
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
