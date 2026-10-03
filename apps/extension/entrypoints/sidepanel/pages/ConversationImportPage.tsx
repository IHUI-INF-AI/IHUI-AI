// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ConversationImportPage — 外部会话导入(2026-10-03 立,D28 管道 · 扩展端)。
 *
 * 五步流:选来源 → 选文件(原生 input[type=file],扩展页是标准 Web 环境)→ POST /parse
 * → 预览(会话数/消息数/warnings/truncated,默认全选)→ 逐会话串行 POST /commit。
 *
 * 与既有端的一致性约定:
 * - 打开会话走 lib/open-in-web 的 openInWeb(与 ChatHistoryPage 同一出口:侧栏不渲染
 *   会话详情,一律 `chrome.tabs.create` 跳 web 端 /chat/:id)。导入成功后不自动开页,
 *   改为显式按钮 —— 未经用户手势就弹出新标签是打扰,与 ChatHistoryPage「点击才跳」的
 *   既有交互一致。
 * - 刷新会话列表走侧栏内导航(/chat/history):该页 `load()` 在挂载时拉取,重新挂载即刷新。
 *   扩展端无 react-query 缓存可 invalidate,故不复用 web 端 qc.invalidateQueries 那套。
 *
 * 错误诚实性:parse 失败带服务端原文;truncated / warnings 逐条上屏;逐会话 commit
 * 单条失败不中断其余,失败原因去重后全部展示(不静默吞掉),空消息会话单列原因。
 * 不透传 conv.model:该列直接进 LLM 网关,外部工具模型 id 未必在用户目录内。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  commitConversationImport,
  getConversationImportHistory,
  parseConversationImport,
  type ConversationImportHistoryItem,
  type ConversationImportParseResult,
  type ConversationImportSource,
} from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { openInWeb as openItemInWeb } from '../../../lib/open-in-web'

/** 会话导入来源卡片配置(accept 供文件选择器按来源过滤,hint 为典型导出文件) */
const IMPORT_SOURCES: Array<{
  value: ConversationImportSource
  labelKey: string
  hintKey: string
  accept: string
}> = [
  {
    value: 'claude_code',
    labelKey: 'conversationImport.sourceClaudeCode',
    hintKey: 'conversationImport.sourceClaudeCodeHint',
    accept: '.jsonl,.json',
  },
  {
    value: 'codex',
    labelKey: 'conversationImport.sourceCodex',
    hintKey: 'conversationImport.sourceCodexHint',
    accept: '.jsonl,.json',
  },
  {
    value: 'cursor',
    labelKey: 'conversationImport.sourceCursor',
    hintKey: 'conversationImport.sourceCursorHint',
    accept: '.json,.jsonl,.vscdb,.db,.sqlite',
  },
  {
    value: 'aider',
    labelKey: 'conversationImport.sourceAider',
    hintKey: 'conversationImport.sourceAiderHint',
    accept: '.md,.json,.jsonl',
  },
  {
    // 微信导出物是归档包/纯文本,与其余四源的 jsonl/sqlite 家族完全不同。
    // 与 web(IMPORT_SOURCES)/CLI(SESSION_SOURCE_CONFIG)同口径。
    value: 'wechat',
    labelKey: 'conversationImport.sourceWechat',
    hintKey: 'conversationImport.sourceWechatHint',
    accept: '.zip,.txt',
  },
]

/** 客户端预校验的文件大小上限:20MB(与 web 端一致) */
const MAX_FILE_SIZE = 20 * 1024 * 1024

/** 历史记录状态 → i18n key(未知状态回退显示原文,不吞) */
const HISTORY_STATUS_KEY: Record<string, string> = {
  success: 'conversationImport.statusSuccess',
  partial: 'conversationImport.statusPartial',
  failed: 'conversationImport.statusFailed',
}

/** 逐会话 commit 的结果汇总(失败原因全量带回 UI,不静默吞掉) */
interface CommitOutcome {
  imported: number
  failed: number
  firstConversationId: string | null
  failureReasons: string[]
}

/** 文件体积展示(扩展端无 web 端 formatSize,此处本地实现避免跨端耦合) */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function ConversationImportPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [source, setSource] = useState<ConversationImportSource | ''>('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ConversationImportParseResult | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const [parsing, setParsing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [parseError, setParseError] = useState('')
  const [outcome, setOutcome] = useState<CommitOutcome | null>(null)

  const [history, setHistory] = useState<ConversationImportHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const res = await getConversationImportHistory()
      if (res.success) setHistory(res.data.list)
    } catch {
      // 历史拉取失败不阻断导入主流程;导入结果由 outcome 就地展示,
      // 不把一个辅助区块的失败抬成整页错误。
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  const onParse = async () => {
    if (!source) {
      setParseError(t('conversationImport.errorNoSource'))
      return
    }
    if (!file) {
      setParseError(t('conversationImport.errorNoFile'))
      return
    }
    setParsing(true)
    setParseError('')
    setOutcome(null)
    try {
      const res = await parseConversationImport(file, source)
      if (!res.success) {
        // 服务端原文上屏(含文件格式/大小不合法等真实原因),不替换成笼统文案
        setParseError(res.error || t('common.failed'))
        return
      }
      setPreview(res.data)
      // 默认全选
      setSelected(new Set(res.data.conversations.map((_, i) => i)))
    } catch (e) {
      setParseError(e instanceof Error ? e.message : t('common.failed'))
    } finally {
      setParsing(false)
    }
  }

  const onCommit = async () => {
    if (!source || !preview) return
    setCommitting(true)
    const convs = preview.conversations.filter((_, i) => selected.has(i))
    let done = 0
    let imported = 0
    let failed = 0
    let firstConversationId: string | null = null
    // 失败原因不吞:单条失败只计数不中断其余,但原因要带回 UI,
    // 否则用户只看到一个 failed 数字,无法判断是自己的文件问题还是服务端故障
    const failureReasons: string[] = []
    setProgress({ done: 0, total: convs.length })

    for (const conv of convs) {
      const messages = (Array.isArray(conv.messages) ? conv.messages : [])
        // api 校验 content 非空:过滤空消息,过滤后无消息的会话直接记失败
        .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt }))
      if (messages.length === 0) {
        failed += 1
        failureReasons.push(t('conversationImport.noValidContent'))
        done += 1
        setProgress({ done, total: convs.length })
        continue
      }
      try {
        const r = await commitConversationImport({
          source,
          fileName: file?.name || undefined,
          title: conv.title?.trim() ? conv.title.trim().slice(0, 255) : undefined,
          // 不透传 conv.model,理由见文件头
          createdAt: conv.sourceCreatedAt ?? conv.sourceUpdatedAt ?? undefined,
          messages,
        })
        if (r.success) {
          imported += 1
          if (!firstConversationId) firstConversationId = r.data.conversationId
        } else {
          failed += 1
          failureReasons.push(r.error)
        }
      } catch (e) {
        failed += 1
        failureReasons.push(e instanceof Error ? e.message : String(e))
      }
      done += 1
      setProgress({ done, total: convs.length })
    }

    setOutcome({ imported, failed, firstConversationId, failureReasons })
    setCommitting(false)
    // 清空选择态,避免用户对同一预览重复点导入;历史刷新以服务端落库记录为准
    setPreview(null)
    setSelected(new Set())
    setFile(null)
    setSource('')
    void loadHistory()
  }

  const onFileChange = (f: File | null) => {
    setParseError('')
    setOutcome(null)
    if (f && f.size > MAX_FILE_SIZE) {
      setFile(null)
      setParseError(t('conversationImport.fileTooLarge'))
      return
    }
    setFile(f)
    // 换文件即丢弃上一份预览:预览与文件已不是同一份,留着会误导用户
    setPreview(null)
  }

  const toggleSelected = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const toggleAll = () => {
    if (!preview) return
    if (selected.size === preview.conversations.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(preview.conversations.map((_, i) => i)))
    }
  }

  const activeSource = IMPORT_SOURCES.find((s) => s.value === source)
  const hasConversations = (preview?.conversations.length ?? 0) > 0
  const totalMessages =
    preview?.conversations.reduce(
      (sum, c) => sum + (Array.isArray(c.messages) ? c.messages.length : 0),
      0,
    ) ?? 0

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('conversationImport.title')}</h3>
        <button
          type="button"
          onClick={() => navigate('/chat/history')}
          className="px-2 py-1 text-[11px] rounded-sm border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
        >
          {t('conversationImport.backToHistory')}
        </button>
      </div>
      <p className="m-0 text-xs text-muted-foreground">{t('conversationImport.desc')}</p>

      {/* Step 1: 选择来源 */}
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="p-3 min-[640px]:p-3 flex flex-col gap-2">
          <p className="m-0 text-sm font-medium">{t('conversationImport.sourcesTitle')}</p>
          <div className="grid grid-cols-2 gap-2 min-[640px]:grid-cols-3">
            {IMPORT_SOURCES.map((s) => {
              const active = source === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  data-testid="import-source-card"
                  data-source={s.value}
                  onClick={() => {
                    setSource(s.value)
                    setParseError('')
                    setOutcome(null)
                    setPreview(null)
                  }}
                  className={`flex flex-col items-start gap-1 rounded-sm border px-2 py-2 text-left transition-colors ${
                    active
                      ? 'border-brand-accent-deep bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <span className="w-full text-xs font-medium truncate">{t(s.labelKey)}</span>
                  <span className="line-clamp-2 text-[10px] leading-tight">{t(s.hintKey)}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: 选择会话导出文件 */}
      {source && (
        <Card className="rounded-lg border-border shadow-none">
          <CardContent className="p-3 min-[640px]:p-3 flex flex-col gap-2">
            <p className="m-0 text-sm font-medium">{t('conversationImport.upload')}</p>
            <p className="m-0 text-xs text-muted-foreground">
              {t('conversationImport.uploadHint')}
            </p>
            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-md border border-dashed border-border p-3 text-center transition-colors hover:bg-muted/50">
              <span className="text-xs text-muted-foreground">
                {t('conversationImport.chooseFile')}
              </span>
              <input
                type="file"
                data-testid="import-file-input"
                accept={activeSource?.accept}
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                className="text-[11px] max-w-full"
              />
            </label>
            {file && (
              <p className="m-0 text-xs text-muted-foreground break-all">
                {t('conversationImport.fileSelected', {
                  name: file.name,
                  size: formatSize(file.size),
                })}
              </p>
            )}
            <button
              type="button"
              data-testid="import-parse-btn"
              onClick={() => void onParse()}
              disabled={!file || parsing || committing}
              className="self-start px-3 py-1.5 text-xs rounded-sm border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {parsing ? t('conversationImport.parsing') : t('conversationImport.parse')}
            </button>
          </CardContent>
        </Card>
      )}

      {/* 错误一律上屏:parse 失败带服务端原文 */}
      {parseError && (
        <div
          data-testid="import-parse-error"
          className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive text-xs"
        >
          {parseError}
        </div>
      )}

      {/* Step 3: 解析预览 + 逐会话导入 */}
      {preview && (
        <Card className="rounded-lg border-border shadow-none">
          <CardContent className="p-3 min-[640px]:p-3 flex flex-col gap-2">
            {!hasConversations ? (
              <p className="m-0 text-xs text-muted-foreground">
                {t('conversationImport.parseEmpty')}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="m-0 text-sm font-medium">{t('conversationImport.previewTitle')}</p>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    {selected.size === preview.conversations.length
                      ? t('conversationImport.deselectAll')
                      : t('conversationImport.selectAll')}
                  </button>
                </div>
                <p
                  className="m-0 text-xs text-muted-foreground"
                  data-testid="import-preview-summary"
                >
                  {t('conversationImport.selected', {
                    count: selected.size,
                    total: preview.conversations.length,
                  })}
                  {' · '}
                  {t('conversationImport.totalMessages', { count: totalMessages })}
                </p>

                {/* 截断必须显式告知:用户可能以为文件里的会话都进来了 */}
                {preview.truncated && (
                  <div
                    data-testid="import-truncated"
                    className="flex items-start gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400"
                  >
                    <span>{t('conversationImport.truncatedWarning')}</span>
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <div
                    data-testid="import-warnings"
                    className="flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400"
                  >
                    {preview.warnings.map((w, i) => (
                      <p key={i} className="m-0">
                        {w}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-1.5" data-testid="import-preview-list">
                  {preview.conversations.map((c, i) => {
                    const checked = selected.has(i)
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 rounded-md border p-2 text-xs transition-colors ${
                          checked
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border hover:bg-muted/50'
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
                          className="min-w-0 flex-1 cursor-pointer"
                        >
                          <span className="block truncate font-medium">
                            {c.title?.trim() || t('conversationImport.conversationUntitled')}
                          </span>
                          <span className="block text-muted-foreground">
                            {t('conversationImport.messagesCount', {
                              count: Array.isArray(c.messages) ? c.messages.length : 0,
                            })}
                          </span>
                        </label>
                      </div>
                    )
                  })}
                </div>

                <button
                  type="button"
                  data-testid="import-commit-btn"
                  onClick={() => void onCommit()}
                  disabled={selected.size === 0 || committing}
                  className="self-start px-3 py-1.5 text-xs rounded-sm border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {committing
                    ? t('conversationImport.committing', {
                        done: progress.done,
                        total: progress.total,
                      })
                    : t('conversationImport.commit')}
                </button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 导入结果:成功数 / 失败数 / 失败原因全量上屏 */}
      {outcome && (
        <Card
          className={`rounded-lg shadow-none ${outcome.failed > 0 ? 'border-destructive' : 'border-border'}`}
        >
          <CardContent className="p-3 min-[640px]:p-3 flex flex-col gap-2">
            <p className="m-0 text-sm font-medium">{t('conversationImport.resultTitle')}</p>
            <p className="m-0 text-xs" data-testid="import-commit-summary">
              {t('conversationImport.commitDone', {
                imported: outcome.imported,
                failed: outcome.failed,
              })}
            </p>
            {outcome.failed > 0 && (
              <ul
                data-testid="import-commit-failures"
                className="m-0 pl-4 flex flex-col gap-0.5 text-xs text-destructive"
              >
                {[...new Set(outcome.failureReasons)].map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-1.5">
              {outcome.imported > 0 && outcome.firstConversationId && (
                <button
                  type="button"
                  data-testid="import-open-conversation"
                  onClick={() =>
                    openItemInWeb(
                      `/chat/${encodeURIComponent(outcome.firstConversationId as string)}`,
                    )
                  }
                  className="px-3 py-1.5 text-xs rounded-sm border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  {t('conversationImport.openConversation')}
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/chat/history')}
                className="px-3 py-1.5 text-xs rounded-sm border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
              >
                {t('conversationImport.backToHistory')}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 导入历史 */}
      <Card className="rounded-lg border-border shadow-none">
        <CardContent className="p-3 min-[640px]:p-3 flex flex-col gap-2">
          <p className="m-0 text-sm font-medium">{t('conversationImport.historyTitle')}</p>
          {historyLoading ? (
            <p className="m-0 text-xs text-muted-foreground">{t('common.loading')}</p>
          ) : history.length === 0 ? (
            <p className="m-0 text-xs text-muted-foreground">
              {t('conversationImport.historyEmpty')}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5" data-testid="import-history-list">
              {history.map((h) => {
                const statusKey = HISTORY_STATUS_KEY[h.status]
                return (
                  <div
                    key={h.id}
                    className="flex flex-col gap-0.5 rounded-md border border-border p-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{h.fileName || '—'}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {statusKey ? t(statusKey) : h.status}
                      </span>
                    </div>
                    <p className="m-0 text-muted-foreground break-all">
                      {t('conversationImport.historyParsed')}: {h.parsedCount} ·{' '}
                      {t('conversationImport.historyImported')}: {h.importedCount} ·{' '}
                      {t('conversationImport.historyFailed')}: {h.failedCount}
                      {h.errorMessage ? ` · ${h.errorMessage}` : ''}
                    </p>
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
