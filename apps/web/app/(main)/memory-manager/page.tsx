// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌​​‌‌‌‌​‌​‍‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌‌​‌​​‌‌‌​‍‌‌​​‌‌​​​‌​​‌​‌‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​​​​​‌‌‍​‌‌​‌‌​‌‌‍​‌‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 长期记忆管理(对标 Claude Code 的"无记忆"痛点;跨会话沉淀偏好/约定/教训)。
// 消费:
//   GET   /api/longterm-memory/entries                  → 列表 + type/importance 过滤
//   POST  /api/longterm-memory/entries                  → 手动新增
//   DELETE /api/longterm-memory/entries/{id}            → 删除
//   POST  /api/longterm-memory/entries/{id}/important   → 提升重要度(+1)
//   POST  /api/longterm-memory/extract                  → 归纳本会话(导入)
// 未登录(401)提示"请先登录"。后端:ai-service routers/agent_memory.py(prefix=/longterm-memory)。

'use client'

import * as React from 'react'
import { Brain, CircleX, Loader2, Plus, Search, Sparkles, Trash2, XCircle } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  MEMORY_TYPE_LABELS,
  MEMORY_TYPES,
  createMemoryEntry,
  deleteMemoryEntry,
  extractMemoryFromMessages,
  markMemoryImportant,
} from '@/api/longterm-memory-api'
import type { LongTermMemoryListResult } from '@/api/longterm-memory-api'

// "归纳本会话"的示例消息(含强化标记,可被规则式抽取,空会话返回 0)
const SAMPLE_MESSAGES: Array<{ role: string; content: string }> = [
  { role: 'user', content: '以后统一用 pnpm 管理依赖,遵循 monorepo 规范' },
  { role: 'assistant', content: '记住了,下次避免再用 npm 直接安装依赖' },
]

export default function MemoryManagerPage() {
  const [type, setType] = React.useState('')
  const [importanceMin, setImportanceMin] = React.useState(0)
  const [data, setData] = React.useState<LongTermMemoryListResult | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [needLogin, setNeedLogin] = React.useState(false)

  // 手动新增
  const [newOpen, setNewOpen] = React.useState(false)
  const [newType, setNewType] = React.useState('lesson_learned')
  const [newContent, setNewContent] = React.useState('')

  // 操作反馈
  const [busyId, setBusyId] = React.useState('')
  const [actionError, setActionError] = React.useState('')
  const [extracting, setExtracting] = React.useState(false)
  const [extractMsg, setExtractMsg] = React.useState('')

  const load = React.useCallback(async (typ: string, impMin: number) => {
    setLoading(true)
    setError('')
    setNeedLogin(false)
    const r = await fetchApi<LongTermMemoryListResult>(
      `/api/longterm-memory/entries?page=1&page_size=100${typ ? `&type=${encodeURIComponent(typ)}` : ''}${impMin ? `&importance_min=${impMin}` : ''}`,
    )
    setLoading(false)
    if (!r.success) {
      if (r.status === 401) setNeedLogin(true)
      else setError((r as { message?: string }).message || '加载长期记忆失败')
      setData(null)
      return
    }
    setData(r.data)
  }, [])

  React.useEffect(() => {
    void load(type, importanceMin)
  }, [load, type, importanceMin])

  const refresh = () => void load(type, importanceMin)

  const runOp = async (op: () => Promise<unknown>, id: string) => {
    setBusyId(id)
    setActionError('')
    try {
      await op()
      setActionError('')
      refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusyId('')
    }
  }

  const handleCreate = async () => {
    if (!newContent.trim()) return
    setActionError('')
    try {
      await createMemoryEntry({ type: newType, content: newContent.trim() })
      setNewContent('')
      setNewOpen(false)
      refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '新增失败')
    }
  }

  const handleExtract = async () => {
    setExtracting(true)
    setExtractMsg('')
    setActionError('')
    try {
      const res = await extractMemoryFromMessages(SAMPLE_MESSAGES)
      setExtractMsg(
        `归纳完成:导入 ${res.imported} 条(新增 ${res.stats.added} / 合并 ${res.stats.merged})`,
      )
      refresh()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '归纳失败')
    } finally {
      setExtracting(false)
    }
  }

  const items = data?.items ?? []
  const empty = !loading && !needLogin && !error && data && data.total === 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">长期记忆管理</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => void handleExtract()}
            disabled={extracting}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            {extracting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            归纳本会话
          </button>
          <button
            onClick={() => setNewOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> 新增记忆
          </button>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        跨会话沉淀的用户偏好 / 项目约定 / 踩坑教训,支持 type
        与重要度过滤、手动新增、删除与提升重要度。
      </p>

      {/* 过滤条 */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-muted-foreground">
          类型
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">全部</option>
            {MEMORY_TYPES.map((t) => (
              <option key={t} value={t}>
                {MEMORY_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-muted-foreground">
          重要度
          <select
            value={importanceMin}
            onChange={(e) => setImportanceMin(Number(e.target.value))}
            className="rounded-lg border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value={0}>全部</option>
            <option value={3}>≥3</option>
            <option value={4}>≥4</option>
            <option value={5}>5</option>
          </select>
        </label>
        <span className="ml-auto text-xs text-muted-foreground">
          {data ? `共 ${data.total} 条` : ''}
        </span>
      </div>

      {/* 手动新增 */}
      {newOpen && (
        <div className="mb-4 rounded-xl border p-4">
          <label className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            类型
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="rounded-lg border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MEMORY_TYPE_LABELS[t] ?? t}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="输入记忆内容,例如:用户偏好清新简洁的暗色主题"
            rows={2}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setNewOpen(false)}
              className="rounded-lg border px-3 py-1.5 text-sm transition hover:bg-muted"
            >
              取消
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={!newContent.trim()}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {extractMsg && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-600">
          <Sparkles className="h-4 w-4" /> {extractMsg}
        </p>
      )}
      {needLogin && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <CircleX className="h-4 w-4" /> 请先登录后管理长期记忆(该功能仅对已登录用户开放)
        </p>
      )}
      {(error || actionError) && (
        <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <XCircle className="h-4 w-4" /> {error || actionError}
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> 加载中…
        </div>
      )}
      {empty && (
        <div className="flex items-center justify-center gap-2 rounded-xl border py-16 text-sm text-muted-foreground">
          <Search className="h-5 w-5" /> 暂无长期记忆,可点右上角"归纳本会话"或手动新增
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((entry) => {
            const label = MEMORY_TYPE_LABELS[entry.type] ?? entry.type
            return (
              <div key={entry.memory_id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                    {label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3" /> 重要度 {entry.importance}
                  </span>
                  {entry.created_at && (
                    <span className="text-xs text-muted-foreground/70">{entry.created_at}</span>
                  )}
                  <span className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() =>
                        void runOp(() => markMemoryImportant(entry.memory_id), entry.memory_id)
                      }
                      disabled={busyId === entry.memory_id || entry.importance >= 5}
                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition hover:bg-muted disabled:opacity-40"
                    >
                      {busyId === entry.memory_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      提升重要度
                    </button>
                    <button
                      onClick={() =>
                        void runOp(() => deleteMemoryEntry(entry.memory_id), entry.memory_id)
                      }
                      disabled={busyId === entry.memory_id}
                      className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2 py-1 text-xs text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
                    >
                      {busyId === entry.memory_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      删除
                    </button>
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{entry.content}</p>
                {(entry.keywords?.length > 0 || entry.tags?.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(entry.tags ?? []).map((tag) => (
                      <span
                        key={`t-${tag}`}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                    {(entry.keywords ?? []).map((kw) => (
                      <span
                        key={`k-${kw}`}
                        className="rounded bg-background px-1.5 py-0.5 text-xs text-muted-foreground/70 ring-1 ring-border"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌​​‌‌‌‌​‌​‍‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍‌​‌‌​‌‌‌‍‌‌​​‌‌‌​‌​​‌‌‌​‍‌‌​​‌‌​​​‌​​‌​‌‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​​​​​‌‌‍​‌‌​‌‌​‌‌‍​‌‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠
