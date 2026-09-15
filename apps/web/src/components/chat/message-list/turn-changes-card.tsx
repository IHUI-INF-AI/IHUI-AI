// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { RotateCcw, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '@ihui/ui-react'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@ihui/ui-react'
import type { ChatMessage, ToolCall } from '@/stores/chat'
import { listCheckpoints, restoreCheckpoint } from '@/api/checkpoint-api'
import { toast } from '@/components/common'
import { cn } from '@/lib/utils'

// 写类工具白名单(对应 MessageItem FILE_MODIFY_TOOLS + 任务描述 apply_diff/patch/replace_in_file)
const WRITE_TOOLS = new Set<string>([
  'write_file',
  'apply_diff',
  'edit_file',
  'file_edit',
  'create_file',
  'delete_file',
  'patch',
  'replace_in_file',
])

const PATH_ARG_KEYS = ['path', 'file_path', 'filePath', 'file', 'filename']

function pickPath(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  for (const k of PATH_ARG_KEYS) {
    const v = args[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function basename(p: string): string {
  const norm = p.replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  return idx === -1 ? norm : norm.slice(idx + 1)
}

function countLines(s: string): number {
  return s ? s.split('\n').length : 0
}

function strField(args: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = args[k]
    if (typeof v === 'string') return v
  }
  return ''
}

// 从 result 中提取可能的 diff 文本(统一 diff 字段或纯字符串结果)
function extractDiffText(result: unknown): string {
  if (typeof result === 'string') return result
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>
    for (const k of ['diff', 'diff_text', 'unified_diff', 'patch']) {
      const v = obj[k]
      if (typeof v === 'string' && v.trim()) return v
    }
  }
  return ''
}

interface ChangeFile {
  path: string
  name: string
  added: number // -1 表示拿不到,显示 「—」
  removed: number
}

function computeChanges(toolCalls: ToolCall[] | undefined): ChangeFile[] {
  const seen = new Set<string>()
  const out: ChangeFile[] = []
  if (!toolCalls) return out
  for (const tc of toolCalls) {
    if (!WRITE_TOOLS.has(tc.toolName)) continue
    if (tc.status !== 'success' || tc.error) continue
    const p = pickPath(tc.args)
    if (!p || seen.has(p)) continue
    seen.add(p)
    const args = (tc.args ?? {}) as Record<string, unknown>
    const newContent = strField(args, ['newText', 'newContent', 'content'])
    const oldContent = strField(args, ['oldText', 'oldContent'])
    let added = -1
    let removed = -1
    if (newContent !== '' || oldContent !== '') {
      added = countLines(newContent)
      removed = countLines(oldContent)
    } else {
      const diff = extractDiffText(tc.result)
      if (diff) {
        const a = (diff.match(/^\+(?!\+\+)/gm) ?? []).length
        const r = (diff.match(/^-(?!--)/gm) ?? []).length
        if (a + r > 0) {
          added = a
          removed = r
        }
      }
    }
    out.push({ path: p, name: basename(p), added, removed })
  }
  return out
}

export interface TurnChangesCardProps {
  message: ChatMessage
  conversationId: string | null
}

export function TurnChangesCard({ message, conversationId }: TurnChangesCardProps) {
  const t = useTranslations('chat')
  const changes = React.useMemo(() => computeChanges(message.toolCalls), [message.toolCalls])
  const [open, setOpen] = React.useState(true)
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [restoring, setRestoring] = React.useState(false)
  const [hasCheckpoint, setHasCheckpoint] = React.useState<boolean | null>(null)

  // 挂载即探查本消息 createdAt 之前是否存在 checkpoint,决定「恢复到本轮之前」可用性
  React.useEffect(() => {
    let cancelled = false
    if (!conversationId) {
      setHasCheckpoint(false)
      return
    }
    listCheckpoints(conversationId)
      .then((res) => {
        if (!cancelled)
          setHasCheckpoint(res.checkpoints.some((c) => c.created_at < message.createdAt))
      })
      .catch(() => {
        if (!cancelled) setHasCheckpoint(false)
      })
    return () => {
      cancelled = true
    }
  }, [conversationId, message.createdAt])

  const handleConfirmRevert = React.useCallback(async () => {
    if (!conversationId) return
    setRestoring(true)
    try {
      const list = await listCheckpoints(conversationId)
      const target = list.checkpoints
        .filter((c) => c.created_at < message.createdAt)
        .sort((a, b) => b.created_at - a.created_at)[0]
      if (!target) {
        toast.error(t('turnChanges.noCheckpoints'))
        setConfirmOpen(false)
        return
      }
      await restoreCheckpoint(target.checkpoint_id, conversationId, 'both')
      toast.success(t('turnChanges.revert'))
      setConfirmOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setRestoring(false)
    }
  }, [conversationId, message.createdAt, t])

  if (changes.length === 0) return null

  return (
    <div
      className="rounded-md border border-border/60 bg-muted/30"
      data-testid={`turn-changes-${message.id}`}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/40">
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
          <span className="flex-1 truncate text-sm font-medium">
            {t('turnChanges.title')} ({changes.length})
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-1 px-3 pb-3">
            {changes.map((c) => (
              <div key={c.path}>
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => (prev === c.path ? null : c.path))}
                  aria-label={c.path}
                  data-testid={`turn-change-row-${c.name}`}
                  className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-xs transition-colors hover:bg-muted/50"
                >
                  <span className="flex-1 truncate font-mono">{c.name}</span>
                  {c.added < 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                      <span className="text-green-600">+{c.added}</span>
                      <span className="text-red-600">-{c.removed}</span>
                    </span>
                  )}
                </button>
                {expanded === c.path && (
                  <p className="truncate px-1.5 pb-1 font-mono text-[10px] text-muted-foreground/70">
                    {c.path}
                  </p>
                )}
              </div>
            ))}
            <div className="pt-1">
              <Button
                size="sm"
                variant="outline"
                disabled={hasCheckpoint === false || restoring}
                onClick={() => setConfirmOpen(true)}
                data-testid={`turn-revert-${message.id}`}
                className="w-full"
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                {hasCheckpoint === false ? t('turnChanges.noCheckpoints') : t('turnChanges.revert')}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('turnChanges.revert')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('turnChanges.revertConfirm', { count: changes.length })}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('cancel')}
            </Button>
            <Button size="sm" onClick={() => void handleConfirmRevert()} disabled={restoring}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              {t('turnChanges.revert')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TurnChangesCard
