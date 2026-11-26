// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‍‍​‌​‌‌​‌‌‍‍​‌​​​​​‌‍‍​‌​​‌‌‌‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​​‌‌​‌​‍⁠

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { listBrowserCheckpointAttention, type BrowserCheckpointAttention } from '@ihui/api-client'

import { isTauri, openAiPipWindow } from '@/lib/tauri-bridge'
import { useAuthStore } from '@/stores/auth'
import { useWorkPanelStore } from '@/stores/work-panel'

const POLL_MS = 5_000

/**
 * 对话输入区上方的「浏览器检查点等待」提示条 —— 2026-11-26 立。
 *
 * 文章里的 TRAE 会在对话里提示「该你确认了」;IHUI 的检查点原本只在画中画
 * 任务条里出现,用户关掉小窗就看不到。这里由 Browser Hub 的轻量汇总端点
 * 轮询当前用户仍在等待的检查点,在聊天输入区给出可点的一步:
 * 「去处理」直接打开该会话的画中画,处理完点「已处理,继续」任务才继续。
 *
 * 提示条不是主链路:取数失败静默隐藏,不阻塞聊天输入;同一检查点只展示一次
 * 属于同一轮等待,用户处理后下一次轮询自然消失。
 */
export function BrowserCheckpointNotice() {
  const t = useTranslations('aiChat.pictureInPicture')
  const token = useAuthStore((s) => s.token)
  const openPipSession = useWorkPanelStore((s) => s.openPipSession)
  const [rows, setRows] = useState<BrowserCheckpointAttention[]>([])

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    const schedule = () => {
      timer = window.setTimeout(() => void tick(), POLL_MS)
    }

    const tick = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        schedule()
        return
      }
      try {
        const result = await listBrowserCheckpointAttention()
        if (!cancelled) {
          setRows(result.success && result.data ? result.data.sessions ?? [] : [])
        }
      } catch {
        // 提示条不是主链路:网络/鉴权失败时不打扰聊天,也不保留过期提示。
        if (!cancelled) setRows([])
      }
      if (!cancelled) schedule()
    }

    void tick()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  // 画中画里点「已处理,继续」后，同一窗口立即撤掉提示；失败时下一次轮询会把它带回来。
  // 原生画中画是独立 Tauri 窗口，本地 CustomEvent 出不了那个 webview，所以桌面端
  // 额外通过 Tauri 事件总线把 sessionId 发到 main 窗口，避免多等一轮 5 秒轮询。
  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined

    const dismiss = (sessionId?: string) => {
      if (!sessionId) return
      setRows((prev) => prev.filter((row) => row.session_id !== sessionId))
    }

    const onResumed = (event: Event) => {
      dismiss((event as CustomEvent<{ sessionId?: string }>).detail?.sessionId)
    }
    window.addEventListener('ihui:browser-checkpoint-resumed', onResumed)

    if (isTauri()) {
      void import('@tauri-apps/api/event')
        .then(({ listen }) =>
          listen<{ sessionId?: string }>('ihui:browser-checkpoint-resumed', (event) => {
            dismiss(event.payload?.sessionId)
          }),
        )
        .then((stop) => {
          if (disposed) stop()
          else unlisten = stop
        })
        .catch(() => {
          // 事件总线不可用时保留轮询兜底，不影响提示条主链路。
        })
    }

    return () => {
      disposed = true
      unlisten?.()
      window.removeEventListener('ihui:browser-checkpoint-resumed', onResumed)
    }
  }, [])

  const onHandle = useCallback(() => {
    const first = rows[0]
    if (!first) return
    // 桌面端优先开原生独立画中画：和 TRAE 一样，点一下就从聊天里把
    // 正在等待的浏览器监看窗拉出来，不再先展开右侧工作面。
    if (isTauri() && token) {
      void openAiPipWindow(first.session_id, token).catch(() => {
        // 原生窗创建失败时退回停靠监看，保证这一步仍然可处理。
        openPipSession(
          first.session_id,
          first.url || 'about:blank',
          first.title || first.goal || first.checkpoint.label,
        )
      })
      return
    }
    openPipSession(
      first.session_id,
      first.url || 'about:blank',
      first.title || first.goal || first.checkpoint.label,
    )
  }, [openPipSession, rows, token])

  if (rows.length === 0) return null
  const first = rows[0]!

  return (
    <div
      data-testid="browser-checkpoint-notice"
      role="status"
      className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-3 py-2 text-amber-950 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">{t('checkpointChatTitle')}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed opacity-80">
          {t('checkpointChatBody', { label: first.checkpoint.label })}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] opacity-70">
          {first.timed_out && <span>{t('checkpointChatTimeout')}</span>}
          {rows.length > 1 && <span>{t('checkpointChatMore', { count: rows.length - 1 })}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onHandle}
        className="mt-0.5 inline-flex flex-none items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-900 transition-colors hover:bg-amber-500/25 dark:text-amber-50"
      >
        {t('checkpointChatAction')}
        <ArrowUpRight className="h-3 w-3" />
      </button>
    </div>
  )
}

export default BrowserCheckpointNotice
