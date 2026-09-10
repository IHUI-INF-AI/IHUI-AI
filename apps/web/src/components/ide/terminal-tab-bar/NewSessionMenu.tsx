// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { Plus, Terminal as TerminalIcon, Check, ChevronDown, Server, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TerminalCreateInput } from '@ihui/types'
import { useTranslations } from 'next-intl'
import {
  SHELL_OPTIONS,
  emptySshForm,
  buildSshParams,
  sshFieldErrorKey,
  type SshFormValues,
} from './model'

interface NewSessionMenuProps {
  loading: boolean
  /** 新建会话(本地 shell 或 SSH 远程,参数透传 terminal-service.createSession) */
  onNew: (opts?: TerminalCreateInput) => void
}

/**
 * 新建会话菜单 — 连接类型单选(本地/SSH) + shell 选择 + SSH 表单。
 * 表单状态自持;提交校验复用 model.buildSshParams,错误文案经 sshFieldErrorKey 映射。
 */
export function NewSessionMenu({ loading, onNew }: NewSessionMenuProps) {
  const t = useTranslations('ide')
  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const privateKeyFileRef = React.useRef<HTMLInputElement>(null)

  const [connectKind, setConnectKind] = React.useState<'local' | 'ssh'>('local')
  const [selectedShell, setSelectedShell] = React.useState<string>('powershell')
  const [sshForm, setSshForm] = React.useState<SshFormValues>(emptySshForm)
  const [sshError, setSshError] = React.useState<string | null>(null)

  // 外部点击关闭菜单
  React.useEffect(() => {
    if (!menuOpen) return
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setSshError(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  const setSshField = (patch: Partial<SshFormValues>) =>
    setSshForm((prev) => ({ ...prev, ...patch }))

  /** 新建会话(根据 connectKind 构造 opts) */
  const handleCreateSession = () => {
    if (connectKind === 'local') {
      onNew({ shell: selectedShell })
      setMenuOpen(false)
      setSshError(null)
      return
    }
    // SSH 模式:校验 + 构造
    const result = buildSshParams(sshForm)
    if ('error' in result) {
      setSshError(t(sshFieldErrorKey(result.error)))
      return
    }
    onNew({ ssh: result })
    setMenuOpen(false)
    setSshError(null)
    setSshForm(emptySshForm)
  }

  /** 私钥文件选择(FileReader.readAsText) */
  const handlePrivateKeyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setSshField({ privateKey: typeof reader.result === 'string' ? reader.result : '' })
    }
    reader.onerror = () => {
      setSshError(t('terminalTabBar.errPrivateKeyReadFailed'))
    }
    reader.readAsText(file)
    // 重置 input value 让同一文件可再次选择
    e.target.value = ''
  }

  return (
    <div className="relative flex items-center" ref={menuRef}>
      {/* 主按钮(默认新建)+ 展开箭头(打开菜单) */}
      <button
        type="button"
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors',
          'hover:bg-background hover:text-foreground',
          loading && 'pointer-events-none opacity-40',
        )}
        onClick={handleCreateSession}
        disabled={loading}
        aria-label={t('terminalTabBar.newTerminalAria')}
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
        onClick={() => setMenuOpen((v) => !v)}
        disabled={loading}
        aria-label={t('terminalTabBar.selectConnectType')}
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      {menuOpen && (
        <div className="absolute left-0 top-7 z-50 w-64 overflow-hidden rounded-md border border-border bg-popover shadow-md">
          {/* 连接类型单选 */}
          <div className="bg-muted/40 px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('terminalTabBar.connectType')}
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
              <span>{t('terminalTabBar.local')}</span>
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
              <span>{t('terminalTabBar.sshRemote')}</span>
            </button>
          </div>

          {/* 本地:Shell 类型选择 */}
          {connectKind === 'local' && (
            <>
              <div className="bg-muted/40 px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('terminalTabBar.shellType')}
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
                <span className="text-[10px] text-muted-foreground">
                  {t('terminalTabBar.host')}
                </span>
                <input
                  type="text"
                  value={sshForm.host}
                  onChange={(e) => setSshField({ host: e.target.value })}
                  placeholder={t('terminalTabBar.hostPlaceholder')}
                  className="h-6 rounded border border-border bg-background px-1.5 text-xs outline-none focus:border-ring/50"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {t('terminalTabBar.port')}
                </span>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={sshForm.port}
                  onChange={(e) => setSshField({ port: e.target.value })}
                  className="h-6 rounded border border-border bg-background px-1.5 text-xs outline-none focus:border-ring/50"
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">
                  {t('terminalTabBar.username')}
                </span>
                <input
                  type="text"
                  value={sshForm.username}
                  onChange={(e) => setSshField({ username: e.target.value })}
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
                    sshForm.authMethod === 'password'
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  onClick={() => setSshField({ authMethod: 'password' })}
                >
                  <span>{t('terminalTabBar.password')}</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex flex-1 items-center justify-center rounded px-2 py-0.5 text-[10px] transition-colors',
                    sshForm.authMethod === 'privateKey'
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  onClick={() => setSshField({ authMethod: 'privateKey' })}
                >
                  <span>{t('terminalTabBar.privateKey')}</span>
                </button>
              </div>
              {sshForm.authMethod === 'password' ? (
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {t('terminalTabBar.password')}
                  </span>
                  <input
                    type="password"
                    value={sshForm.password}
                    onChange={(e) => setSshField({ password: e.target.value })}
                    className="h-6 rounded border border-border bg-background px-1.5 text-xs outline-none focus:border-ring/50"
                  />
                </label>
              ) : (
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {t('terminalTabBar.privateKeyPem')}
                  </span>
                  <textarea
                    value={sshForm.privateKey}
                    onChange={(e) => setSshField({ privateKey: e.target.value })}
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
                    <span>{t('terminalTabBar.selectPrivateKeyFile')}</span>
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
                      {t('terminalTabBar.privateKeyPassphrase')}
                    </span>
                    <input
                      type="password"
                      value={sshForm.passphrase}
                      onChange={(e) => setSshField({ passphrase: e.target.value })}
                      className="h-6 rounded border border-border bg-background px-1.5 text-xs outline-none focus:border-ring/50"
                    />
                  </label>
                </label>
              )}
              {sshError && (
                <div className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                  {sshError}
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
              <span>
                {connectKind === 'ssh'
                  ? t('terminalTabBar.newSshSession')
                  : t('terminalTabBar.newSession')}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
