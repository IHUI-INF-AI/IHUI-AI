// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Activity, ArrowLeft, Boxes, MessageSquare, Plus, ShieldCheck } from 'lucide-react'

import { MasterChatPanel } from './MasterChatPanel'
import { MasterIdentityHeader } from './MasterIdentityHeader'
import { MasterRunControlPanel } from './MasterRunControlPanel'

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

interface MasterProfileView {
  displayName: string
  defaultDisplayName?: string
  maxLength?: number
  isCustom?: boolean
}

const DEFAULT_MASTER_NAME = '总管'

type ConsoleView = 'chat' | 'run' | 'registry' | 'approvals'

const VIEW_LABELS: Record<ConsoleView, string> = {
  chat: '对话',
  run: '运行控制',
  registry: '智能体注册表',
  approvals: '待审批',
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      // cookie 鉴权下，API 的写方法要求这个头过 CSRF；Bearer 链路不受影响。
      'X-Requested-With': 'XMLHttpRequest',
      ...(init?.headers ?? {}),
    },
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
  const [masterName, setMasterName] = useState(DEFAULT_MASTER_NAME)
  const [masterNameMax, setMasterNameMax] = useState(24)
  const [selected, setSelected] = useState<DefinitionView | null>(null)
  const [versions, setVersions] = useState<Array<Record<string, unknown>>>([])
  const [approval, setApproval] = useState<ApprovalView | null>(null)
  const [typedName, setTypedName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [view, setView] = useState<ConsoleView>('chat')
  const [chatKey, setChatKey] = useState(0)
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

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const profile = await api<MasterProfileView>('/api/master/profile')
        if (!alive) return
        setMasterName(profile.displayName || DEFAULT_MASTER_NAME)
        if (profile.maxLength) setMasterNameMax(profile.maxLength)
      } catch {
        // 未登录或接口暂不可用时保持默认名，不阻断注册表和对话。
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    document.title = `${masterName} · 智能体控制台`
  }, [masterName])

  async function renameMaster(next: string) {
    const profile = await api<MasterProfileView>('/api/master/profile', {
      method: 'PUT',
      body: JSON.stringify({ displayName: next }),
    })
    setMasterName(profile.displayName || next)
    setMasterNameMax(profile.maxLength || masterNameMax)
    setNotice(`已改名为「${profile.displayName || next}」，下一轮对话会用它自称。`)
  }

  async function resetMaster() {
    const profile = await api<MasterProfileView>('/api/master/profile', { method: 'DELETE' })
    setMasterName(profile.displayName || DEFAULT_MASTER_NAME)
    setNotice('已恢复默认名「总管」。')
  }

  function newConversation() {
    setChatKey((value) => value + 1)
    setView('chat')
  }

  function toggleCreate() {
    if (!showCreate) setView('registry')
    setShowCreate((value) => !value)
  }

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

  const initial = Array.from(masterName)[0] ?? '总'
  const navItems: Array<{
    key: ConsoleView
    label: string
    icon: typeof MessageSquare
    count?: number
    attention?: boolean
  }> = [
    { key: 'chat', label: '对话', icon: MessageSquare },
    { key: 'run', label: '运行控制', icon: Activity },
    { key: 'registry', label: '智能体注册表', icon: Boxes, count: items.length },
    {
      key: 'approvals',
      label: '待审批',
      icon: ShieldCheck,
      count: approvals.length,
      attention: approvals.length > 0,
    },
  ]

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#0a0c10] text-[#e6e9ee]">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/workspace"
            aria-label="返回工作台"
            className="mr-1 flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.07] text-white/30 transition hover:bg-white/[0.05] hover:text-white/60"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-400 text-[12px] font-semibold text-[#07110b]">
            {initial}
          </span>
          <span className="truncate text-[12px] font-medium text-white/80">{masterName}</span>
          <span className="text-[10px] text-white/25">Agent Window</span>
          <span className="text-[10px] text-white/10">/</span>
          <span className="truncate text-[11px] text-white/40">{VIEW_LABELS[view]}</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10px] text-white/30">
          <span className="inline-flex items-center gap-1.5 text-emerald-300/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            在线
          </span>
          <span className="hidden sm:inline">注册表 {items.length}</span>
          <span className="hidden sm:inline">待审批 {approvals.length}</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-[212px] shrink-0 flex-col border-r border-white/[0.06] lg:flex">
          <div className="p-3">
            <button
              type="button"
              onClick={newConversation}
              className="flex h-9 w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-2.5 text-[11px] text-white/55 transition hover:bg-white/[0.06] hover:text-white/80"
            >
              <Plus className="h-3.5 w-3.5" />
              新建对话
            </button>
          </div>

          <div className="px-4 pt-2 text-[9px] uppercase tracking-[0.18em] text-white/20">
            工作台
          </div>
          <nav className="mt-1.5 space-y-0.5 px-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = view === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setView(item.key)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11px] transition ${
                    active
                      ? 'bg-white/[0.06] text-white/80'
                      : 'text-white/40 hover:bg-white/[0.03] hover:text-white/65'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.count !== undefined && (
                    <span
                      className={`text-[9px] tabular-nums ${
                        item.attention ? 'text-amber-300/80' : 'text-white/25'
                      }`}
                    >
                      {loading ? '…' : item.count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="mt-6 px-4 text-[9px] uppercase tracking-[0.18em] text-white/20">
            运行边界
          </div>
          <div className="mt-2 px-3 text-[10px] leading-5 text-white/30">
            固定人格 · 三工具
            <br />
            删除与回滚必须审批
            <br />
            控制面只作用于 single run
          </div>

          <div className="mt-auto border-t border-white/[0.06] p-3 text-[10px] leading-5 text-white/25">
            <p className="text-white/40">个人工作区</p>
            <p>注册表按账号隔离</p>
          </div>
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col">
          {view === 'chat' && <MasterChatPanel key={chatKey} masterName={masterName} />}
          {view === 'run' && <MasterRunControlPanel masterName={masterName} />}

          {view === 'registry' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/25">
                    Agent registry
                  </p>
                  <h2 className="mt-1.5 text-[16px] font-medium text-white/85">
                    智能体注册表{' '}
                    <span className="text-[11px] font-normal tabular-nums text-white/30">
                      {items.length}
                    </span>
                  </h2>
                </div>
                <p className="text-[10px] text-white/30">删除只发起审批，不在这里直接抹掉。</p>
              </div>

              {showCreate && (
                <form
                  onSubmit={create}
                  className="grid shrink-0 gap-2 border-b border-white/[0.06] bg-white/[0.02] px-5 py-4 md:grid-cols-2"
                >
                  <input
                    required
                    placeholder="name（小写，a-z0-9_-）"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    className="rounded-md border border-white/[0.08] bg-[#111419] px-3 py-2 text-[11px] text-white/75 outline-none placeholder:text-white/20"
                  />
                  <input
                    required
                    placeholder="显示名"
                    value={form.displayName}
                    onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                    className="rounded-md border border-white/[0.08] bg-[#111419] px-3 py-2 text-[11px] text-white/75 outline-none placeholder:text-white/20"
                  />
                  <select
                    value={form.scope}
                    onChange={(event) => setForm({ ...form, scope: event.target.value })}
                    className="rounded-md border border-white/[0.08] bg-[#111419] px-3 py-2 text-[11px] text-white/75 outline-none"
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
                      className="rounded-md border border-white/[0.08] bg-[#111419] px-3 py-2 text-[11px] text-white/75 outline-none placeholder:text-white/20"
                    />
                  )}
                  <input
                    placeholder="工具，逗号分隔（可空）"
                    value={form.tools}
                    onChange={(event) => setForm({ ...form, tools: event.target.value })}
                    className="rounded-md border border-white/[0.08] bg-[#111419] px-3 py-2 text-[11px] text-white/75 outline-none placeholder:text-white/20"
                  />
                  <textarea
                    required
                    placeholder="systemPrompt"
                    value={form.systemPrompt}
                    onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })}
                    className="min-h-24 rounded-md border border-white/[0.08] bg-[#111419] px-3 py-2 text-[11px] text-white/75 outline-none placeholder:text-white/20 md:col-span-2"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-400 px-4 py-2 text-[11px] font-medium text-[#07110b] md:col-span-2"
                  >
                    创建（只写配置，不启动）
                  </button>
                </form>
              )}

              <div className="flex shrink-0 flex-wrap gap-2 px-5 py-3">
                <input
                  placeholder="搜索名称/描述"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-56 flex-1 rounded-md border border-white/[0.08] bg-[#111419] px-3 py-2 text-[11px] text-white/75 outline-none placeholder:text-white/20 focus:border-emerald-400/30"
                />
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="rounded-md border border-white/[0.08] bg-[#111419] px-3 py-2 text-[11px] text-white/60 outline-none"
                >
                  <option value="">全部状态</option>
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                  <option value="deleted">已删除（30 天内）</option>
                </select>
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="rounded-md border border-white/[0.08] px-3 py-2 text-[11px] text-white/45 transition hover:bg-white/[0.04] hover:text-white/70"
                >
                  刷新
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto px-5 pb-5">
                {loading ? (
                  <p className="py-12 text-center text-[11px] text-white/25">加载中…</p>
                ) : items.length === 0 ? (
                  <p className="rounded-md border border-white/[0.06] py-12 text-center text-[11px] text-white/25">
                    暂无可见定义
                  </p>
                ) : (
                  <table className="w-full min-w-[860px] text-left text-[11px]">
                    <thead className="text-[9px] uppercase tracking-[0.12em] text-white/25">
                      <tr className="border-b border-white/[0.07]">
                        <th className="px-2.5 py-2.5 font-medium">名称</th>
                        <th className="px-2.5 py-2.5 font-medium">范围</th>
                        <th className="px-2.5 py-2.5 font-medium">状态</th>
                        <th className="px-2.5 py-2.5 font-medium">版本</th>
                        <th className="px-2.5 py-2.5 font-medium">7 天运行</th>
                        <th className="px-2.5 py-2.5 font-medium">成功率</th>
                        <th className="px-2.5 py-2.5 text-right font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-white/[0.05] transition hover:bg-white/[0.025]"
                        >
                          <td className="px-2.5 py-3">
                            <div className="text-white/75">{item.displayName}</div>
                            <div className="mt-0.5 text-[9px] text-white/25">{item.name}</div>
                          </td>
                          <td className="px-2.5 py-3 text-white/40">{item.scope}</td>
                          <td className="px-2.5 py-3">
                            <span className="rounded border border-white/[0.06] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/45">
                              {item.status}
                            </span>
                          </td>
                          <td className="px-2.5 py-3 tabular-nums text-white/40">{item.version}</td>
                          <td className="px-2.5 py-3 tabular-nums text-white/40">
                            {item.stats?.runs7d ?? 0}
                          </td>
                          <td className="px-2.5 py-3 tabular-nums text-white/40">
                            {item.stats?.successRate === null ||
                            item.stats?.successRate === undefined
                              ? '—'
                              : `${Math.round(Number(item.stats.successRate) * 100)}%`}
                          </td>
                          <td className="px-2.5 py-3">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                className="rounded border border-white/[0.07] px-2 py-1 text-[10px] text-white/40 transition hover:text-white/70"
                                onClick={() => void inspect(item)}
                              >
                                版本
                              </button>
                              {item.status !== 'deleted' && (
                                <button
                                  type="button"
                                  className="rounded border border-white/[0.07] px-2 py-1 text-[10px] text-white/40 transition hover:text-white/70"
                                  onClick={() => void toggle(item)}
                                >
                                  {item.status === 'active' ? '停用' : '启用'}
                                </button>
                              )}
                              {item.status !== 'deleted' && !item.isBuiltin && (
                                <button
                                  type="button"
                                  className="rounded border border-red-400/15 px-2 py-1 text-[10px] text-red-300/70 transition hover:bg-red-400/10"
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
                )}
              </div>
            </div>
          )}

          {view === 'approvals' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-end justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-white/25">Approvals</p>
                  <h2 className="mt-1.5 text-[16px] font-medium text-white/85">
                    待审批{' '}
                    <span className="text-[11px] font-normal tabular-nums text-white/30">
                      {approvals.length}
                    </span>
                  </h2>
                </div>
                <p className="text-[10px] text-white/30">删除与回滚在这里二次确认。</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {approvals.length === 0 ? (
                  <p className="rounded-md border border-white/[0.06] py-12 text-center text-[11px] text-white/25">
                    没有待审批
                  </p>
                ) : (
                  <ul className="space-y-0 divide-y divide-white/[0.06] rounded-md border border-white/[0.06]">
                    {approvals.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-[11px]"
                      >
                        <div>
                          <div className="text-white/70">
                            {item.definitionName ?? item.action ?? '删除审批'}
                          </div>
                          <div className="mt-0.5 text-[9px] text-white/25">
                            {item.id} · {item.status}
                          </div>
                        </div>
                        <div className="text-[10px] text-white/25">
                          到期：{item.expiresAt ?? '—'}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </main>

        {view !== 'registry' && view !== 'approvals' && (
          <aside className="hidden min-[1280px]:flex w-[310px] shrink-0 flex-col overflow-y-auto border-l border-white/[0.06]">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] px-4 text-[10px]">
              <span className="text-white/45">总管的工作台</span>
              <span className="text-[9px] uppercase tracking-[0.14em] text-white/20">
                Master badge
              </span>
            </div>
            <MasterIdentityHeader
              name={masterName}
              maxLength={masterNameMax}
              definitionCount={items.length}
              approvalCount={approvals.length}
              loading={loading}
              creating={showCreate}
              onRename={renameMaster}
              onReset={resetMaster}
              onToggleCreate={toggleCreate}
            />

            <div className="mt-4 border-t border-white/[0.06] px-4 pt-3">
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/20">最近注册</p>
              {items.length === 0 ? (
                <p className="mt-2 text-[10px] text-white/25">暂无</p>
              ) : (
                <ul className="mt-1 divide-y divide-white/[0.05]">
                  {items.slice(0, 4).map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setView('registry')
                          void inspect(item)
                        }}
                        className="flex w-full items-center gap-2 py-2 text-left text-[10px] text-white/40 transition hover:text-white/70"
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            item.status === 'active' ? 'bg-emerald-400/70' : 'bg-white/15'
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate">{item.displayName}</span>
                        <span className="text-white/20">v{item.version}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 border-t border-white/[0.06] px-4 pt-3">
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/20">待审批</p>
              {approvals.length === 0 ? (
                <p className="mt-2 text-[10px] text-white/25">没有待处理</p>
              ) : (
                <ul className="mt-1 divide-y divide-white/[0.05]">
                  {approvals.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setView('approvals')}
                        className="flex w-full items-center gap-2 py-2 text-left text-[10px] text-amber-200/60 transition hover:text-amber-200/90"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/70" />
                        <span className="min-w-0 flex-1 truncate">
                          {item.definitionName ?? item.action ?? '删除审批'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="mt-auto px-4 py-4 text-[9px] leading-4 text-white/20">
              数据只来自 /api/master 与 /api/agent-registry；无本地假数据。
            </p>
          </aside>
        )}
      </div>

      {(selected || approval) && (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[420px] overflow-y-auto border-l border-white/[0.08] bg-[#101318] p-5 text-white/70 shadow-2xl">
          {approval && (
            <section className="mb-6 rounded-lg border border-amber-400/20 bg-amber-400/[0.07] p-4 text-amber-100">
              <h2 className="text-[13px] font-medium">待确认删除</h2>
              <p className="mt-1 text-[11px] leading-5 text-amber-100/60">
                输入定义名确认；批准后执行删除，未确认前不会动数据。
              </p>
              <p className="mt-2 font-mono text-[9px] text-amber-100/35">审批 ID：{approval.id}</p>
              <input
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
                placeholder="输入定义名"
                className="mt-3 w-full rounded-md border border-amber-400/20 bg-[#0b0d11] px-3 py-2 text-[12px] text-white/80 outline-none placeholder:text-white/25"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={!typedName.trim()}
                  onClick={() => void decide(true)}
                  className="flex-1 rounded-md bg-red-500/80 px-3 py-2 text-[11px] font-medium text-white disabled:opacity-30"
                >
                  批准删除
                </button>
                <button
                  type="button"
                  onClick={() => void decide(false)}
                  className="flex-1 rounded-md border border-white/10 px-3 py-2 text-[11px] text-white/60"
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
                  <h2 className="text-[15px] font-medium text-white/85">{selected.displayName}</h2>
                  <p className="mt-0.5 text-[9px] text-white/25">{selected.name}</p>
                </div>
                <button
                  type="button"
                  className="rounded border border-white/[0.08] px-2 py-1 text-[10px] text-white/40"
                  onClick={() => setSelected(null)}
                >
                  关闭
                </button>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <dt className="text-[9px] uppercase tracking-[0.12em] text-white/25">ID</dt>
                  <dd className="mt-1 break-all text-white/50">{selected.id}</dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-[0.12em] text-white/25">版本</dt>
                  <dd className="mt-1 tabular-nums text-white/50">{selected.version}</dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-[0.12em] text-white/25">工具</dt>
                  <dd className="mt-1 break-words text-white/50">
                    {selected.tools.join(', ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[9px] uppercase tracking-[0.12em] text-white/25">更新</dt>
                  <dd className="mt-1 break-all text-white/50">{selected.updatedAt}</dd>
                </div>
              </dl>
              <h3 className="mt-6 text-[10px] uppercase tracking-[0.14em] text-white/25">
                历史版本
              </h3>
              <ul className="mt-2 divide-y divide-white/[0.05] rounded-md border border-white/[0.07]">
                {versions.length === 0 && (
                  <li className="px-3 py-3 text-[11px] text-white/25">暂无版本</li>
                )}
                {versions.map((version) => (
                  <li key={String(version.version)} className="px-3 py-2.5 text-[11px] text-white/40">
                    v{String(version.version)} · {String(version.changeKind ?? '')} ·{' '}
                    {String(version.createdAt ?? '')}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      )}

      {(error || notice) && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 w-full max-w-xl -translate-x-1/2 px-4">
          {error && (
            <p className="rounded-md border border-red-400/20 bg-[#1b1214]/95 px-3 py-2 text-center text-[11px] text-red-200 shadow-lg">
              {error}
            </p>
          )}
          {notice && (
            <p className="mt-1 rounded-md border border-emerald-400/15 bg-[#0f1915]/95 px-3 py-2 text-center text-[11px] text-emerald-200/80 shadow-lg">
              {notice}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
