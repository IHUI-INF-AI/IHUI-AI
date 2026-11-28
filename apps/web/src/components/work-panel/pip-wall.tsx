// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { LayoutGrid, Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { PipSessionRef } from '@ihui/types'

import { AiPipMonitor } from '@/components/browser-pip/ai-pip-monitor'

/**
 * 多会话同屏监看 —— 2026-11-26 立。
 *
 * 一个工作面 tab 内用网格同时渲染最多 6 个 Browser Hub 会话的只读 MJPEG 画面;
 * 每格独立 `AiPipMonitor`,独立连接、任务条、检查点、接管。与单会话 pip 的差别
 * 只有布局:把 1 格放大换成 N 格并排,协议和状态机完全复用。
 */
/**
 * 4 路以上每格只保留 8fps：6 路全速会把 6 条 MJPEG 同时压进浏览器解码器，
 * 小格监看不需要 15–30fps；1–3 路仍走全速，保持放大核对时的流畅度。
 */
export function resolvePipWallStreamFps(count: number): number | undefined {
  return count > 3 ? 8 : undefined
}

export function PipWall({
  sessions,
  onHandover,
}: {
  sessions: PipSessionRef[]
  onHandover: (session: PipSessionRef) => void
}) {
  const t = useTranslations('aiChat.pictureInPicture')
  const count = Math.min(6, sessions.length)
  const streamFps = resolvePipWallStreamFps(count)

  return (
    <div className="flex h-full w-full flex-col bg-[#05070a]" data-testid="pip-wall">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 text-[10px] text-slate-400">
        <LayoutGrid className="h-3 w-3 text-slate-500" />
        <span className="font-medium tracking-wide text-slate-200">{t('monitorWall')}</span>
        <span className="rounded-md border border-stroke-subtle bg-white/[0.04] px-1.5 py-0.5 text-[9px]">
          {t('monitorWallCount', { count })}
        </span>
        <span className="hidden truncate text-slate-500 md:inline" title={t('monitorWallHint')}>
          {t('monitorWallHint')}
        </span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-stroke-subtle bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-300">
          <Lock className="h-2.5 w-2.5" />
          {t('readOnly')}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        <div className="grid h-full min-h-[160px] auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session, index) => (
            <div
              key={session.sessionId}
              data-testid={`pip-wall-cell-${session.sessionId}`}
              className="flex min-h-[160px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#080b10]"
            >
              <div className="flex h-6 shrink-0 items-center gap-1.5 border-b border-white/[0.07] px-2 text-[10px] text-slate-400">
                <span className="font-mono text-[9px] text-slate-500">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="truncate" title={session.title || session.url}>
                  {session.title || session.url}
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <AiPipMonitor
                  sessionId={session.sessionId}
                  embedded
                  streamFps={streamFps}
                  onHandover={() => onHandover(session)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
