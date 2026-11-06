// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D117 /diff 会话级改动审查(G-231)展示 Dialog:
// /slash 命令聚合消息流内带 diffInfo 的文件编辑工具调用 → 本组件只读展示
// 「本次会话 AI 改动总览」(文件列表 + 展开变更前/后对照)。
// 纯展示件:数据由 useSessionDiffStore.openWith 注入,本组件不取数(测试友好)。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, FilePlus2, History } from 'lucide-react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { usePaneChatStore } from '@/stores/chat-pane-context'
import { useSessionDiffStore } from '@/stores/session-diff'
import { useTurnChangesStore } from '@/stores/turn-changes'

/** 同文件多次编辑的次数徽章上限(超过显示 N+) */
const CHANGED_COUNT_CAP = 9

export function SessionDiffDialog() {
  const t = useTranslations('chat.sessionDiff')
  const tReview = useTranslations('chat.turnChangeReview')
  const open = useSessionDiffStore((s) => s.open)
  const changes = useSessionDiffStore((s) => s.changes)
  const close = useSessionDiffStore((s) => s.close)
  // 会话 id 取 pane 级 chat store(同组件树内与 message-input 同一 provider):
  // 主 store 在分屏下不是"当前 pane 的会话",用它会开错会话的变更集。
  const chatStore = usePaneChatStore()
  const conversationId = chatStore((s) => s.conversationId)
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})

  // 入口:关掉本弹窗再开「按轮变更」,避免两个 Dialog 叠加挡层级
  const openTurnChanges = (): void => {
    if (!conversationId) return
    useTurnChangesStore.getState().openForConversation(conversationId)
    close()
  }

  React.useEffect(() => {
    if (!open) setExpanded({})
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? undefined : close())}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden p-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span>{t('title')}</span>
            <span className="ml-2 text-label font-normal text-muted-foreground">
              {t('fileCount', { count: changes.length })}
            </span>
          </DialogTitle>
        </DialogHeader>
        {changes.length === 0 ? (
          <p className="py-6 text-center text-body text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="-mx-1 flex max-h-[60vh] flex-col gap-1 overflow-y-auto px-1">
            {changes.map((c) => {
              const isOpen = expanded[c.filePath] === true
              return (
                <li key={c.filePath} className="rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-body hover:bg-accent/50"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [c.filePath]: !prev[c.filePath] }))
                    }
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    {c.isNewFile ? (
                      <FilePlus2 className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <span className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="truncate font-medium" title={c.filePath}>
                      {c.filePath}
                    </span>
                    {c.changedCount > 1 && (
                      <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded bg-muted px-1 text-[10px] font-semibold leading-none tabular-nums">
                        {t('changedTimes', {
                          count: Math.min(c.changedCount, CHANGED_COUNT_CAP),
                          plus: c.changedCount > CHANGED_COUNT_CAP ? '+' : '',
                        })}
                      </span>
                    )}
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-2 px-3 pb-2">
                      <p className="text-label text-muted-foreground">
                        {t('editedBy', { tool: c.toolName })}
                        {c.applyStatus ? ` · ${t(`applyStatus_${c.applyStatus}`)}` : ''}
                      </p>
                      {c.oldContent ? (
                        <div>
                          <p className="mb-1 text-label font-medium text-muted-foreground">
                            {t('before')}
                          </p>
                          <pre className="max-h-40 overflow-auto rounded-xs bg-muted/50 p-2 text-label leading-relaxed">
                            <code>{c.oldContent}</code>
                          </pre>
                        </div>
                      ) : null}
                      <div>
                        <p className="mb-1 text-label font-medium text-muted-foreground">
                          {t('after')}
                        </p>
                        <pre className="max-h-40 overflow-auto rounded-xs bg-muted/50 p-2 text-label leading-relaxed">
                          <code>{c.newContent}</code>
                        </pre>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {/* 入口(批次 4):本弹窗只读常驻展示,按轮变更集需要另取 detail/dry-run,
            故只给一个跳转按钮,不把取数逻辑塞进这个纯展示件。 */}
        <div className="mt-1 flex items-center justify-end border-t border-border pt-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={!conversationId}
            aria-label={tReview('openEntryAria')}
            onClick={openTurnChanges}
          >
            <History className="h-3.5 w-3.5" aria-hidden />
            {tReview('openEntry')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
