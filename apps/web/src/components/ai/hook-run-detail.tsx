// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { AgentHookRunEvent } from '@ihui/shared'
import { Webhook } from 'lucide-react'

import type { HookReadoutTranslate } from '@/components/ai/hook-readout'
import { cn } from '@/lib/utils'

interface HookRunDetailProps {
  /** hook.run 最近一帧(一帧 = 同一次工具调用跑过的全部钩子) */
  run: AgentHookRunEvent
  t: HookReadoutTranslate
}

/**
 * 2026-11-21 第 48 项:hook-run 逐钩子明细块(此前直接写在 800 行面板 JSX 里,单测够不着)。
 *
 * 只呈现"最近一帧",因为一帧本身就是同一工具调用的全部钩子结果;跨帧汇总由
 * `HookReadout`(会话累计/台账回落)负责,两块各司其职、不重复计数。
 * 三态文案与配色集中在 `statusLabel` / `statusTone`,不许在调用方再写第二份。
 */
export function HookRunDetail({ run, t }: HookRunDetailProps) {
  return (
    <div className="mx-2 mt-1.5" data-testid="pane-runtime-hook-runs">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Webhook className="h-3 w-3 shrink-0" aria-hidden />
        <span>{t('runtimeHookRunTitle')}</span>
        <span className="min-w-0 truncate font-mono opacity-70">
          {t('runtimeHookRunMeta', {
            tool: run.toolName ?? '—',
            count: run.hooks.length,
          })}
        </span>
      </div>
      <div className="mt-0.5 space-y-0.5 text-[10px] leading-4">
        {run.hooks.map((hook, i) => (
          <div
            key={`${hook.name}-${i}`}
            className="flex items-center gap-1.5"
            data-hook-status={hook.status}
          >
            <span className={cn('shrink-0', statusTone(hook.status))}>
              {statusLabel(hook.status, t)}
            </span>
            <span className="min-w-0 truncate font-mono text-foreground/80">
              {hook.name}
            </span>
            <span className="shrink-0 text-muted-foreground opacity-70 tabular-nums">
              {hook.durationMs}ms
            </span>
            {hook.error && (
              <span className="min-w-0 truncate text-red-500/80">{hook.error}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function statusLabel(
  status: 'ok' | 'timeout' | 'error',
  t: HookReadoutTranslate,
): string {
  return status === 'timeout'
    ? t('runtimeHookRunTimeout')
    : status === 'error'
      ? t('runtimeHookRunError')
      : t('runtimeHookRunOk')
}

function statusTone(status: 'ok' | 'timeout' | 'error'): string {
  return status === 'error'
    ? 'text-red-500'
    : status === 'timeout'
      ? 'text-amber-600'
      : 'text-emerald-600'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
