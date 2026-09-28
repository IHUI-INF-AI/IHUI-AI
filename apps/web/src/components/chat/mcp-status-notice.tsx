// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D154(2026-09-30 立)对话内的 MCP 连接状态行。
 *
 * 票第 1 栏要的行为:「某某 MCP 未连接,工具不可用」+ 一键去设置或重试,
 * 而不是只有一行"某个工具调用失败了"(那是把修复方向指错:用户去查工具,真因在连接)。
 *
 * 三条判据落在渲染上:
 *  ① **异常态才占高度**:`connected` 帧在 hook 层就把那一行摘掉了(见
 *     `use-mcp-status-broadcast.ts` 的 `applyMcpStatusEvent`),常态不打扰对话流。
 *  ② **句子只由 `state` × 五语言词表产出**:载荷里的 `reason` 是技术原因(诊断用),
 *     绝不显示成界面文案 —— 后端发中文是 D155 同一条边界禁令。
 *  ③ **按钮不本地改状态**:点「立即重连」只发请求,新状态等生产面那一帧回来。
 *     本地先切成 connecting 会造出一个"看起来在重连"的假态,而真实连接可能压根没动。
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PlugZap, RefreshCw } from 'lucide-react'

import { connectExternalServer } from '@ihui/api-client/endpoints/mcp'

import { cn } from '@/lib/utils'
import { toast } from '@/components/common'
import { useMcpStatusBroadcast, type McpStatusEntry } from '@/hooks/use-mcp-status-broadcast'

/** MCP 设置页(外部 Server 清单与商店都在这页;不新立第二个入口) */
export const MCP_SETTINGS_PATH = '/mcp-store'

/** 会渲染成对话内一行的状态(connected 不在此列 —— 见判据①) */
const VISIBLE_STATES = new Set(['connecting', 'failed', 'reconnecting'])

export function McpStatusNotice(): React.JSX.Element | null {
  const { statuses } = useMcpStatusBroadcast()
  const visible = statuses.filter((s) => VISIBLE_STATES.has(s.state))
  if (visible.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="mcp-status-notice"
      className="mb-2 flex flex-col gap-1 rounded-md border border-border bg-card px-2.5 py-1.5"
    >
      {visible.map((entry) => (
        <McpStatusRow key={entry.server} entry={entry} />
      ))}
    </div>
  )
}

function McpStatusRow({ entry }: { entry: McpStatusEntry }): React.JSX.Element {
  const t = useTranslations('chat')
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  const sentence = (() => {
    // 三档句子都在词表里(五语言同批);未知档不会到这里 —— 载荷在 @ihui/types 就被封闭集挡住
    if (entry.state === 'reconnecting' && entry.attempt && entry.maxAttempts) {
      return t('mcp.state.reconnecting', {
        server: entry.server,
        attempt: String(entry.attempt),
        maxAttempts: String(entry.maxAttempts),
      })
    }
    if (entry.state === 'failed') return t('mcp.state.failed', { server: entry.server })
    return t('mcp.state.connecting', { server: entry.server })
  })()

  const onRetry = React.useCallback(async () => {
    if (pending) return
    setPending(true)
    try {
      const res = await connectExternalServer(entry.server)
      if (!res.success) {
        // ApiResult 失败档的字段名是 `error`(不是 message);这里失败**保持原状态**,
        // 只补一句提示 —— 本地先切成 connecting 会造出"看起来在重连"的假态(判据③)。
        toast.error(res.error || t('mcp.state.failed', { server: entry.server }))
      }
    } catch {
      toast.error(t('mcp.state.failed', { server: entry.server }))
    } finally {
      setPending(false)
    }
  }, [entry.server, pending, t])

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
      <PlugZap className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{sentence}</span>
      {/* 动作件用原生 <button>(与 connector-auth-card / high-risk-warning-banner 同档:
          密集工具条的 24px 紧凑档属有意设计,见 AGENTS §4 Button 高度档豁免) */}
      <button
        type="button"
        onClick={onRetry}
        disabled={pending}
        data-testid="mcp-status-retry"
        className={cn(
          'inline-flex shrink-0 items-center gap-0.5 rounded-sm bg-muted/50 px-1.5 py-0.5',
          'text-[11px] text-foreground transition-colors hover:bg-muted',
          pending && 'opacity-60',
        )}
      >
        <RefreshCw className="h-2.5 w-2.5" aria-hidden="true" />
        <span>{t('mcp.action.retry')}</span>
      </button>
      <button
        type="button"
        onClick={() => router.push(MCP_SETTINGS_PATH)}
        data-testid="mcp-status-open-settings"
        className="shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <span>{t('mcp.action.openSettings')}</span>
      </button>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
