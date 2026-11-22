// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { SquareTerminal, Plus, ChevronDown, Monitor } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/feedback'
import { TerminalPanel } from '@/components/ide/terminal-panel'
import { useTerminalSession } from '@/hooks/use-terminal-session'
import { useTerminalDockStore } from '@/stores/terminal-dock'
import { useChatStore } from '@/stores/chat'
import { AgentTerminalFace } from '@/components/ai/agent-terminal-face'

/**
 * AI 面板底部 PowerShell 终端停靠面板(2026-08-17 立)。
 *
 * - open=false 时 return null(不挂载 TerminalPanel,避免无谓建 session)。
 * - 结构:mini 工具栏(h-8,PowerShell 标题 + 新建终端 + 收起)+ TerminalPanel 主体 + 底部 4px 拖拽调高命中区。
 * - 工具栏与主体用背景色对比(bg-muted/40 vs bg-card)区分,不画分割线(AGENTS.md 禁单边 border 当分割线)。
 * - 高度由 useTerminalDockStore.height 控制,store 内钳制 160-480;收起再展开保留上次高度。
 */
export function AiTerminalDock() {
  const t = useTranslations('aiChat')
  const tcommon = useTranslations('common')
  const open = useTerminalDockStore((s) => s.open)
  const height = useTerminalDockStore((s) => s.height)
  const isResizing = useTerminalDockStore((s) => s.isResizing)
  const setOpen = useTerminalDockStore((s) => s.setOpen)
  const setHeight = useTerminalDockStore((s) => s.setHeight)
  const setResizing = useTerminalDockStore((s) => s.setResizing)

  const { createSession } = useTerminalSession()
  // 2026-11-21:停靠面板多一个**只读**视图 —— agent 侧真 PTY 的屏面。
  // 它画的是"模型此刻看到的屏幕"(网格/光标/提示符/链接),与 IDE 终端那条 WS 不是同一条链路;
  // 用 `aria-expanded`(展开/收起语义)而不是 `aria-pressed`,因为这不是一个常驻开关。
  const [showAgentFace, setShowAgentFace] = React.useState(false)
  // 2026-11-21:必须用 conversationId —— agent 侧终端记账键是 metadata.conversationId,
  // 而 aiStreamSessionId 是每次流新生成的随机 UUID(传它 = 面板永远空白)。
  const agentConversationId = useChatStore((s) => s.conversationId ?? null)

  // 底部 4px 命中区拖拽调高:向上拖动 = 增大 height(startY - clientY > 0)
  const handleResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      setResizing(true)
      const startY = e.clientY
      const startHeight = useTerminalDockStore.getState().height
      const onMove = (ev: PointerEvent) => {
        setHeight(startHeight + (startY - ev.clientY))
      }
      const onUp = () => {
        setResizing(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [setHeight, setResizing],
  )

  // 新建终端:显式指定 PowerShell(Windows 默认 shell,跨平台后端也接受 shell 字段)
  const handleNew = React.useCallback(() => {
    void createSession({ shell: 'powershell' })
  }, [createSession])

  if (!open) return null

  return (
    <div
      data-testid="ai-terminal-dock"
      className={cn(
        'flex shrink-0 flex-col overflow-hidden ui-card rounded-lg bg-card',
        isResizing && 'select-none',
      )}
    >
      {/* mini 工具栏:背景色对比区分工具栏与主体,不画分割线 */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 bg-muted/40 px-2">
        <SquareTerminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-label font-medium text-muted-foreground">
          {t('terminalDock.title')}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip
            content={
              showAgentFace ? t('terminalDock.backToIde') : t('terminalDock.showAgentFace')
            }
          >
            <button
              type="button"
              onClick={() => setShowAgentFace((v) => !v)}
              aria-expanded={showAgentFace}
              aria-label={
                showAgentFace ? t('terminalDock.backToIde') : t('terminalDock.showAgentFace')
              }
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-sm transition-colors',
                showAgentFace
                  ? 'bg-card text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={t('terminalDock.newSession')}>
            <button
              type="button"
              onClick={handleNew}
              aria-label={t('terminalDock.newSession')}
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content={t('terminalDock.collapse')}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('terminalDock.collapse')}
              className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
      {/* 主体:两视图共用同一高度。**IDE 视图永远挂载、不挪几何** —— 卸载或把 xterm 塞进
          `hidden` 父层会让它按 0 尺寸重算(fit 成 0 列),再切回来要重排且可能丢 scrollback。
          所以 agent 视图是**盖在它上面的一层**(absolute + 不透明底),关掉即移除。
          agent 视图只读轮询(取不到如实写原因,不画空屏冒充"没输出") */}
      <div className="relative min-h-0 overflow-hidden" style={{ height }}>
        <TerminalPanel />
        {showAgentFace && (
          <div className="absolute inset-0 bg-card">
            <AgentTerminalFace conversationId={agentConversationId} />
          </div>
        )}
      </div>
      {/* 底部 4px 拖拽调高命中区 */}
      <div
        onPointerDown={handleResizeStart}
        role="separator"
        aria-orientation="horizontal"
        aria-label={tcommon('resize')}
        className="h-1 shrink-0 cursor-row-resize touch-none outline-none"
      />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
