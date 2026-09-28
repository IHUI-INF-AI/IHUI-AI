// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// D117 /diff 会话级改动审查(G-231)展示 Dialog:
// /slash 命令聚合消息流内带 diffInfo 的文件编辑工具调用 → 本组件只读展示
// 「本次会话 AI 改动总览」(文件列表 + 展开变更前/后对照)。
// 纯展示件:数据由 useSessionDiffStore.openWith 注入,本组件不取数(测试友好)。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, FilePlus2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ihui/ui-react'
import { useSessionDiffStore } from '@/stores/session-diff'

/** 同文件多次编辑的次数徽章上限(超过显示 N+) */
const CHANGED_COUNT_CAP = 9

export function SessionDiffDialog() {
  const t = useTranslations('chat.sessionDiff')
  const open = useSessionDiffStore((s) => s.open)
  const changes = useSessionDiffStore((s) => s.changes)
  const close = useSessionDiffStore((s) => s.close)
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    if (!open) setExpanded({})
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? undefined : close())}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-hidden p-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <span>{t('title')}</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {t('fileCount', { count: changes.length })}
            </span>
          </DialogTitle>
        </DialogHeader>
        {changes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="-mx-1 flex max-h-[60vh] flex-col gap-1 overflow-y-auto px-1">
            {changes.map((c) => {
              const isOpen = expanded[c.filePath] === true
              return (
                <li key={c.filePath} className="rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent/50"
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
                      <p className="text-xs text-muted-foreground">
                        {t('editedBy', { tool: c.toolName })}
                        {c.applyStatus ? ` · ${t(`applyStatus_${c.applyStatus}`)}` : ''}
                      </p>
                      {c.oldContent ? (
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            {t('before')}
                          </p>
                          <pre className="max-h-40 overflow-auto rounded-xs bg-muted/50 p-2 text-xs leading-relaxed">
                            <code>{c.oldContent}</code>
                          </pre>
                        </div>
                      ) : null}
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          {t('after')}
                        </p>
                        <pre className="max-h-40 overflow-auto rounded-xs bg-muted/50 p-2 text-xs leading-relaxed">
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
      </DialogContent>
    </Dialog>
  )
}
