// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  Bot,
  Boxes,
  ChevronDown,
  Menu,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

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
      setNotice('删除审批已生成，请在待审批中确认；未确认前不会删除。')
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

  const navItems: Array<{
    key: ConsoleView
    label: string
    icon: typeof MessageSquare
    count?: number
    attention?: boolean
  }> = [
    { key: 'chat', label: masterName, icon: MessageSquare },
    { key: 'registry', label: '智能体注册表', icon: Boxes, count: items.length },
    { key: 'run', label: '运行控制', icon: Activity },
    {
      key: 'approvals',
      label: '待审批',
      icon: ShieldCheck,
      count: approvals.length,
      attention: approvals.length > 0,
    },
  ]

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ef] text-[#24211c]">
      <header className="flex h-[60px] shrink-0 items-center gap-1 border-b border-[#e8e3da] bg-[#faf9f6] px-3 text-[14px] text-[#716a5f]">
        <Link
          href="/workspace"
          aria-label="返回工作台"
          title="返回工作台"
          className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-[#7d7569] transition hover:bg-[#eeeae3] hover:text-[#3f3a32]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <button
          type="button"
          aria-label="菜单"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#716a5f] transition hover:bg-[#eeeae3]"
        >
          <Menu className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="搜索"
          onClick={() => setView('registry')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#716a5f] transition hover:bg-[#eeeae3]"
        >
          <Search className="h-4 w-4" />
        </button>
        <span className="mx-2 h-4 w-px bg-[#ded8cd]" />
        {['文件', '编辑', '查看', '帮助'].map((label) => (
          <span
            key={label}
            className="cursor-default rounded-md px-2 py-1 text-[14px] text-[#857d71]"
          >
            {label}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-3 pr-1 text-[11px] text-[#938b7f]">
          <Sparkles className="h-4 w-4 text-[#a79e91]" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden pt-6">
        <aside className="flex w-[336px] shrink-0 flex-col overflow-hidden px-3 pb-3 max-lg:w-[280px]">
          <button
            type="button"
            onClick={newConversation}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[15px] text-[#4c463d] transition hover:bg-[#ece8e1]"
          >
            <Plus className="h-[18px] w-[18px] text-[#6f685d]" />
            新建任务
          </button>

          <nav className="mt-1 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = view === item.key
              const isMaster = item.key === 'chat'
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setView(item.key)}
                  className={`flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[15px] transition ${
                    active
                      ? 'bg-[#e9e5dd] font-medium text-[#1f1c18]'
                      : 'text-[#4c463d] hover:bg-[#ece8e1] hover:text-[#26221c]'
                  }`}
                >
                  {isMaster ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#252b39]">
                      <Bot className="h-4 w-4 text-[#e9efe6]" />
                    </span>
                  ) : (
                    <Icon className="h-[18px] w-[18px] shrink-0 text-[#6f685d]" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.count !== undefined && (
                    <span
                      className={`text-[11px] tabular-nums ${
                        item.attention ? 'text-[#a36e2a]' : 'text-[#a39b8f]'
                      }`}
                    >
                      {loading ? '…' : item.count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="mt-6 rounded-[10px] border border-[#e9e3d9] bg-[#faf8f4] px-3.5 py-3 text-[11px] leading-5 text-[#9d9487]">
            <p className="mb-1 text-[10px] tracking-[0.1em] text-[#b0a79b]">运行边界</p>
            <p>固定人格 · 三工具</p>
            <p>删除与回滚必须审批</p>
            <p>控制面只作用于 single run</p>
          </div>

          <div className="mt-10 flex items-center justify-between px-2 text-[13px] text-[#948c80]">
            <span className="inline-flex items-center gap-1">
              项目
              <ChevronDown className="h-3.5 w-3.5" />
            </span>
            <button
              type="button"
              aria-label="新建项目"
              onClick={toggleCreate}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#a49c90] transition hover:bg-[#ece8e1] hover:text-[#5d564b]"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-14 flex flex-col items-center gap-2 text-[#aaa298]">
            <MessageSquare className="h-8 w-8 text-[#cbc4b8]" strokeWidth={1.3} />
            <p className="text-[13px]">暂无任务</p>
          </div>

          <div className="mt-auto flex items-center gap-2.5 border-t border-[#e9e4da] px-2 pt-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e2dcd1] text-[12px] font-medium text-[#6b6458]">
              李
            </span>
            <div className="min-w-0 text-[11px] leading-4 text-[#9b9387]">
              <p className="truncate text-[12px] text-[#5f584d]">个人工作区</p>
              <p className="truncate">注册表按账号隔离</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-3 pr-3">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-[#e8e3da] bg-white shadow-[0_1px_2px_rgba(34,28,18,0.03)]">
            {view === 'chat' && (
              <>
                <MasterIdentityHeader
                  name={masterName}
                  maxLength={masterNameMax}
                  onRename={renameMaster}
                  onReset={resetMaster}
                />
                <div className="min-h-0 flex-1">
                  <MasterChatPanel key={chatKey} masterName={masterName} />
                </div>
              </>
            )}

            {view === 'run' && <MasterRunControlPanel masterName={masterName} />}

            {view === 'registry' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[#f0ebe3] px-7 py-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#a29a8e]">
                      Agent registry
                    </p>
                    <h2 className="mt-1 text-[22px] font-semibold leading-8 text-[#23211c]">
                      智能体注册表{' '}
                      <span className="text-[14px] font-normal tabular-nums text-[#9c9488]">
                        {items.length}
                      </span>
                    </h2>
                    <p className="mt-1 text-[12px] text-[#8d8579]">
                      删除只发起审批，不在这里直接抹掉。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleCreate}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#23211d] px-3.5 py-2 text-[12px] font-medium text-white transition hover:bg-[#3a372f]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {showCreate ? '收起新建' : '新建定义'}
                  </button>
                </div>

                {showCreate && (
                  <form
                    onSubmit={create}
                    className="grid shrink-0 gap-2 border-b border-[#f0ebe3] bg-[#faf8f4] px-7 py-4 md:grid-cols-2"
                  >
                    <input
                      required
                      placeholder="name（小写，a-z0-9_-）"
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      className="rounded-lg border border-[#e3ddd2] bg-white px-3 py-2 text-[12px] text-[#3b352c] outline-none placeholder:text-[#b1a99d]"
                    />
                    <input
                      required
                      placeholder="显示名"
                      value={form.displayName}
                      onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                      className="rounded-lg border border-[#e3ddd2] bg-white px-3 py-2 text-[12px] text-[#3b352c] outline-none placeholder:text-[#b1a99d]"
                    />
                    <select
                      value={form.scope}
                      onChange={(event) => setForm({ ...form, scope: event.target.value })}
                      className="rounded-lg border border-[#e3ddd2] bg-white px-3 py-2 text-[12px] text-[#3b352c] outline-none"
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
                        className="rounded-lg border border-[#e3ddd2] bg-white px-3 py-2 text-[12px] text-[#3b352c] outline-none placeholder:text-[#b1a99d]"
                      />
                    )}
                    <input
                      placeholder="工具，逗号分隔（可空）"
                      value={form.tools}
                      onChange={(event) => setForm({ ...form, tools: event.target.value })}
                      className="rounded-lg border border-[#e3ddd2] bg-white px-3 py-2 text-[12px] text-[#3b352c] outline-none placeholder:text-[#b1a99d]"
                    />
                    <textarea
                      required
                      placeholder="systemPrompt"
                      value={form.systemPrompt}
                      onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })}
                      className="min-h-24 rounded-lg border border-[#e3ddd2] bg-white px-3 py-2 text-[12px] text-[#3b352c] outline-none placeholder:text-[#b1a99d] md:col-span-2"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[#23211d] px-4 py-2.5 text-[12px] font-medium text-white md:col-span-2"
                    >
                      创建（只写配置，不启动）
                    </button>
                  </form>
                )}

                <div className="flex shrink-0 flex-wrap gap-2 px-7 py-3">
                  <input
                    placeholder="搜索名称/描述"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-w-56 flex-1 rounded-lg border border-[#e3ddd2] bg-[#faf9f6] px-3 py-2 text-[12px] text-[#3b352c] outline-none placeholder:text-[#b1a99d] focus:border-[#bdb5a8]"
                  />
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="rounded-lg border border-[#e3ddd2] bg-[#faf9f6] px-3 py-2 text-[12px] text-[#615a4f] outline-none"
                  >
                    <option value="">全部状态</option>
                    <option value="active">启用</option>
                    <option value="disabled">停用</option>
                    <option value="deleted">已删除（30 天内）</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void reload()}
                    className="rounded-lg border border-[#ded8ce] bg-white px-3 py-2 text-[12px] text-[#6d665b] transition hover:bg-[#f7f4ef]"
                  >
                    刷新
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-7 pb-6">
                  {loading ? (
                    <p className="py-14 text-center text-[12px] text-[#a29a8e]">加载中…</p>
                  ) : items.length === 0 ? (
                    <p className="rounded-xl border border-[#eee9e1] bg-[#faf9f6] py-14 text-center text-[12px] text-[#a29a8e]">
                      暂无可见定义
                    </p>
                  ) : (
                    <table className="w-full min-w-[860px] text-left text-[12px]">
                      <thead className="text-[10px] uppercase tracking-[0.12em] text-[#a29a8e]">
                        <tr className="border-b border-[#eee9e1]">
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
                            className="border-b border-[#f3efe8] transition hover:bg-[#faf8f4]"
                          >
                            <td className="px-2.5 py-3">
                              <div className="font-medium text-[#332f28]">{item.displayName}</div>
                              <div className="mt-0.5 text-[10px] text-[#aaa296]">{item.name}</div>
                            </td>
                            <td className="px-2.5 py-3 text-[#7a7266]">{item.scope}</td>
                            <td className="px-2.5 py-3">
                              <span className="rounded-full border border-[#e5dfd4] bg-[#f2efe9] px-2 py-0.5 text-[10px] text-[#71695d]">
                                {item.status}
                              </span>
                            </td>
                            <td className="px-2.5 py-3 tabular-nums text-[#7a7266]">{item.version}</td>
                            <td className="px-2.5 py-3 tabular-nums text-[#7a7266]">
                              {item.stats?.runs7d ?? 0}
                            </td>
                            <td className="px-2.5 py-3 tabular-nums text-[#7a7266]">
                              {item.stats?.successRate === null ||
                              item.stats?.successRate === undefined
                                ? '—'
                                : `${Math.round(Number(item.stats.successRate) * 100)}%`}
                            </td>
                            <td className="px-2.5 py-3">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  className="rounded-lg border border-[#e2dcd1] bg-white px-2.5 py-1 text-[11px] text-[#6d665b] transition hover:bg-[#f7f4ef]"
                                  onClick={() => void inspect(item)}
                                >
                                  版本
                                </button>
                                {item.status !== 'deleted' && (
                                  <button
                                    type="button"
                                    className="rounded-lg border border-[#e2dcd1] bg-white px-2.5 py-1 text-[11px] text-[#6d665b] transition hover:bg-[#f7f4ef]"
                                    onClick={() => void toggle(item)}
                                  >
                                    {item.status === 'active' ? '停用' : '启用'}
                                  </button>
                                )}
                                {item.status !== 'deleted' && !item.isBuiltin && (
                                  <button
                                    type="button"
                                    className="rounded-lg border border-[#e8c9c1] bg-[#fcf2ef] px-2.5 py-1 text-[11px] text-[#a25040] transition hover:bg-[#f8e7e2]"
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
                <div className="flex shrink-0 items-end justify-between gap-3 border-b border-[#f0ebe3] px-7 py-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#a29a8e]">
                      Approvals
                    </p>
                    <h2 className="mt-1 text-[22px] font-semibold leading-8 text-[#23211c]">
                      待审批{' '}
                      <span className="text-[14px] font-normal tabular-nums text-[#9c9488]">
                        {approvals.length}
                      </span>
                    </h2>
                    <p className="mt-1 text-[12px] text-[#8d8579]">删除与回滚在这里二次确认。</p>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
                  {approvals.length === 0 ? (
                    <p className="rounded-xl border border-[#eee9e1] bg-[#faf9f6] py-14 text-center text-[12px] text-[#a29a8e]">
                      没有待审批
                    </p>
                  ) : (
                    <ul className="divide-y divide-[#f1ede5] overflow-hidden rounded-xl border border-[#eee9e1] bg-white">
                      {approvals.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-[12px]"
                        >
                          <div>
                            <div className="font-medium text-[#3a352d]">
                              {item.definitionName ?? item.action ?? '删除审批'}
                            </div>
                            <div className="mt-0.5 text-[10px] text-[#a29a8e]">
                              {item.id} · {item.status}
                            </div>
                          </div>
                          <div className="text-[11px] text-[#938b7f]">
                            到期：{item.expiresAt ?? '—'}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {(selected || approval) && (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-[430px] overflow-y-auto border-l border-[#e6e0d6] bg-white p-6 text-[#3d372f] shadow-[-12px_0_40px_rgba(34,28,18,0.12)]">
          {approval && (
            <section className="mb-6 rounded-xl border border-[#e8cda8] bg-[#fbf4e6] p-4 text-[#6f4b1a]">
              <h2 className="text-[15px] font-semibold">待确认删除</h2>
              <p className="mt-1 text-[12px] leading-5 text-[#8b6a3c]">
                输入定义名确认；批准后执行删除，未确认前不会动数据。
              </p>
              <p className="mt-2 font-mono text-[10px] text-[#b59b73]">审批 ID：{approval.id}</p>
              <input
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
                placeholder="输入定义名"
                className="mt-3 w-full rounded-lg border border-[#e4d2b4] bg-white px-3 py-2 text-[13px] text-[#3d372f] outline-none placeholder:text-[#b9aa91]"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={!typedName.trim()}
                  onClick={() => void decide(true)}
                  className="flex-1 rounded-lg bg-[#a8483b] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-30"
                >
                  批准删除
                </button>
                <button
                  type="button"
                  onClick={() => void decide(false)}
                  className="flex-1 rounded-lg border border-[#e6ded2] px-3 py-2 text-[12px] text-[#6d665b]"
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
                  <h2 className="text-[20px] font-semibold text-[#23211c]">
                    {selected.displayName}
                  </h2>
                  <p className="mt-0.5 text-[10px] text-[#a29a8e]">{selected.name}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-[#e2dcd1] px-2.5 py-1 text-[11px] text-[#6d665b]"
                  onClick={() => setSelected(null)}
                >
                  关闭
                </button>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[#a29a8e]">ID</dt>
                  <dd className="mt-1 break-all text-[#6d665b]">{selected.id}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[#a29a8e]">版本</dt>
                  <dd className="mt-1 tabular-nums text-[#6d665b]">{selected.version}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[#a29a8e]">工具</dt>
                  <dd className="mt-1 break-words text-[#6d665b]">
                    {selected.tools.join(', ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[#a29a8e]">更新</dt>
                  <dd className="mt-1 break-all text-[#6d665b]">{selected.updatedAt}</dd>
                </div>
              </dl>
              <h3 className="mt-7 text-[11px] uppercase tracking-[0.14em] text-[#a29a8e]">
                历史版本
              </h3>
              <ul className="mt-2 divide-y divide-[#f1ede5] overflow-hidden rounded-xl border border-[#eee9e1]">
                {versions.length === 0 && (
                  <li className="px-3.5 py-3 text-[12px] text-[#a29a8e]">暂无版本</li>
                )}
                {versions.map((version) => (
                  <li
                    key={String(version.version)}
                    className="px-3.5 py-2.5 text-[12px] text-[#6d665b]"
                  >
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
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-30 w-full max-w-xl -translate-x-1/2 px-4">
          {error && (
            <p className="rounded-lg border border-[#e6c2b8] bg-[#fdf0ec] px-3.5 py-2.5 text-center text-[12px] text-[#99493a] shadow-lg">
              {error}
            </p>
          )}
          {notice && (
            <p className="mt-1 rounded-lg border border-[#cdddca] bg-[#f1f7ef] px-3.5 py-2.5 text-center text-[12px] text-[#4b724d] shadow-lg">
              {notice}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
