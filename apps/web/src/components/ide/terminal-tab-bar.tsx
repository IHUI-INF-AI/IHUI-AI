'use client'

import * as React from 'react'
import { Plus, X, Terminal as TerminalIcon, ChevronDown, Check, Server, FileText, Circle, Video, Play, Trash2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  TerminalSession,
  TerminalCreateInput,
  TerminalSshParams,
  TerminalRecordingListItem,
} from '@ihui/types'

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
  /** 录制状态:sessionId → recordingId(值为 undefined 表示该 session 未在录制) */
  recordingBySession: Record<string, string>
  /** 切换录制(开始/停止),由 terminal-panel 调用 REST + store */
  onToggleRecording: (sessionId: string) => void
  /** 录制列表(REST 拉取,录制列表抽屉消费) */
  recordings: TerminalRecordingListItem[]
  /** 拉取录制列表(打开抽屉时触发) */
  onRefreshRecordings: () => void
  /** 回放录制(POST /recordings/:id/play) */
  onPlayRecording: (recordingId: string) => void
  /** 删除录制(DELETE /recordings/:id) */
  onDeleteRecording: (recordingId: string) => void
  /** 当前正在回放的录制 ID(用于显示回放徽章,null=无回放) */
  activePlaybackId: string | null
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
  recordingBySession,
  onToggleRecording,
  recordings,
  onRefreshRecordings,
  onPlayRecording,
  onDeleteRecording,
  activePlaybackId,
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

  // 录制列表抽屉状态
  const [recordingDrawerOpen, setRecordingDrawerOpen] = React.useState(false)
  const recordingDrawerRef = React.useRef<HTMLDivElement>(null)

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

  // 外部点击关闭录制抽屉
  React.useEffect(() => {
    if (!recordingDrawerOpen) return
    const handle = (e: MouseEvent) => {
      if (recordingDrawerRef.current && !recordingDrawerRef.current.contains(e.target as Node)) {
        setRecordingDrawerOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [recordingDrawerOpen])

  // 打开录制抽屉时拉取最新列表
  React.useEffect(() => {
    if (recordingDrawerOpen) {
      onRefreshRecordings()
    }
  }, [recordingDrawerOpen, onRefreshRecordings])

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

  /** 格式化录制时长(ms → "12s" / "1m 5s") */
  const formatDuration = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000)
    if (totalSec < 60) return `${totalSec}s`
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }

  /** 格式化时间戳为简短日期(MM-DD HH:mm) */
  const formatStartedAt = (ts: number): string => {
    const d = new Date(ts)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${mm}-${dd} ${hh}:${mi}`
  }

  /** 录制按钮点击(切换当前激活 session 的录制状态) */
  const handleToggleRecording = () => {
    if (!activeSessionId) return
    onToggleRecording(activeSessionId)
  }

  /** 当前激活 session 是否正在录制 */
  const isCurrentRecording = activeSessionId ? !!recordingBySession[activeSessionId] : false

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
            {/* 录制中:红色圆点闪烁(纯装饰点,豁免 rounded-full,用 Tailwind animate-pulse) */}
            {recordingBySession[session.id] && (
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse bg-red-500"
                style={{ borderRadius: '50%' }}
                title="正在录制"
                aria-label="正在录制"
              />
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

      {/* 右侧:录制控制 + 回放徽章 + 录制列表抽屉(2026-07-23 立) */}
      <div className="ml-auto flex items-center gap-1">
        {/* 回放徽章(正在回放录制时显示) */}
        {activePlaybackId && (
          <span className="flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-400">
            <Play className="h-2.5 w-2.5" />
            <span>回放中</span>
          </span>
        )}

        {/* 录制按钮:切换当前激活 session 的录制状态 */}
        <button
          type="button"
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
            isCurrentRecording
              ? 'bg-red-500/15 text-red-600 dark:text-red-400'
              : 'text-muted-foreground hover:bg-background hover:text-foreground',
            !activeSessionId && 'pointer-events-none opacity-40',
          )}
          onClick={handleToggleRecording}
          disabled={!activeSessionId}
          aria-label={isCurrentRecording ? '停止录制' : '开始录制'}
          title={isCurrentRecording ? '停止录制' : '开始录制'}
        >
          {isCurrentRecording ? (
            <Circle className="h-3 w-3 fill-current" />
          ) : (
            <Video className="h-3 w-3" />
          )}
        </button>

        {/* 录制列表抽屉触发器 */}
        <div className="relative flex items-center" ref={recordingDrawerRef}>
          <button
            type="button"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors',
              'hover:bg-background hover:text-foreground',
              recordingDrawerOpen && 'bg-background text-foreground',
            )}
            onClick={() => setRecordingDrawerOpen((v) => !v)}
            aria-label="录制列表"
            title="录制列表"
          >
            <Clock className="h-3 w-3" />
          </button>
          {recordings.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 min-w-3 items-center justify-center rounded bg-accent px-0.5 text-[9px] font-medium text-accent-foreground">
              {recordings.length > 99 ? '99+' : recordings.length}
            </span>
          )}
          {recordingDrawerOpen && (
            <div className="absolute right-0 top-7 z-50 w-80 overflow-hidden rounded-md border border-border bg-popover shadow-md">
              <div className="flex items-center justify-between bg-muted/40 px-2.5 py-1.5">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  录制列表({recordings.length})
                </span>
                <button
                  type="button"
                  className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => setRecordingDrawerOpen(false)}
                  aria-label="关闭"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {recordings.length === 0 ? (
                  <div className="px-2.5 py-4 text-center text-xs text-muted-foreground">
                    暂无录制。点击录制按钮(左侧 Video 图标)开始录制终端操作。
                  </div>
                ) : (
                  recordings.map((rec) => (
                    <div
                      key={rec.id}
                      className="group flex items-center gap-2 px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
                    >
                      <Play className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-foreground">
                          {rec.title || `录制 ${formatStartedAt(rec.startedAt)}`}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{formatStartedAt(rec.startedAt)}</span>
                          <span>{formatDuration(rec.durationMs)}</span>
                          <span>{rec.eventCount} 事件</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPlayRecording(rec.id)
                          setRecordingDrawerOpen(false)
                        }}
                        aria-label="回放"
                        title="回放"
                      >
                        <Play className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteRecording(rec.id)
                        }}
                        aria-label="删除"
                        title="删除"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
