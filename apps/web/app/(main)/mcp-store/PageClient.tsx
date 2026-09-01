// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Store,
  Plug,
  Loader2,
  FolderOpen,
  GitBranch,
  Globe,
  Database,
  BrainCircuit,
  Clock,
  Server,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  getMcpDirectory,
  registerDirectoryServer,
  listExternalServers,
  type McpDirectoryEntry,
  type McpDirectoryResponse,
  type McpExternalServersResponse,
} from '@ihui/api-client/endpoints/mcp'
import { BackButton } from '@/components/common'
import { Badge } from '@/components/data'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Label,
} from '@ihui/ui-react'

/** 按目录 key 映射 lucide 图标(无 icon 字段,前端静态映射) */
const KEY_ICON: Record<string, LucideIcon> = {
  filesystem: FolderOpen,
  git: GitBranch,
  fetch: Globe,
  memory: Database,
  'sequential-thinking': BrainCircuit,
  time: Clock,
  postgres: Database,
  github: GitBranch,
}

/**
 * MCP 商店页 — 2026-09-01 新增
 *
 * 定位:展示内置 MCP Server 目录(8 个),支持一键注册 / 带环境变量注册,
 * 下半部展示已注册的 MCP Server 列表(含连接状态)。
 * 接口:GET /api/mcp/directory + POST /api/mcp/directory/{key}/register
 *       + GET /api/mcp/external/servers(均经 next rewrites → ai-service 8803)。
 */
export default function McpStorePageClient() {
  const t = useTranslations('mcpStore')
  const queryClient = useQueryClient()

  // 目录列表(商店种子数据)
  const {
    data: directory,
    isLoading: dirLoading,
    error: dirError,
  } = useQuery({
    queryKey: ['mcp-store', 'directory'],
    queryFn: async (): Promise<McpDirectoryResponse> => {
      const r = await getMcpDirectory()
      if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
      return r.data
    },
  })

  // 已注册 Server 列表(含连接状态)
  const { data: registered } = useQuery({
    queryKey: ['mcp-store', 'registered'],
    queryFn: async (): Promise<McpExternalServersResponse> => {
      const r = await listExternalServers()
      if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
      return r.data
    },
  })

  // 环境变量对话框状态:当前待注册条目 + 各 env 输入值
  const [envEntry, setEnvEntry] = React.useState<McpDirectoryEntry | null>(null)
  const [envValues, setEnvValues] = React.useState<Record<string, string>>({})
  const [registeringKey, setRegisteringKey] = React.useState<string | null>(null)

  /** 打开 env 对话框前初始化输入值 */
  const openEnvDialog = (entry: McpDirectoryEntry) => {
    setEnvEntry(entry)
    setEnvValues(Object.fromEntries(entry.env_required.map((k) => [k, ''])))
  }

  /** 刷新已注册列表(注册成功后调用) */
  const refreshRegistered = () => {
    void queryClient.invalidateQueries({ queryKey: ['mcp-store', 'registered'] })
  }

  /** 无必需 env 的条目直接注册 */
  const handleQuickRegister = async (entry: McpDirectoryEntry) => {
    await doRegister(entry, {})
  }

  /** 有必需 env 的条目:校验非空后提交注册 */
  const handleEnvRegister = async () => {
    if (!envEntry) return
    const empty = envEntry.env_required.filter((k) => !envValues[k]?.trim())
    if (empty.length > 0) {
      toast.error(t('missingEnv', { env: empty.join(', ') }))
      return
    }
    await doRegister(envEntry, envValues)
  }

  /** 统一的注册逻辑:409 已存在 / 400 缺 env / 其他错误分别提示 */
  const doRegister = async (entry: McpDirectoryEntry, env: Record<string, string>) => {
    if (registeringKey) return
    setRegisteringKey(entry.key)
    const displayName = `mcp:${entry.key}`
    try {
      const r = await registerDirectoryServer(entry.key, {
        name: displayName,
        transport: entry.transport,
        command: 'npx',
        args: [],
        env,
      })
      if (r.success) {
        toast.success(t('success', { name: r.data.name }))
        setEnvEntry(null)
        refreshRegistered()
      } else if (r.status === 409) {
        toast.error(t('exists', { name: displayName }))
      } else {
        toast.error(r.error ?? t('error'))
      }
    } catch {
      toast.error(t('error'))
    } finally {
      setRegisteringKey(null)
    }
  }

  const servers = directory?.servers ?? []
  const registeredServers = registered?.servers ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4">
      <BackButton />
      {/* 顶部:标题 + 统计 */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          {!dirLoading && !dirError && (
            <Badge variant="primary">{t('count', { count: directory?.count ?? servers.length })}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 目录列表 */}
      {dirLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      )}
      {dirError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {t('loadFailed')}
        </div>
      )}
      {!dirLoading && !dirError && (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {servers.map((entry) => (
            <DirectoryCard
              key={entry.key}
              entry={entry}
              registering={registeringKey === entry.key}
              onRegister={
                entry.env_required.length > 0 ? () => openEnvDialog(entry) : () => void handleQuickRegister(entry)
              }
            />
          ))}
        </div>
      )}

      {/* 已注册列表 */}
      <section className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{t('registeredTitle')}</h2>
          {registeredServers.length > 0 && (
            <Badge variant="default">{registeredServers.length}</Badge>
          )}
        </div>
        {registeredServers.length === 0 ? (
          <div className="rounded-md border bg-card py-6 text-center text-sm text-muted-foreground">
            {t('registeredEmpty')}
          </div>
        ) : (
          <div className="space-y-2">
            {registeredServers.map((srv) => (
              <div
                key={srv.name}
                className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Plug className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-sm font-medium text-foreground">{srv.name}</span>
                  <span className="text-xs text-muted-foreground">{srv.transport}</span>
                </div>
                <Badge variant={srv.connected ? 'success' : 'default'}>
                  {srv.connected ? t('connected') : t('disconnected')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 环境变量输入对话框 */}
      <Dialog open={envEntry !== null} onOpenChange={(v) => !v && setEnvEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{envEntry?.name}</DialogTitle>
            <DialogDescription>{t('envHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {envEntry?.env_required.map((key) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('requiredEnv')}: {key}</Label>
                <Input
                  type="text"
                  value={envValues[key] ?? ''}
                  onChange={(e) => setEnvValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={t('envPlaceholder', { env: key })}
                  autoComplete="off"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnvEntry(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={() => void handleEnvRegister()} disabled={registeringKey !== null}>
              {registeringKey ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t('registering')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 单个目录条目卡片:名称/描述/source 徽章/transport/env 标识 + 注册按钮 */
function DirectoryCard({
  entry,
  registering,
  onRegister,
}: {
  entry: McpDirectoryEntry
  registering: boolean
  onRegister: () => void
}) {
  const t = useTranslations('mcpStore')
  const Icon = KEY_ICON[entry.key] ?? Plug
  const needsEnv = entry.env_required.length > 0

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20">
      <div className="flex items-start gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold leading-tight text-foreground">{entry.name}</span>
            <Badge variant={entry.source === 'official' ? 'primary' : 'default'}>
              {entry.source === 'official' ? t('official') : t('community')}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <Plug className="h-3 w-3" />
              {t('transport')}: {entry.transport}
            </span>
            {needsEnv && (
              <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-500">
                <Database className="h-3 w-3" />
                {t('envRequired')}: {entry.env_required.join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{entry.description}</p>
      <Button
        variant={needsEnv ? 'outline' : 'default'}
        onClick={onRegister}
        disabled={registering}
        className="w-full"
      >
        {registering ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            {t('registering')}
          </>
        ) : (
          <>
            <Store className="mr-1.5 h-3.5 w-3.5" />
            {needsEnv ? t('registerWithEnv') : t('register')}
          </>
        )}
      </Button>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
