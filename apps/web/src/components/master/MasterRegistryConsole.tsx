// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { MasterChatPanel } from './MasterChatPanel'

interface DefinitionView {
  id: string
  name: string
  displayName: string
  scope: string
  status: string
  version: number
  role: string
  tools: string[]
  isBuiltin: boolean
  updatedAt: string
  deletedAt?: string | null
  purgeAfter?: string | null
  stats?: { runs7d?: number; successRate?: number; costPoints7d?: string | number }
}

interface ApprovalView {
  id: string
  action?: string
  status: string
  definitionId?: string
  requestedBy?: string
  expiresAt?: string
  impactHash?: string
  definitionName?: string
}

interface ApiBody<T> {
  code: number
  message: string
  errorCode?: string
  data?: T
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = (await response.json()) as ApiBody<T>
  if (!response.ok || body.code !== 0) {
    throw new Error(body.errorCode ? `${body.errorCode}: ${body.message}` : body.message)
  }
  return body.data as T
}

export function MasterRegistryConsole() {
  const [items, setItems] = useState<DefinitionView[]>([])
  const [approvals, setApprovals] = useState<ApprovalView[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<DefinitionView | null>(null)
  const [versions, setVersions] = useState<Array<Record<string, unknown>>>([])
  const [approval, setApproval] = useState<ApprovalView | null>(null)
  const [typedName, setTypedName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    displayName: '',
    scope: 'personal',
    teamId: '',
    systemPrompt: '',
    tools: '',
  })

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '30' })
      if (query.trim()) params.set('q', query.trim())
      if (status) params.set('status', status)
      const [defs, apps] = await Promise.all([
        api<{ items: DefinitionView[]; total: number }>(
          `/api/agent-registry/definitions?${params}`,
        ),
        api<{ items?: ApprovalView[] }>(
          '/api/agent-registry/approvals?status=pending&limit=20',
        ).catch(() => ({ items: [] as ApprovalView[] })),
      ])
      setItems(defs.items)
      setApprovals(apps.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [query, status])

  useEffect(() => {
    void reload()
  }, [reload])

  async function inspect(item: DefinitionView) {
    setSelected(item)
    setVersions([])
    try {
      const result = await api<{ items?: Array<Record<string, unknown>> }>(
        `/api/agent-registry/definitions/${item.id}/versions?limit=20`,
      )
      setVersions(result.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '版本加载失败')
    }
  }

  async function toggle(item: DefinitionView) {
    try {
      const action = item.status === 'active' ? 'disable' : 'enable'
      await api(`/api/agent-registry/definitions/${item.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ ifVersion: item.version }),
      })
      setNotice(`${item.displayName} 已${action === 'disable' ? '停用' : '启用'}`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    }
  }

  async function startDelete(item: DefinitionView) {
    try {
      const precheck = await api<{ precheckToken: string; impact?: unknown }>(
        `/api/agent-registry/definitions/${item.id}/precheck-delete`,
        { method: 'POST', body: JSON.stringify({}) },
      )
      const created = await api<{ approvalId: string; status: string; expiresAt: string }>(
        `/api/agent-registry/definitions/${item.id}`,
        {
          method: 'DELETE',
          body: JSON.stringify({
            precheckToken: precheck.precheckToken,
            reason: '控制台发起删除审批',
          }),
        },
      )
      const detail = await api<ApprovalView>(`/api/agent-registry/approvals/${created.approvalId}`)
      setApproval(detail)
      setTypedName('')
      setNotice('删除审批已生成，请在右侧确认；未确认前不会删除。')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除预检失败')
    }
  }

  async function decide(approved: boolean) {
    if (!approval) return
    try {
      await api(`/api/agent-registry/approvals/${approval.id}/${approved ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: JSON.stringify(
          approved ? { typedName, reason: '控制台二次确认' } : { reason: '控制台拒绝' },
        ),
      })
      setNotice(approved ? '已批准并执行' : '已拒绝')
      setApproval(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '审批失败')
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    try {
      await api('/api/agent-registry/definitions', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          displayName: form.displayName.trim(),
          scope: form.scope,
          teamId: form.scope === 'team' ? form.teamId.trim() || null : null,
          systemPrompt: form.systemPrompt,
          tools: form.tools
            .split(',')
            .map((tool) => tool.trim())
            .filter(Boolean),
        }),
      })
      setShowCreate(false)
      setForm({
        name: '',
        displayName: '',
        scope: 'personal',
        teamId: '',
        systemPrompt: '',
        tools: '',
      })
      setNotice('定义已创建')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-6 text-slate-900 dark:text-slate-100">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">总管 · 智能体控制台</h1>
          <p className="mt-1 text-sm text-slate-500">
            一个注册表、一个运行账本、一层审批。删除只发起审批，不在这里直接抹掉。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((value) => !value)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900"
        >
          {showCreate ? '收起' : '新建定义'}
        </button>
      </header>

      <div className="mb-6">
        <MasterChatPanel />
      </div>

      {(error || notice) && (
        <div className="mb-4 space-y-2">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {notice && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>
          )}
        </div>
      )}

      {showCreate && (
        <form onSubmit={create} className="mb-6 grid gap-3 rounded-xl border p-4 md:grid-cols-2">
          <input
            required
            placeholder="name（小写，a-z0-9_-）"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="显示名"
            value={form.displayName}
            onChange={(event) => setForm({ ...form, displayName: event.target.value })}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={form.scope}
            onChange={(event) => setForm({ ...form, scope: event.target.value })}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="personal">个人</option>
            <option value="team">团队（需先选团队）</option>
          </select>
          {form.scope === 'team' && (
            <input
              required
              placeholder="teamId（UUID，必填）"
              value={form.teamId}
              onChange={(event) => setForm({ ...form, teamId: event.target.value })}
              className="rounded-lg border px-3 py-2 text-sm"
            />
          )}
          <input
            placeholder="工具，逗号分隔（可空）"
            value={form.tools}
            onChange={(event) => setForm({ ...form, tools: event.target.value })}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <textarea
            required
            placeholder="systemPrompt"
            value={form.systemPrompt}
            onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })}
            className="min-h-28 rounded-lg border px-3 py-2 text-sm md:col-span-2"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white md:col-span-2"
          >
            创建（只写配置，不启动）
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          placeholder="搜索名称/描述"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">全部状态</option>
          <option value="active">启用</option>
          <option value="disabled">停用</option>
          <option value="deleted">已删除（30 天内）</option>
        </select>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          刷新
        </button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-slate-500">加载中…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border py-12 text-center text-sm text-slate-500">暂无可见定义</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-3">名称</th>
                <th className="px-3 py-3">范围</th>
                <th className="px-3 py-3">状态</th>
                <th className="px-3 py-3">版本</th>
                <th className="px-3 py-3">7 天运行</th>
                <th className="px-3 py-3">成功率</th>
                <th className="px-3 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-3">
                    <div className="font-medium">{item.displayName}</div>
                    <div className="text-xs text-slate-500">{item.name}</div>
                  </td>
                  <td className="px-3 py-3">{item.scope}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">{item.version}</td>
                  <td className="px-3 py-3">{item.stats?.runs7d ?? 0}</td>
                  <td className="px-3 py-3">
                    {item.stats?.successRate === null || item.stats?.successRate === undefined
                      ? '—'
                      : `${Math.round(Number(item.stats.successRate) * 100)}%`}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() => void inspect(item)}
                      >
                        版本
                      </button>
                      {item.status !== 'deleted' && (
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-xs"
                          onClick={() => void toggle(item)}
                        >
                          {item.status === 'active' ? '停用' : '启用'}
                        </button>
                      )}
                      {item.status !== 'deleted' && !item.isBuiltin && (
                        <button
                          type="button"
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                          onClick={() => void startDelete(item)}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(selected || approval) && (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l bg-white p-5 shadow-xl dark:bg-slate-950">
          {approval && (
            <section className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
              <h2 className="font-semibold">待确认删除</h2>
              <p className="mt-1 text-sm">输入定义名确认；批准后执行删除，未确认前不会动数据。</p>
              <p className="mt-2 text-xs">审批 ID：{approval.id}</p>
              <input
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
                placeholder="输入定义名"
                className="mt-3 w-full rounded-lg border px-3 py-2 text-sm text-slate-900"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={!typedName.trim()}
                  onClick={() => void decide(true)}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  批准删除
                </button>
                <button
                  type="button"
                  onClick={() => void decide(false)}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                >
                  拒绝
                </button>
              </div>
            </section>
          )}

          {selected && (
            <section>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{selected.displayName}</h2>
                  <p className="text-xs text-slate-500">{selected.name}</p>
                </div>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() => setSelected(null)}
                >
                  关闭
                </button>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-slate-500">ID</dt>
                  <dd className="break-all">{selected.id}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">版本</dt>
                  <dd>{selected.version}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">工具</dt>
                  <dd>{selected.tools.join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">更新</dt>
                  <dd>{selected.updatedAt}</dd>
                </div>
              </dl>
              <h3 className="mt-5 text-sm font-semibold">历史版本</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {versions.length === 0 && <li className="text-slate-500">暂无版本</li>}
                {versions.map((version) => (
                  <li key={String(version.version)} className="rounded-lg border px-3 py-2">
                    v{String(version.version)} · {String(version.changeKind ?? '')} ·{' '}
                    {String(version.createdAt ?? '')}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">待审批（{approvals.length}）</h2>
        {approvals.length === 0 ? (
          <p className="rounded-xl border py-8 text-center text-sm text-slate-500">没有待审批</p>
        ) : (
          <ul className="space-y-2">
            {approvals.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {item.definitionName ?? item.action ?? '删除审批'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.id} · {item.status}
                  </div>
                </div>
                <div className="text-xs text-slate-500">到期：{item.expiresAt ?? '—'}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
