// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, Loader2, RefreshCw, SquareTerminal, Link2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { useAgentTerminalFace } from '@/hooks/use-agent-terminal-face'

/**
 * 「模型终端屏面」只读视图(2026-11-21 立)。
 *
 * 它画的是 **agent 侧那块真 PTY 的屏幕网格**(服务端 `terminal_face` 聚合出的
 * screen/cursor/prompt/links),不是聊天里 `run_command` 的行流 —— 两者不同源:
 * 行流是"输出流水",网格是"程序此刻的屏幕"(`\\r` 刷新在流水里换行、在屏幕上同一格)。
 *
 * 三条产品立场:
 * - **只读**:这里没有任何输入框。人类键入仍走既有 `terminal-input` 待决项通道
 *   (带审批/超时语义),在此另开一个写口等于绕过它。
 * - **链接不可点**:OSC 8 的显示文字与真实目标可以完全不同(钓鱼面)。这里并列
 *   显示"文字 → 目标"且**不生成 <a>**,由人自己核对后再决定怎么办。
 * - **失败如实**:取不到就写原因,不画空屏冒充"终端没输出"。
 */
export function AgentTerminalFace({ sessionId }: { sessionId: string | null }) {
  const t = useTranslations('aiChat')
  const { terminals, activeId, face, loading, error, refresh, select } = useAgentTerminalFace(
    sessionId,
    true,
  )

  if (!sessionId) {
    return <Hint text={t('agentTerminal.noSession')} />
  }
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <span className="text-label text-muted-foreground">
          {t('agentTerminal.failed')}: {error}
        </span>
        <button
          type="button"
          onClick={refresh}
          aria-label={t('agentTerminal.refresh')}
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-label text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }
  if (!terminals.length) return <Hint text={t('agentTerminal.empty')} />

  const cursorRow = face ? face.row - 1 : -1

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 状态条:一块终端一行(多块时点击切换),不画分割线,靠背景对比分区 */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 bg-muted/40 px-2 py-1">
        {terminals.map((term) => {
          const on = term.terminal_id === activeId
          return (
            <Tooltip key={term.terminal_id} content={term.command}>
              <button
                type="button"
                onClick={() => select(term.terminal_id)}
                aria-pressed={on}
                className={cn(
                  'inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-label transition-colors',
                  on
                    ? 'bg-card text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <SquareTerminal className="h-3 w-3 shrink-0" />
                <span className="max-w-[10rem] truncate">{term.command}</span>
                {!term.running && (
                  <span className="tabular-nums text-muted-foreground">
                    ({term.exit_code ?? '-'})
                  </span>
                )}
              </button>
            </Tooltip>
          )
        })}
        <button
          type="button"
          onClick={refresh}
          aria-label={t('agentTerminal.refresh')}
          className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {face ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* 提示符/尺寸/光标一行:机器的读数,不猜提示符长相 */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-2 py-1 text-label text-muted-foreground">
            <span className="tabular-nums">
              {face.cols}×{face.rows}
            </span>
            <span className="tabular-nums">
              {t('agentTerminal.cursor')} {face.row},{face.col}
              {face.pending_wrap ? ' ·W' : ''}
            </span>
            {face.alt_screen && <span>{t('agentTerminal.altScreen')}</span>}
            {face.prompt && (
              <span>
                {face.prompt.shell_integration
                  ? `${face.prompt.prompt_state} · ${face.prompt.cwd}`
                  : t('agentTerminal.noIntegration')}
              </span>
            )}
            <span>{face.running ? t('agentTerminal.running') : t('agentTerminal.exited')}</span>
            {face.dropped_chunks > 0 && <span className="tabular-nums">Δ{face.dropped_chunks}</span>}
          </div>

          {/* 屏面:整块按行,行内空白保留(用 pre,不用白空格塌陷的 div) */}
          <div className="min-h-0 flex-1 overflow-auto px-2 pb-1">
            <pre className="font-mono text-xs leading-5">
              {face.screen.map((row, i) => (
                <div
                  key={i}
                  className={cn(
                    'whitespace-pre',
                    i === cursorRow && 'rounded-xs bg-accent/40',
                  )}
                >
                  {row || ' '}
                </div>
              ))}
            </pre>
          </div>

          {face.links.length > 0 && (
            <div className="shrink-0 px-2 pb-1">
              <div className="flex items-center gap-1 text-label text-muted-foreground">
                <Link2 className="h-3 w-3" />
                <span>{t('agentTerminal.links')}</span>
                {face.link_truncated && (
                  <span className="tabular-nums">
                    {face.link_count}/{face.link_total}
                  </span>
                )}
              </div>
              <ul className="mt-0.5 space-y-0.5">
                {face.links.map((link, i) => (
                  <li key={i} className="truncate text-label text-muted-foreground">
                    <span className="tabular-nums">{link.line_no}</span>
                    {'  '}
                    <span className="text-foreground">{link.text}</span>
                    {' → '}
                    <span className="font-mono">{link.url}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Hint text={t('agentTerminal.empty')} />
          )}
        </div>
      )}
    </div>
  )
}

function Hint({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center">
      <span className="text-label text-muted-foreground">{text}</span>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
