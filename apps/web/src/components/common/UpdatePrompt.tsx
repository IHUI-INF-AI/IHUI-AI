// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, Check, AlertCircle, Sparkles } from 'lucide-react'
import { useUpdater, type UpdateStatus } from '@/hooks/use-updater'
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

/** 标题可取的 i18n 键(字面量联合:next-intl 的 t 只接受已知键,不能喂 string)。 */
export type UpdateTitleKey =
  'available' | 'downloading' | 'installing' | 'done' | 'upToDate' | 'error'

/**
 * 标题取词(2026-11-12 立):标题必须反映**当前阶段**,不能全程写"发现新版本"。
 *
 * 立因(实测):downloading 时进度环已跑到 44%,标题还停在"发现新版本"——
 * 是在描述一个已经完成的动作。对读屏用户更糟:进度那一行刻意 `aria-live="off"`
 * (百分比每 tick 变一次,整卡 assertive 会刷成连播),于是标题成了下载阶段**唯一**
 * 会被播报的内容,写"发现新版本"等于整段下载静音。
 * i18n 里 `downloading` 键五语种都在,此前无人引用(死键),说明原设计本就打算分阶段取词。
 *
 * installing 分支保留:该态当前被 startDownload 末尾两次同步 setState 批处理合并,
 * 结构上不可观察。此处仍按状态给词,是为了让它一旦可观察时不会回落成"发现新版本"。
 */
export function updateTitleKey(status: UpdateStatus): UpdateTitleKey {
  switch (status) {
    case 'downloading':
      return 'downloading'
    case 'installing':
      return 'installing'
    case 'done':
      return 'done'
    case 'up-to-date':
      return 'upToDate'
    case 'error':
      return 'error'
    default:
      return 'available'
  }
}

/**
 * UpdatePrompt — 桌面端应用更新下拉提示窗(2026-07-31 立,平台独占:仅桌面端)。
 *
 * 设计(2026-11-13 多端统一收口后的真实形态):
 * - 从顶部纯下滑入场(0.3s,`animate-update-banner-in`,无缩放)—— 与 PWA 可选更新 / RN 端更新卡入场语义对齐
 * - 状态退场(关闭 / 状态推进到 idle)时上滑退场(`animate-update-banner-out`),与入场对称,与 PWA / RN 两端一致
 * - 图标微脉动:仅 available 态,2s 周期 1→1.08 缩放
 * - 卡片本体**没有任何发光/旋转光环** —— 旧注释曾写"整卡发光呼吸 + conic-gradient
 *   旋转边框",但那些 CSS 从未与 AGENTS.md §4「不要蓝色发光边框」兼容,且 ::before
 *   外发光会被卡片自身的 overflow-hidden 裁掉。现口径:一层实线 border + bg-card,
 *   颜色全部走 --color-* 令牌,明暗主题自动反转。
 * - 位置让开桌面端自绘顶栏(decorations:false,顶栏约 50px):top-14 起,不压标签栏与拖动区
 *
 * 状态(强制更新,无按钮,纯展示进度)。标题按 updateTitleKey 分阶段取词,
 * 不再全程写"发现新版本":
 * - available:下拉窗 + "发现新版本" + "正在准备更新..."(自动进入下载)
 * - downloading:标题"下载中" + 进度环(role=progressbar)+ 百分比 + 下载量
 * - installing:标题"安装中" + 旋转图标。注意该态当前被 startDownload 末尾两次
 *   同步 setState 批处理合并,**结构上不可观察**;取词分支先留好,不谎称可见。
 * - done:标题"更新完成" + "即将自动重启..."(60 秒倒计时,提供"稍后重启" / "立即重启"按钮)
 * - error:标题"更新失败" + 错误提示 + "自动重试中..."(最多3次,之后自动消失)
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

  // 挂载保持 + 对称退场(2026-11-13 多端统一收口):
  // visible 翻 false 时不立即卸载,先播上滑(animate-update-banner-out),动画结束再卸载,
  // 与 PWA 可选更新 / RN 两端更新卡退场语言一致(都是顶部横幅 + 滑入/滑出)。
  // 注意:status 离开可见集时 updater 即时数据(progress/session…)会归零/清空,
  // 故捕捉最后一帧展示值,退场期间沿用,避免空白卡闪一下。
  const [render, setRender] = React.useState(visible)
  const [leaving, setLeaving] = React.useState(false)

  const computeView = () => {
    const version = session?.info.version ?? ''
    const notes = session?.info.notes ?? ''
    const percent = Math.round(progress * 100)
    const dashOffset = RING_CIRCUMFERENCE * (1 - progress)
    // D194:错误分型 —— revoked 显示"这个版本已不再提供。",check-failed 显示检查失败,
    // 两者都不得并显通用失败文案("更新过程中出现错误,请重试"计数必须为 0)
    const errorKind = classifyUpdateError(error)
    const errorText =
      errorKind === 'revoked'
        ? t('revoked')
        : errorKind === 'check-failed'
          ? t('checkFailed')
          : t('errorDesc')
    return {
      status,
      version,
      notes,
      percent,
      dashOffset,
      downloaded,
      total,
      errorKind,
      errorText,
      retryCount,
      maxRetries,
      restartCountdown,
    }
  }
  const lastView = React.useRef(computeView())
  if (visible && !leaving) lastView.current = computeView()
  // 常态用实时值;退场期间(visible 已 false)沿用最后一帧,避免内容随 idle 归零闪空白
  const view = visible ? computeView() : lastView.current

  React.useEffect(() => {
    if (visible) {
      setRender(true)
      setLeaving(false)
    } else if (render && !leaving) {
      setLeaving(true)
    }
  }, [visible, render, leaving])

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    // 只响应退场动画自身结束(屏蔽子元素 pulse 等冒泡上来的 animationend)
    if (leaving && e.animationName === 'ihui-update-banner-out') {
      setRender(false)
      setLeaving(false)
    }
  }

  if (!render) return null

  const {
    version,
    notes,
    percent,
    dashOffset,
    downloaded: vDownloaded,
    total: vTotal,
    errorText,
    retryCount: rc,
    maxRetries: mr,
    restartCountdown: rcd,
    status: vStatus,
  } = view

  // 是否显示持续性动效(available 状态时整卡+按钮+图标都有动效)
  const isAnimated = vStatus === 'available'

  return (
    <div
      className={cn(
        // top-14(56px)让开自绘顶栏:GlobalTopBar 是 pt-1/pb-1 + h-9(桌面 8+36+6≈50px),
        // 旧值 top-4 会把卡片压在标签栏与窗口拖动区上,窄窗口下直接盖住前两个标签。
        // 桌面端有自绘顶栏故用 top-14;PWA/browser 无此栏用 top-3(见 GlobalShell)——
        // 两者所在表面不同,偏移不同是正确而非漂移;多端统一守卫只钉"动画语义"不钉绝对像素。
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
          // 纯下滑入场 / 上滑退场(无缩放),与 PWA 可选更新、RN 端更新卡入场语义完全一致;
          // leaving 时切到 banner-out 播退场,onAnimationEnd 收尾卸载(对称于 RN 的 render 挂载保持)。
          leaving ? 'animate-update-banner-out' : 'animate-update-banner-in',
          'overflow-hidden rounded-xl border border-border bg-card',
        )}
        onAnimationEnd={handleAnimationEnd}
      >
        <div className="relative z-10 p-3">
          {/* 头部:图标 + 标题 + 版本号 */}
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                vStatus === 'error'
                  ? 'bg-danger/10 text-danger-text'
                  : vStatus === 'done' || vStatus === 'up-to-date'
                    ? 'bg-success/10 text-success-text'
                    : 'bg-primary/10 text-primary',
                isAnimated && 'animate-update-icon-pulse',
              )}
            >
              {vStatus === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : vStatus === 'done' || vStatus === 'up-to-date' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="truncate text-body font-semibold leading-tight text-foreground">
                {t(updateTitleKey(vStatus))}
              </p>
              {version && vStatus !== 'error' && (
                <p className="text-label text-muted-foreground leading-tight mt-0.5">v{version}</p>
              )}
            </div>
          </div>

          {/* 更新说明(release notes,最多 3 行) */}
          {notes && vStatus !== 'error' && vStatus !== 'done' && (
            <p className="mt-2.5 text-label leading-relaxed text-muted-foreground line-clamp-3">
              {notes}
            </p>
          )}

          {/* 错误信息(D194:按 classifyUpdateError 分型取词,撤回态不并显通用失败) */}
          {vStatus === 'error' && (
            <p className="mt-2.5 text-label leading-relaxed text-danger-text">{errorText}</p>
          )}

          {/* 状态展示区(强制更新:无按钮,纯展示进度) */}
          <div className="mt-3.5 flex items-center gap-2.5">
            {vStatus === 'up-to-date' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-success/10 px-4">
                <span className="truncate text-body font-medium text-success-text">
                  {t('upToDateDesc')}
                </span>
              </div>
            )}

            {vStatus === 'available' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-cta/10 px-4">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span className="text-body font-medium text-primary">{t('preparing')}</span>
              </div>
            )}

            {vStatus === 'downloading' && (
              <div
                className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-cta/10 px-4"
                aria-live="off"
              >
                {/* 进度环 */}
                {/* role/aria-*:此前这个 svg 无 role 也无 aria-value,读屏只能靠父行
                    aria-live="off" 之外的标题猜进度;补成标准 progressbar 后,辅助技术
                    能读到真实 0-100。aria-label 用标题键复用同一套词,不再新造文案键。 */}
                <svg
                  className="h-5 w-5 -rotate-90"
                  viewBox="0 0 36 36"
                  fill="none"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t('downloading')}
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
                <span className="text-body font-medium text-primary tabular-nums">{percent}%</span>
                {vTotal > 0 && (
                  <span className="text-label text-muted-foreground tabular-nums">
                    {formatFileSize(vDownloaded)} / {formatFileSize(vTotal)}
                  </span>
                )}
              </div>
            )}

            {vStatus === 'installing' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-cta/10 px-4">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                <span className="text-body font-medium text-primary">{t('installing')}</span>
              </div>
            )}

            {vStatus === 'done' && (
              // w-full:父级是 flex,不给宽度这一列会缩到内容宽 —— 实测按钮行止于 x=757
              // 而卡片内容右缘 867,右侧空出 110px,倒计时条与按钮跟上方状态条不对齐。
              <div className="flex w-full flex-col gap-2">
                <div className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-success/10 px-4">
                  <span className="truncate text-body font-medium text-success-text tabular-nums">
                    {t('autoRestartIn', { countdown: rcd })}
                  </span>
                </div>
                <div className="flex w-full items-center gap-2">
                  {/* 圆角跟卡内状态条/图标容器统一 rounded-lg(8px),旧值 rounded-sm(4px) 在此
                      8px 圆角体系里读起来像没对齐的直角块 */}
                  <button
                    type="button"
                    onClick={() => void postponeRestart()}
                    className="h-8 flex-1 rounded-lg border border-border bg-card px-3 text-label font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {t('restartLater')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void restartNow()}
                    className="h-8 flex-1 rounded-lg bg-cta px-3 text-label font-medium text-cta-foreground transition-colors hover:bg-cta/90"
                  >
                    {t('restartNow')}
                  </button>
                </div>
              </div>
            )}

            {vStatus === 'error' && (
              <div className="flex h-9 flex-1 items-center justify-center gap-2.5 rounded-lg bg-danger/10 px-4">
                {rc < mr ? (
                  <>
                    <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-danger-text" />
                    <span className="truncate text-body font-medium text-danger-text">
                      {t('autoRetrying')}
                    </span>
                  </>
                ) : (
                  <span className="truncate text-body font-medium text-danger-text">
                    {errorText}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 下载进度条(细线,downloading/installing 时显示) */}
          {(vStatus === 'downloading' || vStatus === 'installing') && (
            <div className="mt-2 h-0.5 w-full overflow-hidden rounded-sm bg-cta/10">
              <div
                className={cn(
                  'h-full rounded-sm bg-primary transition-[width] duration-300 ease-out',
                  vStatus === 'installing' && 'animate-update-ring-pulse',
                )}
                style={{ width: `${Math.max(percent, 2)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
