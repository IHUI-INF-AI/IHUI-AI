// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  Activity,
  Bot,
  ChevronDown,
  FileText,
  Folder,
  LayoutTemplate,
  Menu,
  MessageSquare,
  PanelLeft,
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

const ROLE_LABELS: Record<string, string> = {
  researcher: '研究',
  coder: '编码',
  reviewer: '审查',
  architect: '架构',
  debugger: '调试',
  'frontend-dev': '前端',
  'backend-dev': '后端',
  devops: '运维',
  'security-auditor': '安全',
  'test-engineer': '测试',
  custom: '自定义',
}

function statusText(status: string) {
  if (status === 'active') return '可用'
  if (status === 'disabled') return '已停用'
  if (status === 'deleted') return '已删除'
  return status
}

function formatWhen(value?: string) {
  if (!value) return '尽快确认'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} 前`
}

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
  const [status, setStatus] = useState('active')
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
    document.title = `${masterName} · 工作台`
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
      setNotice('删除确认已生成，请在「待你确认」中处理；未确认前不会删除。')
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
    { key: 'registry', label: '模板库', icon: LayoutTemplate },
    { key: 'run', label: '任务运行', icon: Activity },
    {
      key: 'approvals',
      label: '待你确认',
      icon: ShieldCheck,
      attention: approvals.length > 0,
    },
  ]

  const cleanProjectItems = items.filter((item) => !item.name.startsWith('e2e-'))
  const projectItems = (cleanProjectItems.length > 0 ? cleanProjectItems : items).slice(0, 4)

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f7f6f4] text-[#24211c]">
      <header className="flex h-[60px] shrink-0 items-center gap-1 bg-[#f7f6f4] px-3 text-[14px] text-[#716a5f]">
        <Link
          href="/workspace"
          aria-label="返回工作台"
          title="返回工作台"
          className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-[#7d7569] transition hover:bg-[#eeeae3] hover:text-[#3f3a32]"
        >
          <PanelLeft className="h-4 w-4" />
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
                  {item.attention && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#c08334]" />
                  )}
                </button>
              )
            })}
          </nav>

          <div className="mt-24 flex items-center justify-between px-2 text-[13px] text-[#948c80]">
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

          <div className="mt-3 px-1">
            <div className="flex items-center gap-2 px-2 py-1.5 text-[14px] font-medium text-[#4c463d]">
              <Folder className="h-4 w-4 text-[#8e867a]" />
              IHUI-AI
            </div>
            <div className="mt-1 space-y-0.5 pl-6">
              {projectItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setView('registry')
                    void inspect(item)
                  }}
                  className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px] text-[#6d665b] transition hover:bg-[#ece8e1] hover:text-[#332f28]"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[#a49c90]" />
                  <span className="min-w-0 flex-1 truncate">{item.displayName}</span>
                  {item.status === 'active' && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4f8fd2]" />
                  )}
                </button>
              ))}
              {projectItems.length === 0 && (
                <p className="px-2 py-2 text-[13px] text-[#aaa298]">暂无任务</p>
              )}
            </div>
          </div>

          <div className="mt-auto px-2 pb-1">
            <div className="flex items-center justify-between py-2 text-[13px] text-[#948c80]">
              <span className="inline-flex items-center gap-1">
                默认
                <ChevronDown className="h-3.5 w-3.5" />
              </span>
              <button
                type="button"
                aria-label="新建默认任务"
                onClick={newConversation}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[#a49c90] transition hover:bg-[#ece8e1] hover:text-[#5d564b]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="px-2 pb-2 pt-1 text-[13px] text-[#aaa298]">暂无任务</p>
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
                    <h2 className="text-[22px] font-semibold leading-8 text-[#23211c]">模板库</h2>
                    <p className="mt-1 text-[12px] text-[#8d8579]">
                      挑一个角色，把活交给它。删除前会先找你确认。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleCreate}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#23211d] px-3.5 py-2 text-[12px] font-medium text-white transition hover:bg-[#3a372f]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {showCreate ? '收起新建' : '新建模板'}
                  </button>
                </div>

                {showCreate && (
                  <form
                    onSubmit={create}
                    className="grid shrink-0 gap-2 border-b border-[#f0ebe3] bg-[#faf8f4] px-7 py-4 md:grid-cols-2"
                  >
                    <input
                      required
                      placeholder="英文标识（小写字母）"
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      className="rounded-lg border border-[#e3ddd2] bg-white px-3 py-2 text-[12px] text-[#3b352c] outline-none placeholder:text-[#b1a99d]"
                    />
                    <input
                      required
                      placeholder="模板名称"
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
                        placeholder="团队 ID"
                        value={form.teamId}
                        onChange={(event) => setForm({ ...form, teamId: event.target.value })}
                        className="rounded-lg border border-[#e3ddd2] bg-white px-3 py-2 text-[12px] text-[#3b352c] outline-none placeholder:text-[#b1a99d]"
                      />
                    )}
                    <input
                      placeholder="可调用的工具（可留空）"
                      value={form.tools}
                      onChange={(event) => setForm({ ...form, tools: event.target.value })}
                      className="rounded-lg border border-[#e3ddd2] bg-white px-3 py-2 text-[12px] text-[#3b352c] outline-none placeholder:text-[#b1a99d]"
                    />
                    <textarea
                      required
                      placeholder="它是谁、负责什么、怎么做事"
                      value={form.systemPrompt}
                      onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })}
                      className="min-h-24 rounded-lg border border-[#e3ddd2] bg-white px-3 py-2 text-[12px] text-[#3b352c] outline-none placeholder:text-[#b1a99d] md:col-span-2"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[#23211d] px-4 py-2.5 text-[12px] font-medium text-white md:col-span-2"
                    >
                      保存模板
                    </button>
                  </form>
                )}

                <div className="flex shrink-0 flex-wrap gap-2 px-7 py-3">
                  <input
                    placeholder="搜索模板名称"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="min-w-56 flex-1 rounded-lg border border-[#e3ddd2] bg-[#faf9f6] px-3 py-2 text-[12px] text-[#3b352c] outline-none placeholder:text-[#b1a99d] focus:border-[#bdb5a8]"
                  />
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="rounded-lg border border-[#e3ddd2] bg-[#faf9f6] px-3 py-2 text-[12px] text-[#615a4f] outline-none"
                  >
                    <option value="active">可用</option>
                    <option value="disabled">已停用</option>
                    <option value="deleted">已删除</option>
                    <option value="">全部</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void reload()}
                    className="rounded-lg border border-[#ded8ce] bg-white px-3 py-2 text-[12px] text-[#6d665b] transition hover:bg-[#f7f4ef]"
                  >
                    刷新
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
                  {loading ? (
                    <p className="py-14 text-center text-[12px] text-[#a29a8e]">加载中…</p>
                  ) : items.length === 0 ? (
                    <p className="rounded-xl border border-[#eee9e1] bg-[#faf9f6] py-14 text-center text-[12px] text-[#a29a8e]">
                      这里还没有模板
                    </p>
                  ) : (
                    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                      {items.map((item) => (
                        <article
                          key={item.id}
                          className="group flex min-h-[154px] flex-col rounded-2xl border border-[#eee9e1] bg-[#fbfaf7] p-4 transition hover:border-[#ddd5c8] hover:bg-white hover:shadow-[0_6px_20px_rgba(34,28,18,0.05)]"
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#efebe3] text-[#5a5449]">
                              <LayoutTemplate className="h-[18px] w-[18px]" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="line-clamp-2 text-[15px] font-semibold leading-6 text-[#2c2823]">
                                {item.displayName}
                              </h3>
                              <p className="mt-0.5 truncate text-[11px] text-[#aaa298]">{item.name}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-[#8d8579]">
                            <span className="rounded-full bg-[#f1ede6] px-2 py-0.5">
                              {ROLE_LABELS[item.role] ?? item.role}
                            </span>
                            <span>{item.scope === 'team' ? '团队' : '个人'}</span>
                            {item.isBuiltin && <span>内置</span>}
                          </div>

                          <div className="mt-auto flex items-center justify-between border-t border-[#f0ebe3] pt-3">
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#7d7569]">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  item.status === 'active'
                                    ? 'bg-[#5f9b6a]'
                                    : item.status === 'disabled'
                                      ? 'bg-[#b3aa9d]'
                                      : 'bg-[#d2cabe]'
                                }`}
                              />
                              {statusText(item.status)}
                            </span>
                            <div className="flex items-center gap-2.5 text-[12px]">
                              <button
                                type="button"
                                className="text-[#6d665b] transition hover:text-[#2c2823]"
                                onClick={() => void inspect(item)}
                              >
                                详情
                              </button>
                              {item.status !== 'deleted' && (
                                <button
                                  type="button"
                                  className="text-[#6d665b] transition hover:text-[#2c2823]"
                                  onClick={() => void toggle(item)}
                                >
                                  {item.status === 'active' ? '停用' : '启用'}
                                </button>
                              )}
                              {item.status !== 'deleted' && !item.isBuiltin && (
                                <button
                                  type="button"
                                  className="text-[#a25040] transition hover:text-[#8d3a2d]"
                                  onClick={() => void startDelete(item)}
                                >
                                  删除
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {view === 'approvals' && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex shrink-0 items-end justify-between gap-3 border-b border-[#f0ebe3] px-7 py-6">
                  <div>
                    <h2 className="text-[22px] font-semibold leading-8 text-[#23211c]">待你确认</h2>
                    <p className="mt-1 text-[12px] text-[#8d8579]">
                      删除前，需要你点一下头。
                    </p>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
                  {approvals.length === 0 ? (
                    <p className="rounded-xl border border-[#eee9e1] bg-[#faf9f6] py-14 text-center text-[12px] text-[#a29a8e]">
                      没有待确认
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {approvals.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eee9e1] bg-[#fbfaf7] px-4 py-3.5"
                        >
                          <div>
                            <p className="text-[14px] font-medium text-[#3a352d]">
                              删除「{item.definitionName ?? '一个模板'}」
                            </p>
                            <p className="mt-0.5 text-[12px] text-[#a29a8e]">
                              {formatWhen(item.expiresAt)}确认，确认后才会真正删除。
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTypedName('')
                              setApproval(item)
                            }}
                            className="rounded-full border border-[#ded8ce] bg-white px-3 py-1.5 text-[12px] text-[#5e574d] transition hover:bg-[#f5f1ea]"
                          >
                            去确认
                          </button>
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
                输入模板名确认，确认后才会删除。
              </p>
              <input
                value={typedName}
                onChange={(event) => setTypedName(event.target.value)}
                placeholder="输入模板名"
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
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[#a29a8e]">编号</dt>
                  <dd className="mt-1 break-all text-[#6d665b]">{selected.id}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[#a29a8e]">版本</dt>
                  <dd className="mt-1 tabular-nums text-[#6d665b]">{selected.version}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[#a29a8e]">可用工具</dt>
                  <dd className="mt-1 break-words text-[#6d665b]">
                    {selected.tools.join(', ') || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.12em] text-[#a29a8e]">最近更新</dt>
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
