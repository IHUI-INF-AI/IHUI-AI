'use client'

import * as React from 'react'
import { Plus, X, Terminal as TerminalIcon, ChevronDown, Check, Server, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TerminalSession, TerminalCreateInput, TerminalSshParams } from '@ihui/types'

/** 可选 shell 列表(Windows 优先,仅本地会话时显示) */
const SHELL_OPTIONS = [
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'CMD' },
  { value: 'bash', label: 'Bash' },
  { value: 'wsl', label: 'WSL' },
] as const

/** SSH 认证方式 */
type SshAuthMethod = 'password' | 'privateKey'

interface TerminalTabBarProps {
  sessions: TerminalSession[]
  activeSessionId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  /** 新建会话(支持本地 shell 或 SSH 远程,参数透传到 terminal-service.createSession) */
  onNew: (opts?: TerminalCreateInput) => void
  onRename: (id: string, name: string) => Promise<boolean> | void
}

/**
 * 终端 tab bar — 多 session 切换 + 新建(本地 / SSH 远程) + 关闭 + 双击 rename。
 *
 * 深化(2026-07-22):
 * - 新建菜单支持"连接类型"单选:本地(默认)/ SSH 远程
 * - SSH 模式展开表单:主机 / 端口 / 用户名 / 密码 or 私钥(textarea + 文件选择器)
 * - 表单校验:主机非空,端口 1-65535,用户名非空,密码或私钥至少一个
 *
 * 样式约束(AGENTS.md §4):
 * - border-b border-border 分隔(非 divide-x)
 * - gap-* 间距分隔
 * - 禁止 rounded-full / 蓝色发光边框
 * - active tab 用 subtle 颜色变化(text-foreground vs text-muted-foreground)
 * - 中文字体图标垂直对齐自动应用 --text-vcenter-offset(由 globals.css 全局规则生效)
 */
export function TerminalTabBar({
  sessions,
  activeSessionId,
  loading,
  onSelect,
  onClose,
  onNew,
  onRename,
}: TerminalTabBarProps) {
  // shell 选择下拉
  const [selectedShell, setSelectedShell] = React.useState<string>('powershell')
  const [shellMenuOpen, setShellMenuOpen] = React.useState(false)
  const shellMenuRef = React.useRef<HTMLDivElement>(null)

  // SSH 表单状态
  const [connectKind, setConnectKind] = React.useState<'local' | 'ssh'>('local')
  const [sshHost, setSshHost] = React.useState('')
  const [sshPort, setSshPort] = React.useState<string>('22')
  const [sshUsername, setSshUsername] = React.useState('')
  const [sshAuthMethod, setSshAuthMethod] = React.useState<SshAuthMethod>('password')
  const [sshPassword, setSshPassword] = React.useState('')
  const [sshPrivateKey, setSshPrivateKey] = React.useState('')
  const [sshPassphrase, setSshPassphrase] = React.useState('')
  const [sshFormError, setSshFormError] = React.useState<string | null>(null)
  const privateKeyFileRef = React.useRef<HTMLInputElement>(null)

  // rename 状态
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [renameValue, setRenameValue] = React.useState('')
  const renameInputRef = React.useRef<HTMLInputElement>(null)

  // 外部点击关闭 shell 菜单
  React.useEffect(() => {
    if (!shellMenuOpen) return
    const handle = (e: MouseEvent) => {
      if (shellMenuRef.current && !shellMenuRef.current.contains(e.target as Node)) {
        setShellMenuOpen(false)
        setSshFormError(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [shellMenuOpen])

  // rename 输入框聚焦
  React.useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const handleStartRename = (session: TerminalSession, fallbackLabel: string) => {
    setRenamingId(session.id)
    setRenameValue(session.name ?? fallbackLabel)
  }

  const handleConfirmRename = async () => {
    const id = renamingId
    if (!id) return
    const trimmed = renameValue.trim()
    if (trimmed) {
      await onRename(id, trimmed)
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleCancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  /** 校验 SSH 表单 + 构造 SshParams */
  const buildSshParams = (): TerminalSshParams | { error: string } => {
    const host = sshHost.trim()
    const username = sshUsername.trim()
    if (!host) return { error: '主机地址不能为空' }
    const portNum = parseInt(sshPort, 10)
    if (!Number.isFinite(portNum) || portNum < 1 || portNum > 65535) {
      return { error: '端口范围 1-65535' }
    }
    if (!username) return { error: '用户名不能为空' }
    if (sshAuthMethod === 'password' && !sshPassword) {
      return { error: '密码不能为空' }
    }
    if (sshAuthMethod === 'privateKey' && !sshPrivateKey) {
      return { error: '私钥内容不能为空' }
    }
    const params: TerminalSshParams = { host, port: portNum, username }
    if (sshAuthMethod === 'password') {
      params.password = sshPassword
    } else {
      params.privateKey = sshPrivateKey
      if (sshPassphrase) params.passphrase = sshPassphrase
    }
    return params
  }

  /** 新建会话(根据 connectKind 构造 opts) */
  const handleCreateSession = () => {
    if (connectKind === 'local') {
      onNew({ shell: selectedShell })
      setShellMenuOpen(false)
      setSshFormError(null)
      return
    }
    // SSH 模式:校验 + 构造
    const result = buildSshParams()
    if ('error' in result) {
      setSshFormError(result.error)
      return
    }
    onNew({ ssh: result })
    // 重置表单(关闭菜单)
    setShellMenuOpen(false)
    setSshFormError(null)
    setSshHost('')
    setSshPort('22')
    setSshUsername('')
    setSshPassword('')
    setSshPrivateKey('')
    setSshPassphrase('')
  }

  /** 私钥文件选择(FileReader.readAsText) */
  const handlePrivateKeyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setSshPrivateKey(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => {
      setSshFormError('私钥文件读取失败')
    }
    reader.readAsText(file)
    // 重置 input value 让同一文件可再次选择
    e.target.value = ''
  }

  return (
    <div className="flex items-center gap-1 border-b border-border bg-muted/30 px-2 py-1">
      {sessions.map((session, index) => {
        const isActive = session.id === activeSessionId
        const fallbackLabel = `Terminal ${index + 1}`
        const label = session.name ?? fallbackLabel
        // SSH 会话显示 host,本地会话显示 cwd 末段
        const cwdShort =
          session.kind === 'ssh'
            ? (session.sshUser ? `${session.sshUser}@` : '') + (session.sshHost ?? session.cwd)
            : session.cwd.split(/[\\/]/).pop() || session.cwd
        const isRenaming = renamingId === session.id

        return (
          <div
            key={session.id}
            className={cn(
              'group flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
            )}
            onClick={() => onSelect(session.id)}
            role="tab"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(session.id)
              }
            }}
          >
            {session.kind === 'ssh' ? (
              <Server className="h-3 w-3 shrink-0 opacity-60" />
            ) : (
              <TerminalIcon className="h-3 w-3 shrink-0 opacity-60" />
            )}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleConfirmRename()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    handleCancelRename()
                  }
                }}
                onBlur={() => void handleConfirmRename()}
                className="w-24 rounded border border-border bg-background px-1 py-0 text-xs outline-none focus:border-ring/50"
                maxLength={32}
                aria-label="重命名终端"
              />
            ) : (
              <span
                className="max-w-32 truncate"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  handleStartRename(session, fallbackLabel)
                }}
                title="双击重命名"
              >
                {label}
              </span>
            )}
            <span className="max-w-24 truncate text-[10px] opacity-50">{cwdShort}</span>
            {session.status === 'exited' && (
              <span className="text-[10px] text-muted-foreground/60">(已退出)</span>
            )}
            <button
              type="button"
              className={cn(
                'ml-0.5 flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity',
                'hover:bg-destructive/15 hover:text-destructive',
                'group-hover:opacity-60',
              )}
              onClick={(e) => {
                e.stopPropagation()
                onClose(session.id)
              }}
              aria-label="关闭终端"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}

      {/* 新建按钮 + 下拉菜单(本地 shell / SSH 远程) */}
      <div className="relative flex items-center" ref={shellMenuRef}>
        <button
          type="button"
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-background hover:text-foreground',
            loading && 'pointer-events-none opacity-40',
          )}
          onClick={handleCreateSession}
          disabled={loading}
          aria-label="新建终端"
          title={`新建终端 (${connectKind === 'ssh' ? 'SSH' : SHELL_OPTIONS.find((s) => s.value === selectedShell)?.label ?? 'PowerShell'})`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            'flex h-6 w-4 items-center justify-center rounded-md text-muted-foreground transition-colors',
            'hover:bg-background hover:text-foreground',
            loading && 'pointer-events-none opacity-40',
          )}
          onClick={() => setShellMenuOpen((v) => !v)}
          disabled={loading}
          aria-label="选择连接类型"
          title="选择连接类型"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
        {shellMenuOpen && (
          <div className="absolute left-0 top-7 z-50 w-64 overflow-hidden rounded-md border border-border bg-popover shadow-md">
            {/* 连接类型单选 */}
            <div className="bg-muted/40 px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              连接类型
            </div>
            <div className="flex gap-1 px-2 py-1.5">
              <button
                type="button"
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                  connectKind === 'local'
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
                onClick={() => setConnectKind('local')}
              >
                <TerminalIcon className="h-3 w-3" />
                <span>本地</span>
              </button>
              <button
                type="button"
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-xs transition-colors',
                  connectKind === 'ssh'
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
                onClick={() => setConnectKind('ssh')}
              >
                <Server className="h-3 w-3" />
                <span>SSH 远程</span>
              </button>
            </div>

            {/* 本地:Shell 类型选择 */}
            {connectKind === 'local' && (
              <>
                <div className="bg-muted/40 px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Shell 类型
                </div>
                <div className="py-0.5">
                  {SHELL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between gap-2 px-2.5 py-1 text-left text-xs transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        selectedShell === opt.value && 'text-foreground',
                      )}
                      onClick={() => setSelectedShell(opt.value)}
                    >
                      <span>{opt.label}</span>
                      {selectedShell === opt.value && <Check className="h-3 w-3 opacity-70" />}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* SSH:表单 */}
            {connectKind === 'ssh' && (
              <div className="flex flex-col gap-1.5 px-2 py-1.5">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">主机</span>
                  <input
                    type="text"
                    value={sshHost}
                    onChange={(e) => setSshHost(e.target.value)}
                    placeholder="example.com 或 192.168.1.1"
                    className="h-6 rounded border border-border bg-background px-1.5 text-xs outline-none focus:border-ring/50"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">端口</span>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={sshPort}
                    onChange={(e) => setSshPort(e.target.value)}
                    className="h-6 rounded border border-border bg-background px-1.5 text-xs outline-none focus:border-ring/50"
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">用户名</span>
                  <input
                    type="text"
                    value={sshUsername}
                    onChange={(e) => setSshUsername(e.target.value)}
                    placeholder="root"
                    className="h-6 rounded border border-border bg-background px-1.5 text-xs outline-none focus:border-ring/50"
                  />
                </label>
                {/* 认证方式单选 */}
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={cn(
                      'flex flex-1 items-center justify-center rounded px-2 py-0.5 text-[10px] transition-colors',
                      sshAuthMethod === 'password'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                    onClick={() => setSshAuthMethod('password')}
                  >
                    <span>密码</span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'flex flex-1 items-center justify-center rounded px-2 py-0.5 text-[10px] transition-colors',
                      sshAuthMethod === 'privateKey'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                    onClick={() => setSshAuthMethod('privateKey')}
                  >
                    <span>私钥</span>
                  </button>
                </div>
                {sshAuthMethod === 'password' ? (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">密码</span>
                    <input
                      type="password"
                      value={sshPassword}
                      onChange={(e) => setSshPassword(e.target.value)}
                      className="h-6 rounded border border-border bg-background px-1.5 text-xs outline-none focus:border-ring/50"
                    />
                  </label>
                ) : (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground">私钥(PEM)</span>
                    <textarea
                      value={sshPrivateKey}
                      onChange={(e) => setSshPrivateKey(e.target.value)}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
                      rows={3}
                      className="rounded border border-border bg-background p-1.5 font-mono text-[10px] outline-none focus:border-ring/50"
                    />
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => privateKeyFileRef.current?.click()}
                    >
                      <FileText className="h-3 w-3" />
                      <span>选择私钥文件</span>
                    </button>
                    <input
                      ref={privateKeyFileRef}
                      type="file"
                      accept=".pem,.key,.id_rsa,.id_ed25519,.txt"
                      onChange={handlePrivateKeyFile}
                      className="hidden"
                    />
                    <label className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        私钥 passphrase(可选)
                      </span>
                      <input
                        type="password"
                        value={sshPassphrase}
                        onChange={(e) => setSshPassphrase(e.target.value)}
                        className="h-6 rounded border border-border bg-background px-1.5 text-xs outline-none focus:border-ring/50"
                      />
                    </label>
                  </label>
                )}
                {sshFormError && (
                  <div className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                    {sshFormError}
                  </div>
                )}
              </div>
            )}

            {/* 新建会话按钮 */}
            <div className="bg-muted/40 py-0.5">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={handleCreateSession}
                disabled={loading}
              >
                <Plus className="h-3 w-3" />
                <span>新建{connectKind === 'ssh' ? ' SSH 会话' : '会话'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <span className="ml-1 text-[10px] text-muted-foreground/60">创建中...</span>
      )}
    </div>
  )
}
