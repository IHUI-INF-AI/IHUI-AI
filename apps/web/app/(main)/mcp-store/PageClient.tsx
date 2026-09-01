// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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
  Trash2,
  Power,
  PowerOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  getMcpStore,
  installStoreServer,
  uninstallStoreServer,
  setStoreServerEnabled,
  listExternalServers,
  type McpStoreEntry,
  type McpStoreResponse,
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
 * MCP 商店页 — 2026-09-01 新增(P2-1 商店闭环 2026-09-02 升级)
 *
 * 定位:内置 MCP Server 目录(8 个),一键安装(官方 SDK stdio 热挂载,工具注入
 * 对话工具表,LLM 立即可调用)+ 卸载 / 启停 / 状态持久化(重启不丢)。
 * 接口:GET /api/mcp/store(目录 + 安装状态合并,一个接口渲染整页)
 *       + POST /api/mcp/store/install | /uninstall | /enable | /disable
 *       + GET /api/mcp/external/servers(手动注册的外部 Server,保留原有功能)
 *       (均经 next rewrites → ai-service 8803)。
 */
export default function McpStorePageClient() {
  const t = useTranslations('mcpStore')
  const queryClient = useQueryClient()

  // 商店合并列表(目录 + 安装状态,唯一数据源)
  const {
    data: store,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['mcp-store', 'store'],
    queryFn: async (): Promise<McpStoreResponse> => {
      const r = await getMcpStore()
      if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
      return r.data
    },
  })

  // 已注册外部 Server 列表(手动注册通道,含连接状态)
  const { data: registered } = useQuery({
    queryKey: ['mcp-store', 'registered'],
    queryFn: async (): Promise<McpExternalServersResponse> => {
      const r = await listExternalServers()
      if (!r.success || !r.data) throw new Error(r.error ?? 'load failed')
      return r.data
    },
  })

  // 环境变量对话框状态:当前待安装条目 + 各 env 输入值
  const [envEntry, setEnvEntry] = React.useState<McpStoreEntry | null>(null)
  const [envValues, setEnvValues] = React.useState<Record<string, string>>({})
  const [installingKey, setInstallingKey] = React.useState<string | null>(null)
  const [actingName, setActingName] = React.useState<string | null>(null)

  /** 打开 env 对话框前初始化输入值 */
  const openEnvDialog = (entry: McpStoreEntry) => {
    setEnvEntry(entry)
    setEnvValues(Object.fromEntries(entry.env_required.map((k) => [k, ''])))
  }

  /** 刷新商店列表 + 外部 Server 列表 */
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['mcp-store', 'store'] })
    void queryClient.invalidateQueries({ queryKey: ['mcp-store', 'registered'] })
  }

  /** 统一的安装逻辑:409 已存在 / 400 缺 env / 500 热挂载失败分别提示 */
  const handleInstall = async (entry: McpStoreEntry, env: Record<string, string>) => {
    if (installingKey) return
    setInstallingKey(entry.key)
    try {
      const r = await installStoreServer(entry.key, { env })
      if (r.success) {
        toast.success(t('success', { name: r.data.name }))
        setEnvEntry(null)
        refresh()
      } else if (r.status === 409) {
        toast.error(t('exists', { name: entry.server_name }))
      } else {
        toast.error(r.error ?? t('error'))
      }
    } catch {
      toast.error(t('error'))
    } finally {
      setInstallingKey(null)
    }
  }

  /** env 对话框内提交安装(校验必需 env 非空) */
  const handleEnvInstall = async () => {
    if (!envEntry) return
    const empty = envEntry.env_required.filter((k) => !envValues[k]?.trim())
    if (empty.length > 0) {
      toast.error(t('missingEnv', { env: empty.join(', ') }))
      return
    }
    await handleInstall(envEntry, envValues)
  }

  /** 启用 / 停用切换 */
  const handleToggleEnabled = async (entry: McpStoreEntry) => {
    if (actingName) return
    setActingName(entry.server_name)
    const enable = !entry.enabled
    try {
      const r = await setStoreServerEnabled(entry.server_name, enable)
      if (r.success) {
        toast.success(
          enable
            ? t('enableSuccess', { name: entry.name })
            : t('disableSuccess', { name: entry.name }),
        )
        refresh()
      } else {
        toast.error(r.error ?? t('actionFailed'))
      }
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setActingName(null)
    }
  }

  /** 卸载:关闭子进程 + 移除注入工具 + 删除持久化记录 */
  const handleUninstall = async (entry: McpStoreEntry) => {
    if (actingName) return
    setActingName(entry.server_name)
    try {
      const r = await uninstallStoreServer(entry.server_name)
      if (r.success) {
        toast.success(t('uninstallSuccess', { name: entry.name }))
        refresh()
      } else {
        toast.error(r.error ?? t('actionFailed'))
      }
    } catch {
      toast.error(t('actionFailed'))
    } finally {
      setActingName(null)
    }
  }

  const servers = store?.servers ?? []
  const registeredServers = registered?.servers ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4">
      <BackButton />
      {/* 顶部:标题 + 统计 */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Store className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          {!isLoading && !error && (
            <Badge variant="primary">{t('count', { count: store?.count ?? servers.length })}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 目录列表(含安装状态) */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {t('loadFailed')}
        </div>
      )}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {servers.map((entry) => (
            <DirectoryCard
              key={entry.key}
              entry={entry}
              installing={installingKey === entry.key}
              acting={actingName === entry.server_name}
              onInstall={
                entry.env_required.length > 0
                  ? () => openEnvDialog(entry)
                  : () => void handleInstall(entry, {})
              }
              onToggleEnabled={() => void handleToggleEnabled(entry)}
              onUninstall={() => void handleUninstall(entry)}
            />
          ))}
        </div>
      )}

      {/* 已注册外部 Server(手动注册通道,保留原有功能) */}
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
                <Label className="text-xs text-muted-foreground">
                  {t('requiredEnv')}: {key}
                </Label>
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
            <Button onClick={() => void handleEnvInstall()} disabled={installingKey !== null}>
              {installingKey ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t('installing')}
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

/** 安装状态徽章:未安装 / 运行中 / 已停用 / 错误(停用但有 last_error) */
function StatusBadge({ entry }: { entry: McpStoreEntry }) {
  const t = useTranslations('mcpStore')
  if (!entry.installed) {
    return <Badge variant="default">{t('notInstalled')}</Badge>
  }
  if (entry.enabled) {
    return <Badge variant="success">{t('running')}</Badge>
  }
  if (entry.last_error) {
    return <Badge variant="danger">{t('statusError')}</Badge>
  }
  return <Badge variant="default">{t('stopped')}</Badge>
}

/** 单个目录条目卡片:名称/状态徽章/描述/tool_count + 安装/启停/卸载按钮 */
function DirectoryCard({
  entry,
  installing,
  acting,
  onInstall,
  onToggleEnabled,
  onUninstall,
}: {
  entry: McpStoreEntry
  installing: boolean
  acting: boolean
  onInstall: () => void
  onToggleEnabled: () => void
  onUninstall: () => void
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
            <span className="text-sm font-semibold leading-tight text-foreground">
              {entry.name}
            </span>
            <Badge variant={entry.source === 'official' ? 'primary' : 'default'}>
              {entry.source === 'official' ? t('official') : t('community')}
            </Badge>
            <StatusBadge entry={entry} />
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
            {entry.installed && (
              <span className="inline-flex items-center gap-0.5">
                <Server className="h-3 w-3" />
                {t('toolCount', { count: entry.tool_count })}
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {entry.description}
      </p>
      {entry.last_error && (
        <p className="text-xs text-destructive">
          {t('lastErrorText', { error: entry.last_error })}
        </p>
      )}
      <div className="mt-auto flex gap-2">
        {!entry.installed ? (
          <Button
            variant={needsEnv ? 'outline' : 'default'}
            onClick={onInstall}
            disabled={installing || acting}
            className="w-full"
          >
            {installing ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {t('installing')}
              </>
            ) : (
              <>
                <Store className="mr-1.5 h-3.5 w-3.5" />
                {needsEnv ? t('registerWithEnv') : t('install')}
              </>
            )}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={onToggleEnabled}
              disabled={acting}
              className="flex-1"
            >
              {acting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : entry.enabled ? (
                <>
                  <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                  {t('disable')}
                </>
              ) : (
                <>
                  <Power className="mr-1.5 h-3.5 w-3.5" />
                  {t('enable')}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={onUninstall}
              disabled={acting}
              className="flex-1 text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t('uninstall')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
