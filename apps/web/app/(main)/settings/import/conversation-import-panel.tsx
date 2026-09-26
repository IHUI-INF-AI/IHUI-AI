// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 外部会话导入面板(D28,2026-09-20 立)
 *
 * 四步流:选来源 → 上传文件(20MB 客户端预校验) → 解析预览(多选,默认全选) → 逐会话串行 commit。
 * commit 逐会话调用 api-client 的 commitConversationImport,单个失败不中断其余导入;
 * 全部完成后失效会话列表 query(['chat','conversations']),侧栏立即可见新会话。
 */
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, FileUp, History, Loader2, Upload } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui-react'
import {
  commitConversationImport,
  getConversationImportHistory,
  parseConversationImport,
  type ConversationImportCommitPayload,
  type ConversationImportParseResult,
  type ConversationImportSource,
} from '@ihui/api-client'

import { Alert } from '@/components/feedback'
import { formatSize } from './helpers'

/** 会话导入来源卡片配置(accept 供文件选择器按来源过滤,hint 为典型导出文件路径) */
const IMPORT_SOURCES: Array<{
  value: ConversationImportSource
  labelKey: string
  hintKey: string
  accept: string
}> = [
  {
    value: 'claude_code',
    labelKey: 'sourceClaudeCode',
    hintKey: 'sourceClaudeCodeHint',
    accept: '.jsonl,.json',
  },
  {
    value: 'codex',
    labelKey: 'sourceCodex',
    hintKey: 'sourceCodexHint',
    accept: '.jsonl,.json',
  },
  {
    // Cursor 现代版正文在 state.vscdb(SQLite)里,三种库后缀同义;cursor-agent 转写是 .jsonl
    value: 'cursor',
    labelKey: 'sourceCursor',
    hintKey: 'sourceCursorHint',
    accept: '.json,.jsonl,.vscdb,.db,.sqlite',
  },
  {
    value: 'aider',
    labelKey: 'sourceAider',
    hintKey: 'sourceAiderHint',
    accept: '.md,.json,.jsonl',
  },
]

/** 客户端预校验的文件大小上限:20MB */
const MAX_FILE_SIZE = 20 * 1024 * 1024

/** 历史记录状态 → i18n key(未知状态回退显示原文) */
const HISTORY_STATUS_KEY: Record<string, string> = {
  success: 'statusSuccess',
  partial: 'statusPartial',
  failed: 'statusFailed',
}

export function ConversationImportPanel() {
  const t = useTranslations('conversationImport')
  const qc = useQueryClient()

  const [source, setSource] = React.useState<ConversationImportSource | ''>('')
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<ConversationImportParseResult | null>(null)
  const [selected, setSelected] = React.useState<Set<number>>(new Set())
  const [progress, setProgress] = React.useState({ done: 0, total: 0 })

  // 导入历史
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['conversation-import-history'],
    queryFn: async () => {
      const r = await getConversationImportHistory()
      if (!r.success) throw new Error(r.error)
      return r.data
    },
  })
  const history = historyData?.list ?? []

  // 解析(multipart 上传,api 转发 ai-service 后原样透传)
  const parseMut = useMutation({
    mutationFn: () => parseConversationImport(file!, source as ConversationImportSource),
    onSuccess: (res) => {
      if (!res.success) {
        toast.error(t('parseFailed', { error: res.error }))
        return
      }
      setPreview(res.data)
      // 默认全选
      setSelected(new Set(res.data.conversations.map((_, i) => i)))
      toast.success(t('parseSuccess', { count: res.data.conversations.length }))
    },
    onError: (e: Error) => toast.error(t('parseFailed', { error: e.message })),
  })

  // 逐会话串行 commit:单个失败不中断,完成后失效会话列表(侧栏立即可见)
  const commitMut = useMutation({
    mutationFn: async () => {
      const convs = (preview?.conversations ?? []).filter((_, i) => selected.has(i))
      let done = 0
      let imported = 0
      let failed = 0
      setProgress({ done: 0, total: convs.length })
      for (const conv of convs) {
        // api 校验 content 非空:过滤空消息,过滤后无消息的会话直接记失败
        const messages = conv.messages
          .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
          .map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt }))
        if (messages.length === 0) {
          failed += 1
          done += 1
          setProgress({ done, total: convs.length })
          continue
        }
        const payload: ConversationImportCommitPayload = {
          source: source as ConversationImportSource,
          fileName: file?.name || undefined,
          title: conv.title?.trim() ? conv.title.trim().slice(0, 255) : undefined,
          // 不透传 conv.model:该列会直接进 LLM 网关(chat.ts 的 conversation.model),
          // 外部工具模型 id 未必在用户目录内,写入会让导入会话首次续聊报错。留待 /parse
          // 响应透出的 model 仅作展示用途(类型已在 @ihui/api-client 定义)。
          createdAt: conv.sourceCreatedAt ?? conv.sourceUpdatedAt ?? undefined,
          messages,
        }
        try {
          const r = await commitConversationImport(payload)
          if (r.success) imported += 1
          else failed += 1
        } catch {
          failed += 1
        }
        done += 1
        setProgress({ done, total: convs.length })
      }
      return { imported, failed }
    },
    onSuccess: (res) => {
      toast.success(t('commitDone', { imported: res.imported, failed: res.failed }))
      setPreview(null)
      setFile(null)
      setSource('')
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      qc.invalidateQueries({ queryKey: ['conversation-import-history'] })
    },
    onError: (e: Error) => toast.error(t('commitFailed', { error: e.message })),
  })

  function handleFileChange(f: File | null) {
    if (f && f.size > MAX_FILE_SIZE) {
      toast.error(t('fileTooLarge'))
      return
    }
    setFile(f)
    setPreview(null)
  }

  function onParse() {
    if (!source) return toast.error(t('errorNoSource'))
    if (!file) return toast.error(t('errorNoFile'))
    parseMut.mutate()
  }

  function toggleSelected(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function toggleAll() {
    if (!preview) return
    if (selected.size === preview.conversations.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(preview.conversations.map((_, i) => i)))
    }
  }

  const activeSource = IMPORT_SOURCES.find((s) => s.value === source)
  const hasConversations = (preview?.conversations.length ?? 0) > 0

  return (
    <div className="space-y-4">
      <Alert variant="info" title={t('tab')} description={t('desc')} />

      {/* Step 1: 选择来源 */}
      <Card>
        <CardContent className="space-y-3 p-3 min-[640px]:p-3">
          <p className="text-sm font-medium">{t('sourcesTitle')}</p>
          <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-4">
            {IMPORT_SOURCES.map((s) => {
              const active = source === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  data-testid="import-source-card"
                  data-source={s.value}
                  onClick={() => setSource(s.value)}
                  className={`flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-brand-accent-deep bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <span className="flex w-full items-center gap-2 text-xs font-medium">
                    <span className="flex-1 truncate">{t(s.labelKey)}</span>
                    {active && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </span>
                  <span className="line-clamp-2 text-[10px] leading-tight">{t(s.hintKey)}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: 上传会话导出文件 */}
      {source && (
        <Card>
          <CardContent className="space-y-3 p-3 min-[640px]:p-3">
            <p className="text-sm font-medium">{t('upload')}</p>
            <p className="text-xs text-muted-foreground">{t('uploadHint')}</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-border p-3 text-center transition-colors hover:bg-accent">
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t('dragDrop')}</span>
              <input
                type="file"
                className="hidden"
                data-testid="import-file-input"
                accept={activeSource?.accept}
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <p className="text-xs text-muted-foreground">
                {t('fileSelected', { name: file.name, size: formatSize(file.size) })}
              </p>
            )}
            <Button size="sm" onClick={onParse} disabled={!file || parseMut.isPending}>
              {parseMut.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              <span>{parseMut.isPending ? t('parsing') : t('parse')}</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: 解析预览 + 逐会话导入 */}
      {preview && (
        <Card>
          <CardContent className="space-y-3 p-3 min-[640px]:p-3">
            {!hasConversations ? (
              <p className="text-xs text-muted-foreground">{t('parseEmpty')}</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t('previewTitle')}</p>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {selected.size === preview.conversations.length
                      ? t('deselectAll')
                      : t('selectAll')}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('selected', { count: selected.size, total: preview.conversations.length })}
                </p>

                {preview.truncated && (
                  <div className="flex items-start gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>{t('truncatedWarning')}</span>
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                    {preview.warnings.map((w, i) => (
                      <p key={i} className="flex items-start gap-1">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{w}</span>
                      </p>
                    ))}
                  </div>
                )}

                <div className="space-y-2" data-testid="import-preview-list">
                  {preview.conversations.map((c, i) => {
                    const checked = selected.has(i)
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 rounded-md border p-2 text-xs transition-colors ${
                          checked
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border hover:bg-accent'
                        }`}
                      >
                        <input
                          id={`import-conv-${i}`}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(i)}
                          className="mt-0.5 h-3.5 w-3.5"
                        />
                        <label
                          htmlFor={`import-conv-${i}`}
                          className="min-w-0 flex-1 cursor-pointer space-y-0.5"
                        >
                          <span className="block truncate font-medium">
                            {c.title?.trim() || t('conversationUntitled')}
                          </span>
                          <span className="block text-muted-foreground">
                            {t('messagesCount', { count: c.messages.length })}
                          </span>
                        </label>
                      </div>
                    )
                  })}
                </div>

                <Button
                  size="sm"
                  data-testid="import-commit-btn"
                  onClick={() => commitMut.mutate()}
                  disabled={selected.size === 0 || commitMut.isPending}
                >
                  {commitMut.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  )}
                  <span>
                    {commitMut.isPending
                      ? t('committing', { done: progress.done, total: progress.total })
                      : t('commit')}
                  </span>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: 导入历史 */}
      <Card>
        <CardContent className="space-y-3 p-3 min-[640px]:p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4 text-muted-foreground" />
            {t('historyTitle')}
          </p>
          {historyLoading ? (
            <div className="flex items-center text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              {t('parsing')}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('historyEmpty')}</p>
          ) : (
            <div className="space-y-2" data-testid="import-history-list">
              {history.map((h) => {
                const statusKey = HISTORY_STATUS_KEY[h.status]
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-xs"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{h.fileName || '—'}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            h.status === 'success'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : h.status === 'failed'
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {statusKey ? t(statusKey) : h.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {t('historyParsed')}: {h.parsedCount} · {t('historyImported')}:{' '}
                        {h.importedCount} · {t('historyFailed')}: {h.failedCount}
                        {h.errorMessage ? ` · ${h.errorMessage}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(h.importedAt).toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
